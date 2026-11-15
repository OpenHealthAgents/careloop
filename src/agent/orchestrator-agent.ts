/**
 * ============================================================================
 * CARELOOP CASE ORCHESTRATOR
 * ============================================================================
 * CRITICAL ARCHITECTURAL RULE:
 * Never confuse AI autonomy with system autonomy.
 * CareLoop is highly autonomous in coordinating routine execution while
 * remaining tightly governed.
 *
 *                 CARELOOP
 *                     |
 *             CASE ORCHESTRATOR
 *                     |
 *       ┌─────────────┼─────────────┐
 *       |             |             |
 *   STATE MACHINE   POLICY        MEMORY
 *       |           ENGINE           |
 *       └─────────────┼─────────────┘
 *                     |
 *                TOOL REGISTRY
 *                     |
 *        ┌────────────┼────────────┐
 *        |            |            |
 *     PROVIDER    SCHEDULING   COMMUNICATION
 *        |            |            |
 *        └────────────┼────────────┘
 *                     |
 *              HUMAN APPROVAL
 *                     |
 *              EXECUTION JOURNAL
 *                     |
 *                  EVIDENCE
 *                     |
 *             OUTCOME VERIFICATION
 *                     |
 *                  LEARNING
 *
 * - The agent is the execution intelligence.
 * - The state machine is the workflow authority.
 * - The policy engine is the safety authority.
 * - The tool registry is the action boundary.
 * - The human is the judgment and exception layer.
 * - The evidence layer is the truth layer.
 * - The learning layer is the improvement and defensibility layer.
 * That is CareLoop.
 * ============================================================================
 */

import { CaseStatus } from "@prisma/client";
import {
  CareLoopAgentRuntime,
  careLoopAgentRuntime,
  type AgentRuntimeResult,
  type AssembledRuntimeContext,
} from "@/agent_runtime";
import {
  CareLoopCaseOrchestrator,
  CaseOrchestratorDecision,
  CaseOrchestratorInput,
  ORCHESTRATOR_MODEL_DEFAULT,
  ORCHESTRATOR_PROMPT_VERSION,
  parseExternalOrchestratorDecision,
} from "@/ai";
import { getAllowedNextCaseStatuses } from "@/domain/cases/state-machine";
import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { SessionUser } from "@/lib/auth/session";
import { ValidationError } from "@/lib/errors";
import type { Agent } from "./contracts";

export type OrchestratorBlockerCode =
  | "NO_RISK_ASSESSMENT"
  | "UNCONFIRMED_BARRIERS"
  | "UNRESOLVED_BARRIERS"
  | "MISSING_OUTREACH_CONSENT"
  | "NO_MATCHED_PROVIDER"
  | "NO_VERIFIED_SLOTS"
  | "APPOINTMENT_NO_SHOW"
  | "PENDING_HUMAN_TASKS"
  | "AWAITING_COMPLETION_VERIFICATION"
  | "EXCEPTION_STATE";

export interface OrchestratorBlocker {
  code: OrchestratorBlockerCode;
  severity: "INFO" | "MEDIUM" | "HIGH";
  description: string;
}

export interface OrchestratorInspection {
  caseId: string;
  goal: string;
  currentState: CaseStatus;
  allowedNextStates: readonly CaseStatus[];
  evidenceSignals: string[];
  hasVerifiedVisit: boolean;
  blockers: OrchestratorBlocker[];
}

export type OrchestrationLoopOutcome =
  | "GOAL_ACHIEVED"
  | "PAUSED_FOR_APPROVAL"
  | "PAUSED_FOR_INPUT"
  | "ESCALATED"
  | "FAILED"
  | "MAX_STEPS_REACHED";

export interface OrchestrateCaseParams {
  session: SessionUser;
  caseId: string;
  maxSteps?: number;
  autoContinue?: boolean;
  sensitiveCommunication?: boolean;
  initialToolInput?: Record<string, unknown>;
  toolInputProvider?: (params: {
    step: number;
    decision: CaseOrchestratorDecision;
    context: AssembledRuntimeContext;
    inspection: OrchestratorInspection;
  }) => Record<string, unknown> | undefined;
  rawExternalDecision?: string;
  correlationId?: string;
}

export interface OrchestrationStepSummary {
  step: number;
  inspection: OrchestratorInspection;
  result: AgentRuntimeResult;
}

export interface OrchestrateCaseResult {
  caseId: string;
  outcome: OrchestrationLoopOutcome;
  stepsExecuted: number;
  steps: OrchestrationStepSummary[];
  finalRunStatus: AgentRuntimeResult["run"]["status"];
  finalCaseState: CaseStatus;
  nextDecision?: CaseOrchestratorDecision;
  blockers: OrchestratorBlocker[];
}

