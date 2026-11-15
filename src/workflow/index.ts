import { CaseStatus } from "@prisma/client";
import {
  canTransitionCaseStatus,
  getAllowedNextCaseStatuses,
  validateAgentProposedTransition,
} from "@/domain/cases/state-machine";
import type { StateTransition, WorkflowEngine, WorkflowState } from "./contracts";

export * from "./contracts";
export {
  buildCaseGoal,
  canTransitionCaseStatus,
  CASE_TRANSITION_RULES,
  caseStateDomainService,
  CaseStateDomainService,
  deterministicTransitionValidator,
  DeterministicTransitionValidator,
  getAllowedNextCaseStatuses,
  validateAgentProposedTransition,
} from "@/domain/cases/state-machine";
export type {
  CaseState,
  Transition,
  TransitionRule,
  TransitionValidationResult,
  TransitionValidator,
} from "@/domain/cases/state-machine";
export { canTransitionAppointmentStatus } from "@/domain/appointments/state-machine";
export { canTransitionInterventionStatus } from "@/domain/interventions/state-machine";
export { canTransitionReferralStatus } from "@/domain/referrals/state-machine";

export class CaseWorkflowEngine implements WorkflowEngine<CaseStatus> {
  canTransition(from: WorkflowState<CaseStatus>, to: WorkflowState<CaseStatus>): boolean {
    return canTransitionCaseStatus(from, to);
  }

  getAllowedNextStates(from: WorkflowState<CaseStatus>): readonly WorkflowState<CaseStatus>[] {
    return getAllowedNextCaseStatuses(from);
  }

  validateTransition(
    from: WorkflowState<CaseStatus>,
    to: WorkflowState<CaseStatus>
  ): StateTransition<CaseStatus> {
    if (!canTransitionCaseStatus(from, to)) {
      return {
        from,
        to,
        allowed: false,
        reason: `Transition ${from} -> ${to} is not permitted by CareLoop case state machine.`,
      };
    }

    try {
      validateAgentProposedTransition(from, to);
      return { from, to, allowed: true };
    } catch (error) {
      return {
        from,
        to,
        allowed: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export const caseWorkflowEngine = new CaseWorkflowEngine();
