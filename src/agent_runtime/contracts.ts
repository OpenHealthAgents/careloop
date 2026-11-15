import type { AgentRunStatus, CaseStatus, ExecutionActorType, Prisma } from "@prisma/client";
import type { CaseOrchestratorTool } from "@/ai";
import type { CaseOrchestratorInput } from "@/ai/orchestrator";
import type { CaseOrchestratorDecision } from "@/ai/schemas";
import type { CaseContext } from "@/domain/cases/context-assembler";
import type { SessionUser } from "@/lib/auth/session";
import type { PolicyDecision } from "@/policy/contracts";
import type { ApprovalRecord } from "@/services/approval-service";
import type { ExecutionJournalEntry } from "@/services/execution-journal-service";
import type { TokenUsageInput } from "@/services/observability-service";
import type { ToolCall, ToolResult } from "@/tools/contracts";

export interface AgentRunCheckpoint {
  step: string;
  goal: string;
  caseStatus: CaseStatus;
  contextHash?: string;
  contextVersion?: string;
  decision?: CaseOrchestratorDecision;
  toolInput?: Record<string, unknown>;
  sensitiveCommunication?: boolean;
  policyDecision?: PolicyDecision["effect"];
  approvalId?: string;
  decisionTraceId?: string;
  lastToolResult?: ToolResult;
  lastError?: string;
  pauseReason?: string;
  escalationReason?: string;
  updatedAt: string;
}

export interface AgentRun {
  id: string;
  tenantId: string;
  caseId: string;
  agent: string;
  model: string;
  promptVersion: string;
  status: AgentRunStatus;
  goal?: string | null;
  currentStep?: string;
  checkpointJson?: unknown;
  correlationId?: string | null;
  decisionTraceId?: string | null;
  approvalRequestId?: string | null;
  policyResult?: string | null;
  latencyMs?: number | null;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  retryCount?: number;
  maxRetries?: number;
  errorMessage?: string | null;
  lastError?: string | null;
  startedAt: Date;
  pausedAt?: Date | null;
  cancelledAt?: Date | null;
  escalatedAt?: Date | null;
  completedAt?: Date | null;
}

export interface GoalResolution {
  goal: string;
  targetState: CaseStatus;
  achieved: boolean;
  remainingMilestones: string[];
}

export interface GoalManager {
  resolveGoal(params: {
    caseId: string;
    currentState: CaseStatus;
    explicitGoal?: string | null;
    specialty?: string;
    hasVerifiedCompletion?: boolean;
  }): GoalResolution;
  isGoalAchieved(currentState: CaseStatus, hasVerifiedCompletion?: boolean): boolean;
}

export interface AssembledRuntimeContext {
  caseContext: CaseContext;
  orchestratorInput: CaseOrchestratorInput;
  caseRecord: {
    id: string;
    tenantId: string;
    status: CaseStatus;
    riskLevel: string;
    priorityScore: number;
    goal: string | null;
    humanReviewRequired: boolean;
    matchedProviderId: string | null;
    firstCompletedVisitAt: Date | null;
    member: {
      consentOutreach: boolean;
      consentSms: boolean;
    };
    referral: {
      specialty: string;
    };
  };
}

export interface ContextAssembler {
  assemble(params: {
    tenantId: string;
    caseId: string;
  }): Promise<AssembledRuntimeContext>;
}

export interface Planner {
  plan(input: CaseOrchestratorInput): Promise<CaseOrchestratorDecision> | CaseOrchestratorDecision;
}

export interface DecisionValidationResult {
  valid: boolean;
  decision: CaseOrchestratorDecision;
  errors: string[];
}

export interface DecisionValidator {
  validate(params: {
    decision: CaseOrchestratorDecision | string;
    currentState: CaseStatus;
    riskTier?: string;
    consentOutreach?: boolean;
    hasVerifiedCompletion?: boolean;
    verifiedAvailableSlotsCount?: number;
    humanApproved?: boolean;
  }): DecisionValidationResult;
}

export interface PolicyGate {
  evaluate(params: {
    session: SessionUser;
    context: AssembledRuntimeContext;
    decision: CaseOrchestratorDecision;
    channel?: "SMS" | "PHONE" | "EMAIL" | "PORTAL" | "IN_PERSON_NAVIGATOR";
    sensitiveCommunication?: boolean;
    humanApproved?: boolean;
  }): PolicyDecision;
}