export function inspectCaseContext(context: AssembledRuntimeContext): OrchestratorInspection {
  const input = context.orchestratorInput;
  const blockers: OrchestratorBlocker[] = [];

  if (!input.available_evidence.hasRiskAssessment) {
    blockers.push({
      code: "NO_RISK_ASSESSMENT",
      severity: "MEDIUM",
      description: "Initial AI barrier and risk assessment has not been recorded.",
    });
  }

  const unconfirmedBarriers = input.known_barriers.filter((b) => !b.confirmedByHuman && !b.resolved);
  if (unconfirmedBarriers.length > 0) {
    blockers.push({
      code: "UNCONFIRMED_BARRIERS",
      severity: "MEDIUM",
      description: `${unconfirmedBarriers.length} inferred barrier(s) require human confirmation.`,
    });
  }

  const unresolvedBarriers = input.known_barriers.filter((b) => !b.resolved);
  if (unresolvedBarriers.length > 0) {
    blockers.push({
      code: "UNRESOLVED_BARRIERS",
      severity: "HIGH",
      description: `${unresolvedBarriers.length} active barrier(s) remain unresolved.`,
    });
  }

  if (!input.policy_context.consentOutreach) {
    blockers.push({
      code: "MISSING_OUTREACH_CONSENT",
      severity: "HIGH",
      description: "Member outreach consent is not granted.",
    });
  }

  if (!input.referral_context.matchedProviderId) {
    blockers.push({
      code: "NO_MATCHED_PROVIDER",
      severity: "MEDIUM",
      description: "No provider has been matched to this case yet.",
    });
  }

  if (input.referral_context.verifiedAvailableSlotsCount === 0) {
    blockers.push({
      code: "NO_VERIFIED_SLOTS",
      severity: "MEDIUM",
      description: "Zero verified available provider slots are currently recorded.",
    });
  }

  if (input.available_evidence.hasNoShowAppointment) {
    blockers.push({
      code: "APPOINTMENT_NO_SHOW",
      severity: "HIGH",
      description: "Member has a prior no-show appointment requiring re-engagement.",
    });
  }

  const totalPendingHumanTasks =
    input.human_tasks.pendingBarrierConfirmations +
    input.human_tasks.pendingInterventionApprovals +
    input.human_tasks.openEscalations;
  if (totalPendingHumanTasks > 0) {
    blockers.push({
      code: "PENDING_HUMAN_TASKS",
      severity: "HIGH",
      description: `${totalPendingHumanTasks} pending human task(s) or escalation(s) are open.`,
    });
  }

  if (input.human_tasks.awaitingCompletionVerification) {
    blockers.push({
      code: "AWAITING_COMPLETION_VERIFICATION",
      severity: "INFO",
      description: "Appointment completed; awaiting verified visit completion attestation.",
    });
  }

  if (
    input.current_state === "ESCALATED" ||
    input.current_state === "BLOCKED" ||
    input.current_state === "LOST_TO_FOLLOW_UP"
  ) {
    blockers.push({
      code: "EXCEPTION_STATE",
      severity: "HIGH",
      description: `Case is in exception state ${input.current_state}.`,
    });
  }

  return {
    caseId: context.caseRecord.id,
    goal: context.caseContext.goal,
    currentState: context.caseRecord.status,
    allowedNextStates: getAllowedNextCaseStatuses(context.caseRecord.status),
    evidenceSignals: input.available_evidence.signals,
    hasVerifiedVisit: input.available_evidence.hasVerifiedVisit,
    blockers,
  };
}

export class CareLoopOrchestratorAgent implements Agent<CaseOrchestratorInput, CaseOrchestratorDecision> {
  public readonly name = "CareLoopCaseOrchestrator";
  public readonly modelVersion = ORCHESTRATOR_MODEL_DEFAULT;
  public readonly promptVersion = ORCHESTRATOR_PROMPT_VERSION;

  private readonly runtime: CareLoopAgentRuntime;

  constructor(runtime: CareLoopAgentRuntime = careLoopAgentRuntime) {
    this.runtime = runtime;
  }

  decide(input: CaseOrchestratorInput): CaseOrchestratorDecision {
    return CareLoopCaseOrchestrator.decideNextStep(input);
  }

  /**
   * Strict structured decision parser: rejects any free-form text or schema-violating
   * payload so unvalidated output can never bypass runtime validation.
   */
  parseAndValidateDecision(
    rawOutput: string,
    policyCtx?: {
      riskTier?: string;
      consentOutreach?: boolean;
      hasVerifiedCompletion?: boolean;
      verifiedAvailableSlotsCount?: number;
      humanApproved?: boolean;
    }
  ): CaseOrchestratorDecision {
    if (typeof rawOutput !== "string" || rawOutput.trim().length === 0) {
      throw new ValidationError(
        "CareLoopCaseOrchestrator rejected empty or non-string decision output."
      );
    }
    return parseExternalOrchestratorDecision(rawOutput, policyCtx);
  }

