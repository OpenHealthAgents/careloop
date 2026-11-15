/**
 * ============================================================================
 * MULTI-AGENT SHARED INVARIANTS & INTEGRITY ENGINE
 * ============================================================================
 * Enforces the 5 non-negotiable operational invariants across all agents:
 * 1. Shared State: Single source of truth in PostgreSQL via CaseWorkflowEngine.
 * 2. Shared Policy: Evaluated via Centralized CareLoop Policy Engine.
 * 3. Shared Audit: Every message, task, and result logged to tamper-evident audit.
 * 4. Shared Evidence: Shared evidence ledger accessible to all agents.
 * 5. Shared Case Goal: No agent may independently redefine the case goal.
 * ============================================================================
 */

import { CaseStatus } from "@prisma/client";
import { CaseOrchestratorTool } from "@/ai/schemas";
import {
  canTransitionCaseStatus,
  getAllowedNextCaseStatuses,
  validateAgentProposedTransition,
} from "@/domain/cases/state-machine";
import { AppError, ValidationError } from "@/lib/errors";
import { careLoopPolicyEvaluator, PolicyContext, PolicyDecision } from "@/policy";
import { recordAuditEvent } from "@/services/audit-service";
import { recordExecutionEvent } from "@/services/execution-journal-service";
import {
  AgentMessage,
  AgentResult,
  AgentTask,
  DiscoveredEvidenceSignal,
} from "./contracts";

/**
 * Thrown when an agent attempts to alter or replace the canonical case goal.
 */
export class CaseGoalInvariantViolationError extends AppError {
  constructor(agentName: string, canonicalGoal: string, attemptedGoal: string) {
    super(
      `Goal Mutation Rejected: Agent '${agentName}' attempted to independently redefine the case goal from "${canonicalGoal}" to "${attemptedGoal}". Case goals are anchored to member referrals and immutable across agents.`,
      400,
      "GOAL_MUTATION_REJECTED"
    );
    this.name = "CaseGoalInvariantViolationError";
  }
}

/**
 * ----------------------------------------------------------------------------
 * 1. SHARED CASE GOAL INVARIANT
 * ----------------------------------------------------------------------------
 * Asserts that an agent-reported goal strictly matches the canonical case goal.
 */
export function assertCaseGoalImmutable(
  canonicalGoal: string,
  proposedGoal: string | undefined | null,
  agentName: string
): void {
  if (!canonicalGoal || !canonicalGoal.trim()) {
    throw new ValidationError("Canonical case goal must be defined and non-empty.");
  }

  // If proposed goal is absent, it implicitly accepts canonical goal
  if (proposedGoal === undefined || proposedGoal === null) {
    return;
  }

  const normalizedCanonical = canonicalGoal.trim().toLowerCase();
  const normalizedProposed = proposedGoal.trim().toLowerCase();

  if (normalizedCanonical !== normalizedProposed) {
    throw new CaseGoalInvariantViolationError(agentName, canonicalGoal, proposedGoal);
  }
}

/**
 * ----------------------------------------------------------------------------
 * 2. SHARED STATE INVARIANT
 * ----------------------------------------------------------------------------
 * Validates any state transition proposed by an agent against the state machine.
 */
export function validateSharedStateTransition(
  fromStatus: CaseStatus,
  toStatus: CaseStatus,
  agentName: string
): { isValid: boolean; error?: string } {
  if (!canTransitionCaseStatus(fromStatus, toStatus)) {
    const allowed = getAllowedNextCaseStatuses(fromStatus);
    return {
      isValid: false,
      error: `Agent '${agentName}' proposed illegal transition from ${fromStatus} to ${toStatus}. Allowed next states: [${allowed.join(", ")}].`,
    };
  }

  try {
    validateAgentProposedTransition(fromStatus, toStatus);
    return { isValid: true };
  } catch (err) {
    return {
      isValid: false,
      error: `Agent proposed transition rejected by domain rules: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * ----------------------------------------------------------------------------
 * 3. SHARED POLICY INVARIANT
 * ----------------------------------------------------------------------------
 * Evaluates any agent action or tool invocation against the central policy engine.
 */
export function evaluateSharedAgentPolicy(params: {
  action: CaseOrchestratorTool | string;
  caseState?: CaseStatus;
  riskTier?: string;
  consentOutreach?: boolean;
  consentSms?: boolean;
  channel?: string;
  humanApproved?: boolean;
}): PolicyDecision {
  const context: PolicyContext = {
    action: params.action,
    caseState: params.caseState,
    riskTier: params.riskTier,
    consentOutreach: params.consentOutreach,
    consentSms: params.consentSms,
    communicationChannel: params.channel as PolicyContext["communicationChannel"],
    humanApproved: params.humanApproved,
  };

  return careLoopPolicyEvaluator.evaluate(context);
}

/**
 * ----------------------------------------------------------------------------
 * 4. SHARED AUDIT INVARIANT
 * ----------------------------------------------------------------------------
 * Logs all inter-agent messages and task dispatches to tamper-evident audit trails.
 */
export async function recordSharedAgentMessageAudit(message: AgentMessage): Promise<void> {
  await recordAuditEvent({
    tenantId: message.tenantId,
    actorId: `agent:${message.senderAgent}`,
    actorEmail: `${message.senderAgent.toLowerCase()}@agent.careloop.internal`,
    actorRole: "AGENT_SERVICE",
    action: `AGENT_MESSAGE_${message.messageType}`,
    entityType: "AgentMessage",
    entityId: message.id,
    correlationId: message.correlationId,
    summary: `Inter-agent message from ${message.senderAgent} to ${message.recipientAgent} (${message.messageType})`,
    metadata: {
      caseId: message.caseId,
      sender: message.senderAgent,
      recipient: message.recipientAgent,
      sharedGoal: message.sharedGoal,
      parentMessageId: message.parentMessageId,
    },
  }).catch(() => undefined);
}

export async function recordSharedAgentTaskAudit(
  task: AgentTask,
  result?: AgentResult
): Promise<void> {
  const eventType = result
    ? "SPECIALIZED_AGENT_TASK_COMPLETED"
    : "SPECIALIZED_AGENT_TASK_STARTED";

  await recordExecutionEvent({
    tenantId: task.tenantId,
    caseId: task.caseId,
    actorType: "AGENT",
    actorId: task.assignedAgent,
    eventType,
    inputReference: `task:${task.taskId}:${task.capabilityRequired}`,
    outputReference: result ? `result:${result.status}` : undefined,
    policyDecision: result?.status === "REQUIRES_HUMAN" ? "REQUIRE_HUMAN_APPROVAL" : "ALLOW",
    evidence: result?.evidenceDiscovered.map((e) => `${e.category}:${e.signal}`) ?? [],
    correlationId: task.taskId,
  }).catch(() => undefined);
}

/**
 * ----------------------------------------------------------------------------
 * 5. SHARED EVIDENCE INVARIANT
 * ----------------------------------------------------------------------------
 * Accumulates and dedupes evidence discovered across specialized agents.
 */
export function mergeSharedEvidence(
  existingEvidence: readonly DiscoveredEvidenceSignal[],
  newEvidence: readonly DiscoveredEvidenceSignal[]
): DiscoveredEvidenceSignal[] {
  const seen = new Set<string>();
  const merged: DiscoveredEvidenceSignal[] = [];

  for (const item of [...existingEvidence, ...newEvidence]) {
    const key = `${item.category}:${item.source}:${item.signal}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  return merged;
}
