import { BarrierCategory, CommunicationMessageType, VerificationSignalType } from "@prisma/client";
import {
  assertCareLoopPolicyAllowed,
  CaseOrchestratorTool,
  getToolDefinition,
  validateToolInput,
  validateToolOutput,
} from "@/ai";
import { sanitizeToolParameters } from "@/domain/cases/case-memory";
import { validateAgentProposedTransition } from "@/domain/cases/state-machine";
import { validateOutboundCommunication } from "@/domain/communications/validator";
import { rankProvidersForReferral } from "@/domain/matching/provider-matcher";
import { requirePermission } from "@/lib/auth/rbac";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";
import { recordAuditEvent } from "./audit-service";
import { mapToolToJournalEventType, recordExecutionEvent } from "./execution-journal-service";
import { recordCaseLearningOutcome } from "./learning-loop-service";
import { recordToolExecutionSpan } from "./observability-service";
import {
  addCaseNote,
  generateAndSendOutreach,
  getCaseDetail,
  recordCompletionVerification,
  reviewBarrier,
  reviewIntervention,
  runCaseAIAssessment,
  scheduleAppointmentForCase,
  transitionCaseStatus,
  updateAppointmentStatus,
} from "./case-service";

export interface ExecuteToolParams {
  session: SessionUser;
  tool: CaseOrchestratorTool;
  input: Record<string, unknown>;
  idempotencyKey?: string;
  proposedNextState?: Parameters<typeof validateAgentProposedTransition>[1];
  humanApproved?: boolean;
  approvalId?: string;
  agentRunId?: string;
  correlationId?: string;
}

