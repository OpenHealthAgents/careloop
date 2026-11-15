import { CaseStatus, ExecutionActorType, Prisma } from "@prisma/client";
import {
  CareLoopCaseOrchestrator,
  CaseOrchestratorDecision,
  CaseOrchestratorDecisionSchema,
  CaseOrchestratorInput,
  CaseOrchestratorTool,
  enforceOrchestratorDecisionPolicy,
  ORCHESTRATOR_MODEL_DEFAULT,
  ORCHESTRATOR_PROMPT_VERSION,
  parseExternalOrchestratorDecision,
} from "@/ai";
import { getToolDefinition } from "@/ai/tool-registry";
import { CaseContextAssembler } from "@/domain/cases/context-assembler";
import {
  buildCaseGoal,
  canTransitionCaseStatus,
  validateAgentProposedTransition,
} from "@/domain/cases/state-machine";
import { prismaEvidenceStore } from "@/evidence";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { careLoopPolicyEvaluator, PolicyDecision } from "@/policy";
import {
  ApprovalRecord,
  cancelHumanApproval,
  getApprovalRecord,
  requestHumanApproval,
} from "@/services/approval-service";
import { getCaseDetail } from "@/services/case-service";
import {
  ExecutionJournalEntry,
  recordExecutionEvent,
} from "@/services/execution-journal-service";
import { TokenUsageInput } from "@/services/observability-service";
import { CareLoopToolExecutor, ToolCall, ToolResult } from "@/tools";
import type {
  AgentRun,
  AgentRunCheckpoint,
  ApprovalManager,
  AssembledRuntimeContext,
  ContextAssembler,
  DecisionValidationResult,
  DecisionValidator,
  EvidenceManager,
  ExecutionJournal,
  GoalManager,
  GoalResolution,
  Planner,
  PolicyGate,
  RuntimeToolExecutor,
  StateManager,
} from "./contracts";

export class CareLoopGoalManager implements GoalManager {
  resolveGoal(params: {
    caseId: string;
    currentState: CaseStatus;
    explicitGoal?: string | null;
    specialty?: string;
    hasVerifiedCompletion?: boolean;
  }): GoalResolution {
    const goal =
      params.explicitGoal && params.explicitGoal.trim().length > 0
        ? params.explicitGoal.trim()
        : buildCaseGoal({ specialty: params.specialty ?? "Behavioral Health" });

    const achieved = this.isGoalAchieved(params.currentState, params.hasVerifiedCompletion);
    const remainingMilestones: string[] = [];

    if (!achieved) {
      if (params.currentState === "NEW" || params.currentState === "TRIAGED") {
        remainingMilestones.push("ASSESS_BARRIERS_AND_RISK");
      }
      if (
        params.currentState === "NEW" ||
        params.currentState === "TRIAGED" ||
        params.currentState === "BARRIER_IDENTIFIED" ||
        params.currentState === "INTERVENTION_RECOMMENDED" ||
        params.currentState === "INTERVENTION_IN_PROGRESS"
      ) {
        remainingMilestones.push("SELECT_VERIFIED_PROVIDER");
      }
      if (
        params.currentState !== "APPOINTMENT_SCHEDULED" &&
        params.currentState !== "APPOINTMENT_CONFIRMED" &&
        params.currentState !== "APPOINTMENT_COMPLETED" &&
        params.currentState !== "VERIFIED"
      ) {
        remainingMilestones.push("SCHEDULE_APPOINTMENT");
      }
      remainingMilestones.push("VERIFY_FIRST_COMPLETED_VISIT");
    }

    return {
      goal,
      targetState: "CLOSED",
      achieved,
      remainingMilestones,
    };
  }

  isGoalAchieved(currentState: CaseStatus, hasVerifiedCompletion = false): boolean {
    return (
      currentState === "CLOSED" ||
      currentState === "VERIFIED" ||
      (currentState === "APPOINTMENT_COMPLETED" && hasVerifiedCompletion)
    );
  }
}

export class CareLoopContextAssembler implements ContextAssembler {
  private readonly assembler = new CaseContextAssembler();