  async orchestrateCase(params: OrchestrateCaseParams): Promise<OrchestrateCaseResult> {
    requirePermission(params.session, PERMISSIONS.AI_RUN);

    const maxSteps = Math.max(1, Math.min(params.maxSteps ?? 5, 10));
    const autoContinue = params.autoContinue ?? true;
    const steps: OrchestrationStepSummary[] = [];

    for (let step = 1; step <= maxSteps; step += 1) {
      // 1. Load case context & inspect state, evidence, blockers
      const context = await this.runtime.contextAssembler.assemble({
        tenantId: params.session.tenantId,
        caseId: params.caseId,
      });
      const inspection = inspectCaseContext(context);

      // If rawExternalDecision is supplied on step 1, validate it strictly before anything else
      if (step === 1 && params.rawExternalDecision !== undefined) {
        this.parseAndValidateDecision(params.rawExternalDecision, {
          riskTier: context.caseRecord.riskLevel,
          consentOutreach: context.caseRecord.member.consentOutreach,
          hasVerifiedCompletion: Boolean(context.caseRecord.firstCompletedVisitAt),
          verifiedAvailableSlotsCount:
            context.orchestratorInput.referral_context.verifiedAvailableSlotsCount,
        });
      }

      // Check if goal is already achieved
      if (
        this.runtime.goalManager.isGoalAchieved(
          inspection.currentState,
          inspection.hasVerifiedVisit
        )
      ) {
        return {
          caseId: params.caseId,
          outcome: "GOAL_ACHIEVED",
          stepsExecuted: steps.length,
          steps,
          finalRunStatus: steps[steps.length - 1]?.result.run.status ?? "COMPLETED",
          finalCaseState: inspection.currentState,
          nextDecision: steps[steps.length - 1]?.result.decision,
          blockers: inspection.blockers,
        };
      }

      // 2. Determine structured decision & resolve toolInput if provided
      const plannedDecision = this.decide(context.orchestratorInput);
      const toolInput =
        step === 1 && params.initialToolInput
          ? params.initialToolInput
          : params.toolInputProvider?.({
              step,
              decision: plannedDecision,
              context,
              inspection,
            });

      // 3. Execute step through the CareLoop Agent Runtime (validates decision, policy, executes, records evidence, updates state)
      const result = await this.runtime.start({
        session: params.session,
        caseId: params.caseId,
        agent: this.name,
        model: this.modelVersion,
        promptVersion: this.promptVersion,
        toolInput,
        sensitiveCommunication: params.sensitiveCommunication,
        correlationId: params.correlationId,
      });

      steps.push({ step, inspection, result });

      // 4. Decide whether to continue or pause
      if (result.run.status === "AWAITING_APPROVAL") {
        return {
          caseId: params.caseId,
          outcome: "PAUSED_FOR_APPROVAL",
          stepsExecuted: steps.length,
          steps,
          finalRunStatus: result.run.status,
          finalCaseState: inspection.currentState,
          nextDecision: result.decision,
          blockers: inspection.blockers,
        };
      }

      if (result.run.status === "ESCALATED") {
        return {
          caseId: params.caseId,
          outcome: "ESCALATED",
          stepsExecuted: steps.length,
          steps,
          finalRunStatus: result.run.status,
          finalCaseState: inspection.currentState,
          nextDecision: result.decision,
          blockers: inspection.blockers,
        };
      }

      if (result.run.status === "FAILED") {
        return {
          caseId: params.caseId,
          outcome: "FAILED",
          stepsExecuted: steps.length,
          steps,
          finalRunStatus: result.run.status,
          finalCaseState: inspection.currentState,
          nextDecision: result.decision,
          blockers: inspection.blockers,
        };
      }

      // If no tool was executed (plan-only step) or autoContinue is disabled, pause cleanly for input/review
      if (!autoContinue || !toolInput) {
        return {
          caseId: params.caseId,
          outcome: "PAUSED_FOR_INPUT",
          stepsExecuted: steps.length,
          steps,
          finalRunStatus: result.run.status,
          finalCaseState: inspection.currentState,
          nextDecision: result.decision,
          blockers: inspection.blockers,
        };
      }
    }

    const finalContext = await this.runtime.contextAssembler.assemble({
      tenantId: params.session.tenantId,
      caseId: params.caseId,
    });
    const finalInspection = inspectCaseContext(finalContext);
    const lastStep = steps[steps.length - 1];

    return {
      caseId: params.caseId,
      outcome: this.runtime.goalManager.isGoalAchieved(
        finalInspection.currentState,
        finalInspection.hasVerifiedVisit
      )
        ? "GOAL_ACHIEVED"
        : "MAX_STEPS_REACHED",
      stepsExecuted: steps.length,
      steps,
      finalRunStatus: lastStep?.result.run.status ?? "COMPLETED",
      finalCaseState: finalInspection.currentState,
      nextDecision: lastStep?.result.decision,
      blockers: finalInspection.blockers,
    };
  }
}

export const careLoopOrchestratorAgent = new CareLoopOrchestratorAgent();