export interface ExecuteToolResult {
  tool: CaseOrchestratorTool;
  auditEventType: string;
  replayed: boolean;
  output: unknown;
  evidenceRecorded: boolean;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, toolName: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ValidationError(`Tool '${toolName}' exceeded timeout of ${timeoutMs}ms.`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Unified CareLoop Tool Execution Contract:
 * 1. Validate input
 * 2. Validate authorization (RBAC)
 * 3. Validate case state & proposed transition
 * 4. Validate policy (non-clinical boundary + human approval gate)
 * 5. Validate consent / privacy requirements
 * 6. Check idempotency
 * 7. Execute bounded domain service with timeout
 * 8. Validate output schema
 * 9. Store evidence & create PHI-minimized AuditEvent
 * 10. Return structured validated result
 */
export async function executeCareLoopTool(params: ExecuteToolParams): Promise<ExecuteToolResult> {
  const startedAt = new Date();
  const telemetry: {
    verifiedCaseId?: string;
    policyDecision?: string;
    retryCount: number;
  } = { retryCount: 0 };

  try {
    const result = await executeCareLoopToolInternal(params, telemetry);
    await recordToolExecutionSpan({
      tenantId: params.session.tenantId,
      caseId: telemetry.verifiedCaseId ?? null,
      agentRunId: params.agentRunId ?? null,
      tool: params.tool,
      status: "SUCCEEDED",
      startedAt,
      retryCount: telemetry.retryCount,
      policyDecision: telemetry.policyDecision ?? null,
      replayed: result.replayed,
      correlationId: params.correlationId ?? params.idempotencyKey ?? null,
    });
    return result;
  } catch (err) {
    const errorCode = err instanceof AppError ? err.code : "INTERNAL_ERROR";
    const errorMessage = err instanceof Error ? err.message : "Tool execution failed";
    await recordToolExecutionSpan({
      tenantId: params.session.tenantId,
      caseId: telemetry.verifiedCaseId ?? null,
      agentRunId: params.agentRunId ?? null,
      tool: params.tool,
      status: "FAILED",
      startedAt,
      retryCount: telemetry.retryCount,
      policyDecision: telemetry.policyDecision ?? null,
      replayed: false,
      errorCode,
      errorMessage,
      correlationId: params.correlationId ?? params.idempotencyKey ?? null,
    }).catch(() => undefined);
    throw err;
  }
}

async function executeCareLoopToolInternal(
  params: ExecuteToolParams,
  telemetry: { verifiedCaseId?: string; policyDecision?: string; retryCount: number }
): Promise<ExecuteToolResult> {
  // 1. Validate tool registration & input schema
  const toolDef = getToolDefinition(params.tool);
  const parsedInput = validateToolInput(params.tool, params.input) as Record<string, unknown>;

  // 2. Validate authorization (every required RBAC permission)
  for (const permission of toolDef.permissions) {
    requirePermission(params.session, permission);
  }

  // 3. Validate tenant-scoped Case state & proposed transition
  const caseId = typeof parsedInput.caseId === "string" ? parsedInput.caseId : undefined;
  const providerId = typeof parsedInput.providerId === "string" ? parsedInput.providerId : undefined;
  const careCase = caseId ? await getCaseDetail(params.session.tenantId, caseId) : null;
  if (careCase) {
    telemetry.verifiedCaseId = careCase.id;
  }

  if (careCase && params.proposedNextState !== undefined) {
    validateAgentProposedTransition(careCase.status, params.proposedNextState);
  }

  // 4. Validate declarative policy engine (non-clinical scope, consent, state, risk, approval)
  let effectiveHumanApproved = Boolean(params.humanApproved);
  if (params.approvalId) {
    const approval = await prisma.approvalRequest.findFirst({
      where: {
        id: params.approvalId,
        tenantId: params.session.tenantId,
      },
    });
    if (!approval) {
      throw new NotFoundError("ApprovalRequest", params.approvalId);
    }
    if (caseId && approval.caseId !== caseId) {
      throw new ValidationError("ApprovalRequest does not match the target caseId.");
    }
    if (approval.action !== params.tool) {
      throw new ValidationError(
        `ApprovalRequest action '${approval.action}' does not authorize tool '${params.tool}'.`
      );
    }
    if (approval.status === "PENDING" && approval.expiresAt && approval.expiresAt <= new Date()) {
      await prisma.approvalRequest.update({
        where: { id: approval.id },
        data: { status: "EXPIRED" },
      });
      throw new ValidationError(`ApprovalRequest '${approval.id}' has expired.`);
    }
    if (approval.status !== "APPROVED") {
      throw new ValidationError(
        `ApprovalRequest '${approval.id}' has status '${approval.status}' and cannot authorize execution.`
      );
    }
    effectiveHumanApproved = true;
  }

  const textFieldsToGuard = [
    parsedInput.body,
    parsedInput.escalationReason,
    parsedInput.closureReason,
    parsedInput.evidenceNote,
    parsedInput.notes,
  ].filter((val): val is string => typeof val === "string" && val.trim().length > 0);

  const policyVerdict = assertCareLoopPolicyAllowed({
    action: params.tool,
    caseState: careCase?.status,
    riskTier: careCase?.riskLevel,
    consentOutreach: careCase?.member.consentOutreach,
    consentSms: careCase?.member.consentSms,
    channel: parsedInput.channel as "SMS" | "PHONE" | "EMAIL" | "PORTAL" | "IN_PERSON_NAVIGATOR" | undefined,
    sensitiveCommunication: Boolean(parsedInput.sensitive),
    matchedProviderId: careCase?.matchedProviderId,
    hasVerifiedCompletion: Boolean(careCase?.firstCompletedVisitAt),
    humanApproved: effectiveHumanApproved,
    textPayloads: textFieldsToGuard,
  });
  telemetry.policyDecision = policyVerdict.decision;

  // 5. Validate consent & privacy requirements for outbound messaging
  if (
    careCase &&
    (params.tool === "send_member_communication" || params.tool === "send_reminder")
  ) {
    validateOutboundCommunication({
      body: String(parsedInput.body ?? ""),
      channel: parsedInput.channel as "SMS" | "PHONE" | "EMAIL" | "PORTAL" | "IN_PERSON_NAVIGATOR",
      consentOutreach: careCase.member.consentOutreach,
      consentSms: careCase.member.consentSms,
      requireConsentForDelivery: true,
    });
  }

  // 6. Check idempotency before side effects
  const entityId = caseId ?? providerId ?? "SYSTEM";
  const effectiveCorrelationId = params.idempotencyKey ?? params.correlationId;
  if (params.idempotencyKey && toolDef.side_effects.kind !== "NONE") {
    const existing = await prisma.auditEvent.findFirst({
      where: {
        tenantId: params.session.tenantId,
        action: "TOOL_EXECUTION_COMPLETED",
        entityId,
        correlationId: params.idempotencyKey,
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing && existing.metadata && typeof existing.metadata === "object") {
      const meta = existing.metadata as Record<string, unknown>;
      if (meta.tool === params.tool && meta.output !== undefined) {
        return {
          tool: params.tool,
          auditEventType: toolDef.audit_event_type,
          replayed: true,
          output: meta.output,
          evidenceRecorded: true,
        };
      }
    }
  }

  // 7. Execute bounded domain operation under tool timeout
  const executePromise = (async (): Promise<{ rawOutput: unknown; newStatus?: string }> => {
    switch (params.tool) {
      case "search_providers": {
        const providers = await prisma.provider.findMany({
          where: { tenantId: params.session.tenantId },
          include: { availabilities: { where: { status: "AVAILABLE" } } },
        });
        const ranked = rankProvidersForReferral(
          providers.map((p) => ({ ...p, verifiedSlots: p.availabilities })),
          {
            referralSpecialty: String(parsedInput.specialty),
            referralNetwork:
              typeof parsedInput.networkRequired === "string"
                ? parsedInput.networkRequired
                : "UNKNOWN",
            referralGeography:
              typeof parsedInput.geography === "string" ? parsedInput.geography : "Central Metro",
            preferredLanguage:
              typeof parsedInput.preferredLanguage === "string"
                ? parsedInput.preferredLanguage
                : "English",
            digitalAccessLevel: "MEDIUM",
          }
        );
        return {
          rawOutput: {
            providers: ranked.map((r) => ({
              providerId: r.provider.id,
              providerName: r.provider.name,
              matchScore: r.matchScore,
              availabilitySource: r.provider.availabilitySource,
            })),
          },
        };
      }

      case "check_provider_availability": {
        const provider = await prisma.provider.findFirst({
          where: { id: String(parsedInput.providerId), tenantId: params.session.tenantId },
          include: { availabilities: { where: { status: "AVAILABLE" } } },
        });
        if (!provider) throw new NotFoundError("Provider", String(parsedInput.providerId));
        return {
          rawOutput: {
            providerId: provider.id,
            availabilitySource: provider.availabilitySource,
            verifiedSlotsCount: provider.availabilities.filter(
              (a) => a.source === "VERIFIED_AVAILABILITY"
            ).length,
            lastVerifiedAt: provider.availabilityLastVerifiedAt?.toISOString() ?? null,
          },
        };
      }

      case "run_ai_assessment": {
        const res = await runCaseAIAssessment({
          tenantId: params.session.tenantId,
          caseId: String(parsedInput.caseId),
          actor: params.session,
          correlationId: effectiveCorrelationId,
        });
        return {
          rawOutput: {
            riskTier: res.riskResult.riskTier,
            priorityScore: res.riskResult.priorityScore,
            stagedBarrierCategory: res.barrierResult.primaryBarrier.category,
            stagedInterventionsCount: res.interventionResult.proposedInterventions.length,
          },
          newStatus: "TRIAGED",
        };
      }

      case "human_barrier_review": {
        const actionMap: Record<string, "ACCEPT" | "MODIFY" | "REJECT" | "MARK_UNKNOWN"> = {
          CONFIRMED: "ACCEPT",
          MODIFIED: "MODIFY",
          REJECTED: "REJECT",
          UNKNOWN: "MARK_UNKNOWN",
        };
        const updated = await reviewBarrier({
          session: params.session,
          barrierId: String(parsedInput.barrierId),
          action: actionMap[String(parsedInput.decision)] ?? "ACCEPT",
          category:
            typeof parsedInput.category === "string"
              ? (parsedInput.category as BarrierCategory)
              : undefined,
          notes: typeof parsedInput.notes === "string" ? parsedInput.notes : undefined,
          correlationId: effectiveCorrelationId,
        });
        return {
          rawOutput: {
            barrierId: updated.id,
            epistemicStatus: updated.epistemicStatus,
            confirmedByHuman: updated.confirmedByHuman,
          },
        };
      }

      case "human_intervention_approval": {
        const decisionMap: Record<string, "APPROVE" | "MODIFY" | "REJECT"> = {
          APPROVED: "APPROVE",
          MODIFIED: "MODIFY",
          REJECTED: "REJECT",
        };
        const updated = await reviewIntervention({
          session: params.session,
          interventionId: String(parsedInput.interventionId),
          decision: decisionMap[String(parsedInput.decision)] ?? "APPROVE",
          notes: typeof parsedInput.notes === "string" ? parsedInput.notes : undefined,
          correlationId: effectiveCorrelationId,
        });
        return {
          rawOutput: {
            interventionId: updated.id,
            status: updated.status,
            approvedById: updated.assignedOwnerId ?? params.session.userId,
          },
        };
      }

      case "request_scheduling": {
        await addCaseNote({
          session: params.session,
          caseId: String(parsedInput.caseId),
          category: "SCHEDULING",
          content: `Requested ${String(parsedInput.modality)} scheduling with provider ${String(
            parsedInput.providerId
          )} via tool executor.`,
          correlationId: effectiveCorrelationId,
        });
        return {
          rawOutput: {
            requestCreated: true,
            providerId: String(parsedInput.providerId),
          },
        };
      }

      case "schedule_appointment": {
        const appt = await scheduleAppointmentForCase({
          session: params.session,
          caseId: String(parsedInput.caseId),
          providerId: String(parsedInput.providerId),
          slotId:
            typeof parsedInput.availabilitySlotId === "string"
              ? parsedInput.availabilitySlotId
              : undefined,
          scheduledStartAt: new Date(String(parsedInput.scheduledStartAt)),
          modality: parsedInput.modality as "IN_PERSON" | "TELEHEALTH",
          correlationId: effectiveCorrelationId,
        });
        return {
          rawOutput: {
            appointmentId: appt.id,
            status: appt.status,
            availabilitySourceAtBooking: appt.availabilitySourceAtBooking,
          },
          newStatus: "APPOINTMENT_SCHEDULED",
        };
      }

      case "send_reminder": {
        const comm = await generateAndSendOutreach({
          session: params.session,
          caseId: String(parsedInput.caseId),
          channel: parsedInput.channel as "SMS" | "PHONE" | "EMAIL" | "PORTAL",
          purpose: "APPOINTMENT_REMINDER",
          customMessage: String(parsedInput.body),
          sendImmediately: true,
          correlationId: effectiveCorrelationId,
        });
        return {
          rawOutput: {
            communicationId: comm.attempt.id,
            deliveryStatus: comm.attempt.deliveryStatus,
          },
        };
      }

      case "send_member_communication": {
        const channel =
          parsedInput.channel === "IN_PERSON_NAVIGATOR" ? "PHONE" : parsedInput.channel;
        const comm = await generateAndSendOutreach({
          session: params.session,
          caseId: String(parsedInput.caseId),
          channel: channel as "SMS" | "PHONE" | "EMAIL" | "PORTAL",
          purpose:
            (parsedInput.messageType as CommunicationMessageType) ??
            CommunicationMessageType.HUMAN_OUTREACH,
          customMessage: String(parsedInput.body),
          sendImmediately: true,
          correlationId: effectiveCorrelationId,
        });
        return {
          rawOutput: {
            communicationId: comm.attempt.id,
            deliveryStatus: comm.attempt.deliveryStatus,
          },
        };
      }

      case "verify_appointment": {
        const actionMap: Record<
          string,
          "CONFIRM" | "COMPLETE" | "CANCEL" | "NO_SHOW" | "RESCHEDULE"
        > = {
          CONFIRMED: "CONFIRM",
          COMPLETED: "COMPLETE",
          CANCELLED: "CANCEL",
          NO_SHOW: "NO_SHOW",
          RESCHEDULED: "RESCHEDULE",
        };
        const updated = await updateAppointmentStatus({
          session: params.session,
          appointmentId: String(parsedInput.appointmentId),
          action: actionMap[String(parsedInput.toStatus)] ?? "CONFIRM",
          note: typeof parsedInput.reason === "string" ? parsedInput.reason : undefined,
          correlationId: effectiveCorrelationId,
        });
        return {
          rawOutput: {
            appointmentId: updated?.id ?? String(parsedInput.appointmentId),
            status: updated?.status ?? String(parsedInput.toStatus),
          },
        };
      }

      case "verify_completion": {
        const verification = await recordCompletionVerification({
          session: params.session,
          caseId: String(parsedInput.caseId),
          signalType: parsedInput.signalType as VerificationSignalType,
          sourceSystem: String(parsedInput.sourceSystem),
          evidenceNote:
            typeof parsedInput.evidenceNote === "string"
              ? parsedInput.evidenceNote
              : "Verified via Tool Executor",
          correlationId: effectiveCorrelationId,
        });
        return {
          rawOutput: {
            verificationId: verification.id,
            provesCareCompleted: verification.verified,
            caseStatus: verification.verified ? "VERIFIED" : careCase?.status ?? "APPOINTMENT_COMPLETED",
          },
          newStatus: verification.verified ? "VERIFIED" : undefined,
        };
      }

      case "escalate_to_human": {
        const escalated = await transitionCaseStatus({
          session: params.session,
          caseId: String(parsedInput.caseId),
          toStatus: "ESCALATED",
          reason: String(parsedInput.escalationReason),
          escalationReason: String(parsedInput.escalationReason),
          correlationId: effectiveCorrelationId,
        });
        return {
          rawOutput: {
            caseId: escalated.id,
            status: "ESCALATED" as const,
            notificationSent: true,
          },
          newStatus: "ESCALATED",
        };
      }

      case "close_verified_case": {
        const closed = await transitionCaseStatus({
          session: params.session,
          caseId: String(parsedInput.caseId),
          toStatus: "CLOSED",
          reason: String(parsedInput.closureReason),
          closureReason: String(parsedInput.closureReason),
          correlationId: effectiveCorrelationId,
        });
        return {
          rawOutput: {
            caseId: closed.id,
            status: "CLOSED" as const,
            closedAt: (closed.closedAt ?? new Date()).toISOString(),
          },
          newStatus: "CLOSED",
        };
      }
    }
  })();

  const { rawOutput, newStatus } = await withTimeout(
    executePromise,
    toolDef.timeout.ms,
    params.tool
  );

  // 8. Validate output against registered tool output_schema
  const validatedOutput = validateToolOutput(params.tool, rawOutput);

  // 9 & 10. Record evidence + PHI-minimized AuditEvent + Execution Journal Event
  const auditEvent = await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "TOOL_EXECUTION_COMPLETED",
    entityType: caseId ? "Case" : "Provider",
    entityId,
    source: "TOOL_EXECUTOR",
    previousState: careCase ? { status: careCase.status } : undefined,
    newState: newStatus ? { status: newStatus } : undefined,
    correlationId: effectiveCorrelationId,
    summary: `Executed tool '${params.tool}' (${toolDef.audit_event_type})`,
    metadata: {
      tool: params.tool,
      auditEventType: toolDef.audit_event_type,
      parameters: sanitizeToolParameters(parsedInput),
      output: validatedOutput,
    },
  });

  if (caseId) {
    await recordExecutionEvent({
      tenantId: params.session.tenantId,
      caseId,
      actorType: params.approvalId ? "AGENT" : "TOOL",
      actorId: params.session.userId,
      eventType: mapToolToJournalEventType(params.tool),
      inputReference: `tool:${params.tool}`,
      outputReference: `audit:${auditEvent.id}`,
      policyDecision: policyVerdict.decision,
      evidence: [
        `tool=${params.tool}`,
        `audit_event_type=${toolDef.audit_event_type}`,
        ...(newStatus ? [`new_status=${newStatus}`] : []),
        ...(params.approvalId ? [`approval_id=${params.approvalId}`] : []),
      ],
      correlationId: params.correlationId ?? params.idempotencyKey ?? null,
    });

    if (
      params.tool === "verify_completion" ||
      params.tool === "close_verified_case" ||
      params.tool === "escalate_to_human"
    ) {
      await recordCaseLearningOutcome({
        tenantId: params.session.tenantId,
        caseId,
      });
    }
  }

  return {
    tool: params.tool,
    auditEventType: toolDef.audit_event_type,
    replayed: false,
    output: validatedOutput,
    evidenceRecorded: true,
  };
}