  async assemble(params: {
    tenantId: string;
    caseId: string;
  }): Promise<AssembledRuntimeContext> {
    const careCase = await getCaseDetail(params.tenantId, params.caseId);

    const caseContext = this.assembler.assemble({
      id: careCase.id,
      goal: careCase.goal,
      status: careCase.status,
      riskLevel: careCase.riskLevel,
      priorityScore: careCase.priorityScore,
      humanReviewRequired: careCase.humanReviewRequired,
      matchedProviderId: careCase.matchedProviderId,
      firstCompletedVisitAt: careCase.firstCompletedVisitAt,
      member: {
        preferredLanguage: careCase.member.preferredLanguage,
        urbanicity: careCase.member.urbanicity,
        digitalAccessLevel: careCase.member.digitalAccessLevel,
        transportationAccess: careCase.member.transportationAccess,
        consentOutreach: careCase.member.consentOutreach,
        consentSms: careCase.member.consentSms,
        priorNoShowCount: careCase.member.priorNoShowCount,
      },
      referral: {
        behavioralHealthNeed: careCase.referral.behavioralHealthNeed,
        specialty: careCase.referral.specialty,
        urgency: careCase.referral.urgency,
        networkRequired: careCase.referral.networkRequired,
        eligibilityVerified: careCase.referral.eligibilityVerified,
      },
      barriers: careCase.barriers.map((b) => ({
        category: b.category,
        subBarrier: b.subBarrier,
        epistemicStatus: b.epistemicStatus,
        confirmedByHuman: b.confirmedByHuman,
        resolved: b.resolved,
        confidence: b.confidence,
        evidenceSignals: Array.isArray(b.evidenceSignals)
          ? b.evidenceSignals.map(String)
          : [],
      })),
      interventions: careCase.interventions.map((i) => ({
        type: i.type,
        status: i.status,
        createdAt: i.createdAt,
        outcomes: i.outcomes.map((o) => ({ outcomeStatus: o.outcomeStatus })),
      })),
      appointments: careCase.appointments.map((a) => ({
        id: a.id,
        status: a.status,
        scheduledStartAt: a.scheduledStartAt,
      })),
      verifications: careCase.verifications.map((v) => ({
        id: v.id,
        verified: v.verified,
        verificationStatus: v.verificationStatus,
        signalType: v.signalType,
        verifiedAt: v.verifiedAt,
      })),
      riskAssessments: careCase.riskAssessments.map((r) => ({
        riskLevel: r.riskLevel,
        score: r.score,
      })),
    });

    const orchestratorInput = CareLoopCaseOrchestrator.buildInput({
      id: careCase.id,
      goal: careCase.goal,
      status: careCase.status,
      riskLevel: careCase.riskLevel,
      priorityScore: careCase.priorityScore,
      humanReviewRequired: careCase.humanReviewRequired,
      matchedProviderId: careCase.matchedProviderId,
      firstCompletedVisitAt: careCase.firstCompletedVisitAt,
      member: {
        preferredLanguage: careCase.member.preferredLanguage,
        urbanicity: careCase.member.urbanicity,
        digitalAccessLevel: careCase.member.digitalAccessLevel,
        transportationAccess: careCase.member.transportationAccess,
        consentOutreach: careCase.member.consentOutreach,
        consentSms: careCase.member.consentSms,
        priorNoShowCount: careCase.member.priorNoShowCount,
      },
      referral: {
        behavioralHealthNeed: careCase.referral.behavioralHealthNeed,
        specialty: careCase.referral.specialty,
        urgency: careCase.referral.urgency,
        geography: careCase.referral.geography,
        networkRequired: careCase.referral.networkRequired,
        eligibilityVerified: careCase.referral.eligibilityVerified,
      },
      barriers: careCase.barriers.map((b) => ({
        category: b.category,
        subBarrier: b.subBarrier,
        epistemicStatus: b.epistemicStatus,
        confirmedByHuman: b.confirmedByHuman,
        resolved: b.resolved,
      })),
      riskAssessments: careCase.riskAssessments.map((r) => ({
        riskLevel: r.riskLevel,
        score: r.score,
      })),
      interventions: careCase.interventions.map((i) => ({
        type: i.type,
        status: i.status,
        outcomes: i.outcomes.map((o) => ({ outcomeStatus: o.outcomeStatus })),
      })),
      appointments: careCase.appointments.map((a) => ({
        status: a.status,
      })),
      verifications: careCase.verifications.map((v) => ({
        verified: v.verified,
        verificationStatus: v.verificationStatus,
      })),
    });

    return {
      caseContext,
      orchestratorInput,
      caseRecord: {
        id: careCase.id,
        tenantId: careCase.tenantId,
        status: careCase.status,
        riskLevel: careCase.riskLevel,
        priorityScore: careCase.priorityScore,
        goal: careCase.goal,
        humanReviewRequired: careCase.humanReviewRequired,
        matchedProviderId: careCase.matchedProviderId,
        firstCompletedVisitAt: careCase.firstCompletedVisitAt,
        member: {
          consentOutreach: careCase.member.consentOutreach,
          consentSms: careCase.member.consentSms,
        },
        referral: {
          specialty: careCase.referral.specialty,
        },
      },
    };
  }
}

export class CareLoopPlanner implements Planner {
  plan(input: CaseOrchestratorInput): CaseOrchestratorDecision {
    return CareLoopCaseOrchestrator.decideNextStep(input);
  }
}

