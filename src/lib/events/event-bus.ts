/**
 * ============================================================================
 * CARELOOP EVENT BUS & REACTIVE ORCHESTRATOR
 * ============================================================================
 * Central reactive dispatcher connecting events, agents, and state machine.
 *
 * Core Guarantees:
 * 1. Idempotency: Duplicate events are detected and safely suppressed.
 * 2. Agent Reactions: Specialized agents subscribe and react to domain signals.
 * 3. Deterministic State Transitions: All proposed transitions pass through
 *    the formal CaseWorkflowEngine state machine.
 * 4. Shared Audit: Every event publication and state change is logged.
 * ============================================================================
 */

import { CaseStatus, Prisma } from "@prisma/client";
import {
  canTransitionCaseStatus,
  getAllowedNextCaseStatuses,
  validateAgentProposedTransition,
} from "@/domain/cases/state-machine";
import { prisma } from "@/lib/db";
import { recordAuditEvent } from "@/services/audit-service";
import { DEFAULT_AGENT_EVENT_HANDLERS } from "./agent-reactions";
import {
  CareLoopEvent,
  CareLoopEventType,
  EventHandler,
  EventHandlerContext,
  EventProcessingResult,
  EventReactionOutcome,
} from "./contracts";
import { eventIdempotencyStore } from "./idempotency";

export class CareLoopEventBus {
  private readonly handlers = new Map<CareLoopEventType, Set<EventHandler<any>>>();

  constructor() {
    // Register default reactive agent handlers for all 12 events
    for (const [eventType, handler] of Object.entries(DEFAULT_AGENT_EVENT_HANDLERS)) {
      this.subscribe(eventType as any, handler as any);
    }
  }

  /**
   * Subscribes an event handler to a specific CareLoop event type.
   */
  public subscribe<TType extends CareLoopEventType>(
    eventType: TType,
    handler: EventHandler<TType>
  ): () => void {
    let set = this.handlers.get(eventType);
    if (!set) {
      set = new Set();
      this.handlers.set(eventType, set);
    }
    set.add(handler);

    // Return un-subscriber
    return () => {
      set?.delete(handler);
    };
  }

  /**
   * Publishes an event to the bus.
   * Enforces idempotency, dispatches agent reactions, and guarantees
   * deterministic state transitions.
   */
  public async publish<TType extends CareLoopEventType>(
    event: CareLoopEvent<TType>,
    options?: {
      currentCaseStatus?: CaseStatus;
      skipDbPersistence?: boolean;
    }
  ): Promise<EventProcessingResult> {
    const { tenantId, eventType, idempotencyKey, caseId } = event;

    // 1. IDEMPOTENCY CHECK
    const { processed, cachedResult } = await eventIdempotencyStore.isProcessed(
      tenantId,
      eventType,
      idempotencyKey
    );
    if (processed && cachedResult) {
      return {
        ...cachedResult,
        status: "DUPLICATE_IGNORED",
        replayed: true,
      };
    }

    // 2. RESOLVE CURRENT CASE STATUS FROM DB OR CONTEXT
    let currentCaseStatus: CaseStatus = options?.currentCaseStatus ?? "NEW";
    let dbCase: { id: string; status: CaseStatus } | null = null;

    if (!options?.skipDbPersistence && caseId) {
      try {
        dbCase = await prisma.case.findFirst({
          where: { id: caseId, tenantId },
          select: { id: true, status: true },
        });
        if (dbCase) {
          currentCaseStatus = dbCase.status;
        }
      } catch {
        // Fall back to context status if offline or in-memory test
      }
    }

    const handlerContext: EventHandlerContext = {
      correlationId: event.correlationId,
      currentCaseStatus,
    };

    // 3. DISPATCH AGENT REACTIONS
    const reactions: EventReactionOutcome[] = [];
    const registered = this.handlers.get(eventType);

    if (registered) {
      for (const handler of registered) {
        try {
          const outcome = await handler(event, handlerContext);
          reactions.push(outcome);
        } catch (err) {
          reactions.push({
            agentName: "UnknownAgent",
            reaction: `Handler failed on event ${eventType}`,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // 4. PROCESS DETERMINISTIC STATE TRANSITIONS
    let appliedTransition:
      | { applied: boolean; from: CaseStatus; to: CaseStatus; reason: string }
      | undefined;

    // Evaluate the first proposed transition from agent reactions
    const proposed = reactions.find((r) => r.proposedTransition !== undefined)?.proposedTransition;

    if (proposed) {
      const from = currentCaseStatus;
      const to = proposed.to;

      // Validate through the formal deterministic state machine
      if (!canTransitionCaseStatus(from, to)) {
        const allowed = getAllowedNextCaseStatuses(from);
        appliedTransition = {
          applied: false,
          from,
          to,
          reason: `Deterministic rejection: Transition from ${from} to ${to} is forbidden. Allowed: [${allowed.join(", ")}].`,
        };
      } else {
        try {
          validateAgentProposedTransition(from, to);

          // Apply state transition in database if live persistence is enabled
          if (!options?.skipDbPersistence && dbCase) {
            await prisma.$transaction(async (tx) => {
              await tx.case.update({
                where: { id: caseId },
                data: { status: to },
              });

              await tx.workflowEvent.create({
                data: {
                  tenantId,
                  caseId,
                  eventType: "STATUS_TRANSITION",
                  fromStatus: from,
                  toStatus: to,
                  actorId: event.actor.id ?? "SYSTEM",
                  actorRole: event.actor.role ?? "AGENT_SERVICE",
                  reason: proposed.reason,
                  metadata: {
                    triggeringEventId: event.eventId,
                    triggeringEventType: event.eventType,
                  } as Prisma.JsonObject,
                },
              });
            });
          }

          appliedTransition = {
            applied: true,
            from,
            to,
            reason: proposed.reason,
          };
        } catch (err) {
          appliedTransition = {
            applied: false,
            from,
            to,
            reason: `Validation rule rejection: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }
    }

    // 5. RECORD SHARED AUDIT EVENT
    if (!options?.skipDbPersistence) {
      await recordAuditEvent({
        tenantId,
        actorId: event.actor.id ?? "SYSTEM",
        actorRole: event.actor.role ?? "SYSTEM",
        action: `EVENT_${eventType.toUpperCase()}`,
        entityType: "DomainEvent",
        entityId: event.eventId,
        correlationId: event.correlationId,
        summary: `Event ${eventType} processed for case ${caseId}. Reactions: ${reactions.length}.`,
        metadata: {
          eventType,
          idempotencyKey,
          caseId,
          appliedTransition,
          reactionsSummary: reactions.map((r) => ({ agent: r.agentName, success: r.success })),
        },
      }).catch(() => undefined);
    }

    // 6. ASSEMBLE RESULT AND CACHE FOR IDEMPOTENCY
    const result: EventProcessingResult = {
      eventId: event.eventId,
      eventType,
      idempotencyKey,
      status: "PROCESSED",
      caseId,
      replayed: false,
      deterministicStateTransition: appliedTransition,
      reactions,
      processedAt: new Date(),
    };

    await eventIdempotencyStore.recordProcessing(tenantId, eventType, idempotencyKey, result);

    return result;
  }
}

export const careLoopEventBus = new CareLoopEventBus();
