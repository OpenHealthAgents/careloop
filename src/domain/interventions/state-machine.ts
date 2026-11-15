import { InterventionExecutionMode, InterventionStatus, RiskLevel } from "@prisma/client";
import { InvalidStateTransitionError, ValidationError } from "@/lib/errors";

export const ALLOWED_INTERVENTION_TRANSITIONS: Record<
  InterventionStatus,
  readonly InterventionStatus[]
> = {
  RECOMMENDED: [
    InterventionStatus.APPROVED,
    InterventionStatus.MODIFIED,
    InterventionStatus.REJECTED,
  ],
  APPROVED: [
    InterventionStatus.IN_PROGRESS,
    InterventionStatus.COMPLETED,
    InterventionStatus.FAILED,
    InterventionStatus.REJECTED,
  ],
  MODIFIED: [
    InterventionStatus.IN_PROGRESS,
    InterventionStatus.COMPLETED,
    InterventionStatus.FAILED,
    InterventionStatus.REJECTED,
  ],
  IN_PROGRESS: [InterventionStatus.COMPLETED, InterventionStatus.FAILED],
  COMPLETED: [],
  REJECTED: [],
  FAILED: [InterventionStatus.IN_PROGRESS],
};

export function canTransitionInterventionStatus(
  fromStatus: InterventionStatus,
  toStatus: InterventionStatus
): boolean {
  if (fromStatus === toStatus) return false;
  return ALLOWED_INTERVENTION_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

export function assertInterventionTransition(
  fromStatus: InterventionStatus,
  toStatus: InterventionStatus
): void {
  if (!canTransitionInterventionStatus(fromStatus, toStatus)) {
    throw new InvalidStateTransitionError(fromStatus, toStatus);
  }
}

/**
 * Safety gate for automatic intervention execution without prior human approval.
 * High-risk cases, high-risk interventions, HUMAN_ASSISTED, and HUMAN_ONLY interventions
 * MUST NEVER be executed automatically.
 */
export function assertAutomatedExecutionAllowed(params: {
  status: InterventionStatus;
  executionMode: InterventionExecutionMode;
  automationEligible: boolean;
  isHighRisk: boolean;
  caseRiskLevel: RiskLevel;
}): void {
  if (params.status !== InterventionStatus.RECOMMENDED && params.status !== InterventionStatus.APPROVED) {
    throw new InvalidStateTransitionError(params.status, InterventionStatus.IN_PROGRESS);
  }
  if (params.caseRiskLevel === RiskLevel.HIGH || params.isHighRisk) {
    throw new ValidationError(
      "High-risk safety policy: high-risk interventions can never be executed automatically and require human approval."
    );
  }
  if (params.executionMode !== InterventionExecutionMode.AUTOMATED || !params.automationEligible) {
    throw new ValidationError(
      `Execution mode ${params.executionMode} requires human involvement/approval before execution.`
    );
  }
}