export class CareLoopDecisionValidator implements DecisionValidator {
  validate(params: {
    decision: CaseOrchestratorDecision | string;
    currentState: CaseStatus;
    riskTier?: string;
    consentOutreach?: boolean;
    hasVerifiedCompletion?: boolean;
    verifiedAvailableSlotsCount?: number;
    humanApproved?: boolean;
  }): DecisionValidationResult {
    const errors: string[] = [];
    const policyCtx = {
      riskTier: params.riskTier,
      consentOutreach: params.consentOutreach,
      hasVerifiedCompletion: params.hasVerifiedCompletion,
      verifiedAvailableSlotsCount: params.verifiedAvailableSlotsCount,
      humanApproved: params.humanApproved,
    };

    let validated: CaseOrchestratorDecision;
    if (typeof params.decision === "string") {
      validated = parseExternalOrchestratorDecision(params.decision, policyCtx);
    } else {
      const parsed = CaseOrchestratorDecisionSchema.parse(params.decision);
      validated = enforceOrchestratorDecisionPolicy(parsed, policyCtx);
    }

    if (validated.proposed_next_state) {
      if (!canTransitionCaseStatus(params.currentState, validated.proposed_next_state)) {
        errors.push(
          `Invalid proposed case state transition: ${params.currentState} -> ${validated.proposed_next_state}.`
        );
      } else {
        try {
          validateAgentProposedTransition(params.currentState, validated.proposed_next_state);
        } catch (err) {
          errors.push(err instanceof Error ? err.message : "State transition validation failed.");
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(errors.join(" "), { errors });
    }

    return {
      valid: true,
      decision: validated,
      errors: [],
    };
  }
}

export class CareLoopPolicyGate implements PolicyGate {
  evaluate(params: {
    session: SessionUser;
    context: AssembledRuntimeContext;
    decision: CaseOrchestratorDecision;
    channel?: "SMS" | "PHONE" | "EMAIL" | "PORTAL" | "IN_PERSON_NAVIGATOR";
    sensitiveCommunication?: boolean;
    humanApproved?: boolean;
  }): PolicyDecision {
    const toolDef = getToolDefinition(params.decision.tool);

    return careLoopPolicyEvaluator.evaluate({
      action: params.decision.tool,
      userRole: params.session.role,
      agentIdentity: {
        isServiceIdentity: params.session.role === "AGENT_SERVICE",
        serviceId: "CareLoopCaseOrchestrator",
      },
      caseState: params.decision.current_state,
      actionRisk: toolDef.risk_level,
      riskTier: params.context.caseRecord.riskLevel,
      memberConsent: {
        consentOutreach: params.context.caseRecord.member.consentOutreach,
        consentSms: params.context.caseRecord.member.consentSms,
      },
      consentOutreach: params.context.caseRecord.member.consentOutreach,
      consentSms: params.context.caseRecord.member.consentSms,
      channel: params.channel,
      communicationChannel: params.channel,
      sensitiveCommunication: params.sensitiveCommunication,
      matchedProviderId: params.context.caseRecord.matchedProviderId,
      verifiedAvailableSlotsCount:
        params.context.orchestratorInput.referral_context.verifiedAvailableSlotsCount,
      hasVerifiedCompletion: Boolean(params.context.caseRecord.firstCompletedVisitAt),
      humanApproved: params.humanApproved ?? false,
      policyCheckRequired: params.decision.policy_check_required,
      phiAccess: {
        containsPhi: true,
        phiMinimized: true,
        externalEgress: false,
        baaExecuted: true,
      },
    });
  }
}

export class CareLoopRuntimeToolExecutor implements RuntimeToolExecutor {
  private readonly executor = new CareLoopToolExecutor();

  execute(session: SessionUser, call: ToolCall): Promise<ToolResult> {
    return this.executor.execute(session, call);
  }
}

export class PrismaStateManager implements StateManager {
  async createRun(params: {
    tenantId: string;
    caseId: string;
    agent: string;
    model: string;
    promptVersion: string;
    goal: string;
    maxRetries?: number;
    correlationId?: string | null;
    checkpoint: AgentRunCheckpoint;
  }): Promise<AgentRun> {
    return prisma.agentRun.create({
      data: {
        tenantId: params.tenantId,
        caseId: params.caseId,
        agent: params.agent || "CareLoopCaseOrchestrator",
        model: params.model || ORCHESTRATOR_MODEL_DEFAULT,
        promptVersion: params.promptVersion || ORCHESTRATOR_PROMPT_VERSION,
        status: "STARTED",
        goal: params.goal,
        currentStep: params.checkpoint.step,
        checkpointJson: params.checkpoint as unknown as Prisma.InputJsonValue,
        maxRetries: params.maxRetries ?? 3,
        correlationId: params.correlationId ?? null,
        startedAt: new Date(),
      },
    });
  }

  async getRun(tenantId: string, runId: string): Promise<AgentRun> {
    const run = await prisma.agentRun.findFirst({
      where: { id: runId, tenantId },
    });
    if (!run) {
      throw new NotFoundError("AgentRun", runId);
    }
    return run;
  }

  async saveCheckpoint(params: {
    runId: string;
    status?: AgentRun["status"];
    currentStep: string;
    checkpoint: AgentRunCheckpoint;
    decisionTraceId?: string | null;
    approvalRequestId?: string | null;
    policyResult?: string | null;
    retryCount?: number;
    errorMessage?: string | null;
    lastError?: string | null;
    pausedAt?: Date | null;
    cancelledAt?: Date | null;
    escalatedAt?: Date | null;
    completedAt?: Date | null;
    latencyMs?: number | null;
    tokenUsage?: TokenUsageInput;
  }): Promise<AgentRun> {
    return prisma.agentRun.update({
      where: { id: params.runId },
      data: {
        ...(params.status ? { status: params.status } : {}),
        currentStep: params.currentStep,
        checkpointJson: params.checkpoint as unknown as Prisma.InputJsonValue,
        ...(params.decisionTraceId !== undefined
          ? { decisionTraceId: params.decisionTraceId }
          : {}),
        ...(params.approvalRequestId !== undefined
          ? { approvalRequestId: params.approvalRequestId }
          : {}),
        ...(params.policyResult !== undefined ? { policyResult: params.policyResult } : {}),
        ...(params.retryCount !== undefined ? { retryCount: params.retryCount } : {}),
        ...(params.errorMessage !== undefined
          ? { errorMessage: params.errorMessage ? params.errorMessage.slice(0, 500) : null }
          : {}),
        ...(params.lastError !== undefined
          ? { lastError: params.lastError ? params.lastError.slice(0, 500) : null }
          : {}),
        ...(params.pausedAt !== undefined ? { pausedAt: params.pausedAt } : {}),
        ...(params.cancelledAt !== undefined ? { cancelledAt: params.cancelledAt } : {}),
        ...(params.escalatedAt !== undefined ? { escalatedAt: params.escalatedAt } : {}),
        ...(params.completedAt !== undefined ? { completedAt: params.completedAt } : {}),
        ...(params.latencyMs !== undefined ? { latencyMs: params.latencyMs } : {}),
        ...(params.tokenUsage
          ? {
              promptTokens: params.tokenUsage.promptTokens ?? 0,
              completionTokens: params.tokenUsage.completionTokens ?? 0,
              totalTokens:
                params.tokenUsage.totalTokens ??
                (params.tokenUsage.promptTokens ?? 0) +
                  (params.tokenUsage.completionTokens ?? 0),
            }
          : {}),
      },
    });
  }
}

export class CareLoopApprovalManager implements ApprovalManager {
  requestApproval(params: {
    session: SessionUser;
    caseId: string;
    action: CaseOrchestratorTool;
    reason: string;
    riskLevel: string;
    requestedBy: string;
    toolInput?: Record<string, unknown>;
    proposedNextState?: CaseStatus | null;
    orchestratorSnapshot?: CaseOrchestratorDecision;
    correlationId?: string;
    idempotencyKey?: string;
  }): Promise<ApprovalRecord> {
    return requestHumanApproval(params);
  }

  getApproval(session: SessionUser, approvalId: string): Promise<ApprovalRecord> {
    return getApprovalRecord(session, approvalId);
  }

  cancelPendingApproval(params: {
    session: SessionUser;
    approvalId: string;
    comments?: string;
    correlationId?: string;
  }): Promise<ApprovalRecord> {
    return cancelHumanApproval(params);
  }
}

export class CareLoopEvidenceManager implements EvidenceManager {
  async record(params: {
    tenantId: string;
    caseId: string;
    agentRunId?: string | null;
    sourceType: string;
    summary: string;
    payload?: Prisma.InputJsonValue;
    capturedBy: string;
  }): Promise<{ id: string; payloadHash: string }> {
    const created = await prismaEvidenceStore.record(params);
    return { id: created.id, payloadHash: created.payloadHash };
  }
}

export class CareLoopExecutionJournal implements ExecutionJournal {
  record(params: {
    tenantId: string;
    caseId: string;
    actorType: ExecutionActorType;
    actorId: string;
    eventType: string;
    inputReference?: string | null;
    outputReference?: string | null;
    policyDecision?: string | null;
    evidence?: unknown[];
    correlationId?: string | null;
  }): Promise<ExecutionJournalEntry> {
    return recordExecutionEvent(params);
  }
}