export interface RuntimeToolExecutor {
  execute(session: SessionUser, call: ToolCall): Promise<ToolResult>;
}

export interface StateManager {
  createRun(params: {
    tenantId: string;
    caseId: string;
    agent: string;
    model: string;
    promptVersion: string;
    goal: string;
    maxRetries?: number;
    correlationId?: string | null;
    checkpoint: AgentRunCheckpoint;
  }): Promise<AgentRun>;
  getRun(tenantId: string, runId: string): Promise<AgentRun>;
  saveCheckpoint(params: {
    runId: string;
    status?: AgentRunStatus;
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
  }): Promise<AgentRun>;
}

export interface ApprovalManager {
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
  }): Promise<ApprovalRecord>;
  getApproval(session: SessionUser, approvalId: string): Promise<ApprovalRecord>;
  cancelPendingApproval(params: {
    session: SessionUser;
    approvalId: string;
    comments?: string;
    correlationId?: string;
  }): Promise<ApprovalRecord>;
}

export interface EvidenceManager {
  record(params: {
    tenantId: string;
    caseId: string;
    agentRunId?: string | null;
    sourceType: string;
    summary: string;
    payload?: Prisma.InputJsonValue;
    capturedBy: string;
  }): Promise<{ id: string; payloadHash: string }>;
}

export interface ExecutionJournal {
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
  }): Promise<ExecutionJournalEntry>;
}

export interface StartAgentRunRequest {
  session: SessionUser;
  caseId: string;
  agent?: string;
  model?: string;
  promptVersion?: string;
  toolInput?: Record<string, unknown>;
  sensitiveCommunication?: boolean;
  pauseAfterPlan?: boolean;
  maxRetries?: number;
  correlationId?: string;
}

export interface AgentRuntimeResult {
  run: AgentRun;
  goal: GoalResolution;
  decision?: CaseOrchestratorDecision;
  policyDecision?: PolicyDecision;
  approval?: ApprovalRecord;
  toolResult?: ToolResult;
  replayed?: boolean;
}

export interface AgentRuntime {
  start(params: StartAgentRunRequest): Promise<AgentRuntimeResult>;
  pause(params: {
    session: SessionUser;
    runId: string;
    reason: string;
    correlationId?: string;
  }): Promise<AgentRuntimeResult>;
  resume(params: {
    session: SessionUser;
    runId: string;
    correlationId?: string;
  }): Promise<AgentRuntimeResult>;
  retry(params: {
    session: SessionUser;
    runId: string;
    toolInputOverride?: Record<string, unknown>;
    correlationId?: string;
  }): Promise<AgentRuntimeResult>;
  cancel(params: {
    session: SessionUser;
    runId: string;
    reason?: string;
    correlationId?: string;
  }): Promise<AgentRuntimeResult>;
  complete(params: {
    session: SessionUser;
    runId: string;
    summary?: string;
    correlationId?: string;
  }): Promise<AgentRuntimeResult>;
  fail(params: {
    session: SessionUser;
    runId: string;
    errorMessage: string;
    correlationId?: string;
  }): Promise<AgentRuntimeResult>;
  escalate(params: {
    session: SessionUser;
    runId: string;
    reason: string;
    correlationId?: string;
  }): Promise<AgentRuntimeResult>;

  // Backward-compatible low-level observability helpers
  startRun(params: {
    tenantId: string;
    caseId: string;
    agent?: string;
    model?: string;
    promptVersion?: string;
    correlationId?: string | null;
  }): Promise<AgentRun>;
  completeRun(params: {
    agentRunId: string;
    status: "COMPLETED" | "AWAITING_APPROVAL";
    startedAt: Date;
    decisionTraceId?: string;
    approvalRequestId?: string;
    policyResult?: string;
    retryCount?: number;
    tokenUsage?: TokenUsageInput;
  }): Promise<AgentRun>;
  failRun(params: {
    agentRunId: string;
    startedAt: Date;
    errorMessage: string;
    retryCount?: number;
  }): Promise<AgentRun>;
}
