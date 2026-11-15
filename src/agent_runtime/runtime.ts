import { AgentRunStatus, Prisma } from "@prisma/client";
import {
  CaseOrchestratorDecision,
  ORCHESTRATOR_MODEL_DEFAULT,
  ORCHESTRATOR_PROMPT_VERSION,
} from "@/ai";
import { getToolDefinition } from "@/ai/tool-registry";
import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { PolicyDecision } from "@/policy";
import { recordAuditEvent } from "@/services/audit-service";
import { recordAIDecisionTrace } from "@/services/decision-trace-service";
import { EXECUTION_JOURNAL_EVENT_TYPES } from "@/services/execution-journal-service";
import {
  completeAgentRun,
  failAgentRun,
  startAgentRun,
  TokenUsageInput,
} from "@/services/observability-service";
import { ToolResult } from "@/tools";
import {
  CareLoopApprovalManager,
  CareLoopContextAssembler,
  CareLoopDecisionValidator,
  CareLoopEvidenceManager,
  CareLoopExecutionJournal,
  CareLoopGoalManager,
  CareLoopPlanner,
  CareLoopPolicyGate,
  CareLoopRuntimeToolExecutor,
  PrismaStateManager,
} from "./components";
import type {
  AgentRun,
  AgentRunCheckpoint,
  AgentRuntime,
  AgentRuntimeResult,
  ApprovalManager,
  ContextAssembler,
  DecisionValidator,
  EvidenceManager,
  ExecutionJournal,
  GoalManager,
  Planner,
  PolicyGate,
  RuntimeToolExecutor,
  StateManager,
  StartAgentRunRequest,
} from "./contracts";

export interface CareLoopAgentRuntimeDeps {
  goalManager?: GoalManager;
  contextAssembler?: ContextAssembler;
  planner?: Planner;
  decisionValidator?: DecisionValidator;
  policyGate?: PolicyGate;
  toolExecutor?: RuntimeToolExecutor;
  stateManager?: StateManager;
  approvalManager?: ApprovalManager;
  evidenceManager?: EvidenceManager;
  executionJournal?: ExecutionJournal;
}

const TERMINAL_RUN_STATUSES = new Set<AgentRunStatus>([
  "COMPLETED",
  "CANCELLED",
  "ESCALATED",
]);

function parseCheckpoint(raw: unknown, fallback: Partial<AgentRunCheckpoint>): AgentRunCheckpoint {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    return {
      step: typeof obj.step === "string" ? obj.step : (fallback.step ?? "INITIALIZED"),
      goal: typeof obj.goal === "string" ? obj.goal : (fallback.goal ?? ""),
      caseStatus: (obj.caseStatus as AgentRunCheckpoint["caseStatus"]) ?? fallback.caseStatus ?? "NEW",
      contextHash: typeof obj.contextHash === "string" ? obj.contextHash : undefined,
      contextVersion: typeof obj.contextVersion === "string" ? obj.contextVersion : undefined,
      decision: obj.decision as CaseOrchestratorDecision | undefined,
      toolInput:
        obj.toolInput && typeof obj.toolInput === "object"
          ? (obj.toolInput as Record<string, unknown>)
          : undefined,
      sensitiveCommunication:
        typeof obj.sensitiveCommunication === "boolean"
          ? obj.sensitiveCommunication
          : undefined,
      policyDecision: obj.policyDecision as PolicyDecision["effect"] | undefined,
      approvalId: typeof obj.approvalId === "string" ? obj.approvalId : undefined,
      decisionTraceId: typeof obj.decisionTraceId === "string" ? obj.decisionTraceId : undefined,
      lastToolResult: obj.lastToolResult as ToolResult | undefined,
      lastError: typeof obj.lastError === "string" ? obj.lastError : undefined,
      pauseReason: typeof obj.pauseReason === "string" ? obj.pauseReason : undefined,
      escalationReason: typeof obj.escalationReason === "string" ? obj.escalationReason : undefined,
      updatedAt:
        typeof obj.updatedAt === "string" ? obj.updatedAt : new Date().toISOString(),
    };
  }
  return {
    step: fallback.step ?? "INITIALIZED",
    goal: fallback.goal ?? "",
    caseStatus: fallback.caseStatus ?? "NEW",
    updatedAt: new Date().toISOString(),
  };
}

export class CareLoopAgentRuntime implements AgentRuntime {
  public readonly goalManager: GoalManager;
  public readonly contextAssembler: ContextAssembler;
  public readonly planner: Planner;
  public readonly decisionValidator: DecisionValidator;
  public readonly policyGate: PolicyGate;
  public readonly toolExecutor: RuntimeToolExecutor;
  public readonly stateManager: StateManager;
  public readonly approvalManager: ApprovalManager;
  public readonly evidenceManager: EvidenceManager;
  public readonly executionJournal: ExecutionJournal;

  constructor(deps: CareLoopAgentRuntimeDeps = {}) {
    this.goalManager = deps.goalManager ?? new CareLoopGoalManager();
    this.contextAssembler = deps.contextAssembler ?? new CareLoopContextAssembler();
    this.planner = deps.planner ?? new CareLoopPlanner();
    this.decisionValidator = deps.decisionValidator ?? new CareLoopDecisionValidator();
    this.policyGate = deps.policyGate ?? new CareLoopPolicyGate();
    this.toolExecutor = deps.toolExecutor ?? new CareLoopRuntimeToolExecutor();
    this.stateManager = deps.stateManager ?? new PrismaStateManager();
    this.approvalManager = deps.approvalManager ?? new CareLoopApprovalManager();
    this.evidenceManager = deps.evidenceManager ?? new CareLoopEvidenceManager();
    this.executionJournal = deps.executionJournal ?? new CareLoopExecutionJournal();
  }

  async start(params: StartAgentRunRequest): Promise<AgentRuntimeResult> {
    requirePermission(params.session, PERMISSIONS.AI_RUN);

    const agentName = params.agent ?? "CareLoopCaseOrchestrator";
    const model = params.model ?? ORCHESTRATOR_MODEL_DEFAULT;
    const promptVersion = params.promptVersion ?? ORCHESTRATOR_PROMPT_VERSION;

    const context = await this.contextAssembler.assemble({
      tenantId: params.session.tenantId,
      caseId: params.caseId,
    });

    const goal = this.goalManager.resolveGoal({
      caseId: context.caseRecord.id,
      currentState: context.caseRecord.status,
      explicitGoal: context.caseRecord.goal,
      specialty: context.caseRecord.referral.specialty,
      hasVerifiedCompletion: Boolean(context.caseRecord.firstCompletedVisitAt),
    });

    const initialCheckpoint: AgentRunCheckpoint = {
      step: "STARTED",
      goal: goal.goal,
      caseStatus: context.caseRecord.status,
      contextHash: context.caseContext.contextHash,
      contextVersion: context.caseContext.contextVersion,
      toolInput: params.toolInput,
      sensitiveCommunication: params.sensitiveCommunication,
      updatedAt: new Date().toISOString(),
    };

    const run = await this.stateManager.createRun({
      tenantId: params.session.tenantId,
      caseId: context.caseRecord.id,
      agent: agentName,
      model,
      promptVersion,
      goal: goal.goal,
      maxRetries: params.maxRetries ?? 3,
      correlationId: params.correlationId ?? null,
      checkpoint: initialCheckpoint,
    });

    await this.executionJournal.record({
      tenantId: params.session.tenantId,
      caseId: context.caseRecord.id,
      actorType: "AGENT",
      actorId: agentName,
      eventType: EXECUTION_JOURNAL_EVENT_TYPES.AGENT_STARTED,
      inputReference: `agent_run:${run.id}`,
      outputReference: `context:${context.caseContext.contextHash.slice(0, 12)}`,
      evidence: [`goal=${goal.goal}`, `state=${context.caseRecord.status}`],
      correlationId: params.correlationId ?? null,
    });

    return this.executeStep({
      session: params.session,
      run,
      context,
      goal,
      toolInput: params.toolInput,
      sensitiveCommunication: params.sensitiveCommunication,
      pauseAfterPlan: params.pauseAfterPlan,
      correlationId: params.correlationId,
    });
  }

  private async executeStep(params: {
    session: SessionUser;
    run: AgentRun;
    context: Awaited<ReturnType<ContextAssembler["assemble"]>>;
    goal: ReturnType<GoalManager["resolveGoal"]>;
    toolInput?: Record<string, unknown>;
    sensitiveCommunication?: boolean;
    pauseAfterPlan?: boolean;
    humanApproved?: boolean;
    approvalId?: string;
    correlationId?: string;
  }): Promise<AgentRuntimeResult> {
    const { session, run, context, goal } = params;

    try {
      const rawDecision = await this.planner.plan(context.orchestratorInput);
      const validation = this.decisionValidator.validate({
        decision: rawDecision,
        currentState: context.caseRecord.status,
        riskTier: context.caseRecord.riskLevel,
        consentOutreach: context.caseRecord.member.consentOutreach,
        hasVerifiedCompletion: Boolean(context.caseRecord.firstCompletedVisitAt),
        verifiedAvailableSlotsCount:
          context.orchestratorInput.referral_context.verifiedAvailableSlotsCount,
        humanApproved: params.humanApproved,
      });
      const decision = validation.decision;

      const policyDecision = this.policyGate.evaluate({
        session,
        context,
        decision,
        channel:
          typeof params.toolInput?.channel === "string"
            ? (params.toolInput.channel as "SMS" | "PHONE" | "EMAIL" | "PORTAL" | "IN_PERSON_NAVIGATOR")
            : undefined,
        sensitiveCommunication: params.sensitiveCommunication,
        humanApproved: params.humanApproved,
      });

      const trace = await recordAIDecisionTrace({
        tenantId: session.tenantId,
        caseId: context.caseRecord.id,
        agent: run.agent,
        model: run.model,
        promptVersion: run.promptVersion,
        inputContext: context.orchestratorInput,
        decision: `${decision.recommended_action}: ${decision.reason}`,
        confidence: decision.confidence,
        evidence: decision.evidence,
        policyResult: policyDecision.effect,
        toolSelected: decision.tool,
        humanApprovalRequired: policyDecision.requiresApproval || decision.requires_human,
        correlationId: params.correlationId ?? run.correlationId ?? null,
      });

      await this.evidenceManager.record({
        tenantId: session.tenantId,
        caseId: context.caseRecord.id,
        agentRunId: run.id,
        sourceType: "AGENT_RUNTIME_DECISION",
        summary: `Planned ${decision.tool} (${policyDecision.effect})`,
        payload: {
          runId: run.id,
          decisionTraceId: trace.decision_id,
          tool: decision.tool,
          proposedNextState: decision.proposed_next_state,
          policyEffect: policyDecision.effect,
          contextHash: context.caseContext.contextHash,
        } as unknown as Prisma.InputJsonValue,
        capturedBy: run.agent,
      });

      if (params.pauseAfterPlan) {
        const checkpoint: AgentRunCheckpoint = {
          step: "PAUSED_AFTER_PLAN",
          goal: goal.goal,
          caseStatus: context.caseRecord.status,
          contextHash: context.caseContext.contextHash,
          contextVersion: context.caseContext.contextVersion,
          decision,
          toolInput: params.toolInput,
          sensitiveCommunication: params.sensitiveCommunication,
          policyDecision: policyDecision.effect,
          decisionTraceId: trace.decision_id,
          pauseReason: "Paused after planning for checkpointed continuation.",
          updatedAt: new Date().toISOString(),
        };

        const pausedRun = await this.stateManager.saveCheckpoint({
          runId: run.id,
          status: "PAUSED",
          currentStep: "PAUSED_AFTER_PLAN",
          checkpoint,
          decisionTraceId: trace.decision_id,
          policyResult: policyDecision.effect,
          pausedAt: new Date(),
        });

        await this.executionJournal.record({
          tenantId: session.tenantId,
          caseId: context.caseRecord.id,
          actorType: "AGENT",
          actorId: run.agent,
          eventType: EXECUTION_JOURNAL_EVENT_TYPES.AGENT_PAUSED,
          inputReference: `agent_run:${run.id}`,
          outputReference: `decision:${trace.decision_id}`,
          policyDecision: policyDecision.effect,
          evidence: [`step=PAUSED_AFTER_PLAN`],
          correlationId: params.correlationId ?? run.correlationId ?? null,
        });

        return { run: pausedRun, goal, decision, policyDecision };
      }

      if (policyDecision.effect === "DENY") {
        const errorMsg = `Policy denied tool '${decision.tool}': ${policyDecision.reason}`;
        const checkpoint: AgentRunCheckpoint = {
          step: "POLICY_DENIED",
          goal: goal.goal,
          caseStatus: context.caseRecord.status,
          contextHash: context.caseContext.contextHash,
          contextVersion: context.caseContext.contextVersion,
          decision,
          toolInput: params.toolInput,
          policyDecision: policyDecision.effect,
          decisionTraceId: trace.decision_id,
          lastError: errorMsg,
          updatedAt: new Date().toISOString(),
        };

        const failedRun = await this.stateManager.saveCheckpoint({
          runId: run.id,
          status: "FAILED",
          currentStep: "POLICY_DENIED",
          checkpoint,
          decisionTraceId: trace.decision_id,
          policyResult: policyDecision.effect,
          errorMessage: errorMsg,
          lastError: errorMsg,
          completedAt: new Date(),
          latencyMs: Math.max(0, Date.now() - run.startedAt.getTime()),
        });

        await this.executionJournal.record({
          tenantId: session.tenantId,
          caseId: context.caseRecord.id,
          actorType: "SYSTEM",
          actorId: "CareLoopPolicyGate",
          eventType: EXECUTION_JOURNAL_EVENT_TYPES.AGENT_FAILED,
          inputReference: `agent_run:${run.id}`,
          outputReference: `tool:${decision.tool}`,
          policyDecision: "DENY",
          evidence: [errorMsg],
          correlationId: params.correlationId ?? run.correlationId ?? null,
        });

        return { run: failedRun, goal, decision, policyDecision };
      }

      if (policyDecision.effect === "REQUIRE_HUMAN") {
        const checkpoint: AgentRunCheckpoint = {
          step: "ESCALATED_TO_HUMAN",
          goal: goal.goal,
          caseStatus: context.caseRecord.status,
          contextHash: context.caseContext.contextHash,
          contextVersion: context.caseContext.contextVersion,
          decision,
          toolInput: params.toolInput,
          policyDecision: policyDecision.effect,
          decisionTraceId: trace.decision_id,
          escalationReason: policyDecision.reason,
          updatedAt: new Date().toISOString(),
        };

        await this.stateManager.saveCheckpoint({
          runId: run.id,
          currentStep: "ESCALATING",
          checkpoint,
          decisionTraceId: trace.decision_id,
          policyResult: policyDecision.effect,
        });

        return this.escalate({
          session,
          runId: run.id,
          reason: policyDecision.reason,
          correlationId: params.correlationId,
        });
      }

      if (policyDecision.effect === "REQUIRE_APPROVAL" || decision.requires_human) {
        const approval = await this.approvalManager.requestApproval({
          session,
          caseId: context.caseRecord.id,
          action: decision.tool,
          reason: decision.reason,
          riskLevel: getToolDefinition(decision.tool).risk_level,
          requestedBy: run.agent,
          toolInput: params.toolInput,
          proposedNextState: decision.proposed_next_state ?? null,
          orchestratorSnapshot: decision,
          correlationId: params.correlationId ?? run.correlationId ?? undefined,
          idempotencyKey: `runtime-run-${run.id}-${decision.tool}`,
        });

        const checkpoint: AgentRunCheckpoint = {
          step: "AWAITING_APPROVAL",
          goal: goal.goal,
          caseStatus: context.caseRecord.status,
          contextHash: context.caseContext.contextHash,
          contextVersion: context.caseContext.contextVersion,
          decision,
          toolInput: params.toolInput,
          sensitiveCommunication: params.sensitiveCommunication,
          policyDecision: policyDecision.effect,
          approvalId: approval.approval_id,
          decisionTraceId: trace.decision_id,
          updatedAt: new Date().toISOString(),
        };

        const waitingRun = await this.stateManager.saveCheckpoint({
          runId: run.id,
          status: "AWAITING_APPROVAL",
          currentStep: "AWAITING_APPROVAL",
          checkpoint,
          decisionTraceId: trace.decision_id,
          approvalRequestId: approval.approval_id,
          policyResult: policyDecision.effect,
          pausedAt: new Date(),
        });

        return {
          run: waitingRun,
          goal,
          decision,
          policyDecision,
          approval,
        };
      }

      let toolResult: ToolResult | undefined;
      if (params.toolInput) {
        toolResult = await this.toolExecutor.execute(session, {
          tool: decision.tool,
          input: params.toolInput,
          proposedNextState: decision.proposed_next_state ?? undefined,
          humanApproved: params.humanApproved,
          approvalId: params.approvalId,
          agentRunId: run.id,
          idempotencyKey: `runtime-${run.id}-retry-${run.retryCount ?? 0}-${decision.tool}`,
          correlationId: params.correlationId ?? run.correlationId ?? undefined,
        });

        if (!toolResult.success) {
          const errMessage = toolResult.error?.message ?? `Tool '${decision.tool}' failed`;
          const checkpoint: AgentRunCheckpoint = {
            step: "TOOL_EXECUTION_FAILED",
            goal: goal.goal,
            caseStatus: context.caseRecord.status,
            contextHash: context.caseContext.contextHash,
            contextVersion: context.caseContext.contextVersion,
            decision,
            toolInput: params.toolInput,
            sensitiveCommunication: params.sensitiveCommunication,
            policyDecision: policyDecision.effect,
            decisionTraceId: trace.decision_id,
            lastToolResult: toolResult,
            lastError: errMessage,
            updatedAt: new Date().toISOString(),
          };

          const failedRun = await this.stateManager.saveCheckpoint({
            runId: run.id,
            status: "FAILED",
            currentStep: "TOOL_EXECUTION_FAILED",
            checkpoint,
            decisionTraceId: trace.decision_id,
            policyResult: policyDecision.effect,
            errorMessage: errMessage,
            lastError: errMessage,
            completedAt: new Date(),
            latencyMs: Math.max(0, Date.now() - run.startedAt.getTime()),
          });

          await this.executionJournal.record({
            tenantId: session.tenantId,
            caseId: context.caseRecord.id,
            actorType: "AGENT",
            actorId: run.agent,
            eventType: EXECUTION_JOURNAL_EVENT_TYPES.AGENT_FAILED,
            inputReference: `agent_run:${run.id}`,
            outputReference: `tool:${decision.tool}`,
            policyDecision: policyDecision.effect,
            evidence: [errMessage],
            correlationId: params.correlationId ?? run.correlationId ?? null,
          });

          return { run: failedRun, goal, decision, policyDecision, toolResult };
        }

        await this.evidenceManager.record({
          tenantId: session.tenantId,
          caseId: context.caseRecord.id,
          agentRunId: run.id,
          sourceType: "AGENT_RUNTIME_TOOL_EXECUTION",
          summary: `Executed ${decision.tool} successfully`,
          payload: {
            runId: run.id,
            tool: decision.tool,
            replayed: Boolean(toolResult.metadata?.replayed),
            evidence: toolResult.evidence,
          } as unknown as Prisma.InputJsonValue,
          capturedBy: run.agent,
        });
      }

      const completedCheckpoint: AgentRunCheckpoint = {
        step: "COMPLETED",
        goal: goal.goal,
        caseStatus: context.caseRecord.status,
        contextHash: context.caseContext.contextHash,
        contextVersion: context.caseContext.contextVersion,
        decision,
        toolInput: params.toolInput,
        policyDecision: policyDecision.effect,
        decisionTraceId: trace.decision_id,
        lastToolResult: toolResult,
        updatedAt: new Date().toISOString(),
      };

      const completedRun = await this.stateManager.saveCheckpoint({
        runId: run.id,
        status: "COMPLETED",
        currentStep: "COMPLETED",
        checkpoint: completedCheckpoint,
        decisionTraceId: trace.decision_id,
        policyResult: policyDecision.effect,
        errorMessage: null,
        completedAt: new Date(),
        latencyMs: Math.max(0, Date.now() - run.startedAt.getTime()),
      });

      await this.executionJournal.record({
        tenantId: session.tenantId,
        caseId: context.caseRecord.id,
        actorType: "AGENT",
        actorId: run.agent,
        eventType: EXECUTION_JOURNAL_EVENT_TYPES.AGENT_COMPLETED,
        inputReference: `agent_run:${run.id}`,
        outputReference: `tool:${decision.tool}`,
        policyDecision: policyDecision.effect,
        evidence: [`step=COMPLETED`],
        correlationId: params.correlationId ?? run.correlationId ?? null,
      });

      return {
        run: completedRun,
        goal,
        decision,
        policyDecision,
        toolResult,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Agent runtime execution error";
      const existingCheckpoint = parseCheckpoint(run.checkpointJson, {
        step: "FAILED",
        goal: goal.goal,
        caseStatus: context.caseRecord.status,
      });

      const failedCheckpoint: AgentRunCheckpoint = {
        ...existingCheckpoint,
        step: "FAILED",
        lastError: errorMessage,
        updatedAt: new Date().toISOString(),
      };

      await this.stateManager.saveCheckpoint({
        runId: run.id,
        status: "FAILED",
        currentStep: "FAILED",
        checkpoint: failedCheckpoint,
        errorMessage,
        lastError: errorMessage,
        completedAt: new Date(),
        latencyMs: Math.max(0, Date.now() - run.startedAt.getTime()),
      });

      await this.executionJournal
        .record({
          tenantId: session.tenantId,
          caseId: context.caseRecord.id,
          actorType: "AGENT",
          actorId: run.agent,
          eventType: EXECUTION_JOURNAL_EVENT_TYPES.AGENT_FAILED,
          inputReference: `agent_run:${run.id}`,
          outputReference: "runtime:exception",
          evidence: [errorMessage],
          correlationId: params.correlationId ?? run.correlationId ?? null,
        })
        .catch(() => undefined);

      throw err;
    }
  }

  async pause(params: {
    session: SessionUser;
    runId: string;
    reason: string;
    correlationId?: string;
  }): Promise<AgentRuntimeResult> {
    requirePermission(params.session, PERMISSIONS.AI_RUN);
    const run = await this.stateManager.getRun(params.session.tenantId, params.runId);
    if (run.status !== "STARTED") {
      throw new ValidationError(
        `AgentRun '${run.id}' has status '${run.status}' and can only be paused from STARTED.`
      );
    }

    const checkpoint = parseCheckpoint(run.checkpointJson, {
      step: run.currentStep ?? "STARTED",
      goal: run.goal ?? "",
    });
    const updatedCheckpoint: AgentRunCheckpoint = {
      ...checkpoint,
      step: "PAUSED",
      pauseReason: params.reason,
      updatedAt: new Date().toISOString(),
    };

    const pausedRun = await this.stateManager.saveCheckpoint({
      runId: run.id,
      status: "PAUSED",
      currentStep: "PAUSED",
      checkpoint: updatedCheckpoint,
      pausedAt: new Date(),
    });

    await this.executionJournal.record({
      tenantId: params.session.tenantId,
      caseId: run.caseId,
      actorType: "AGENT",
      actorId: run.agent,
      eventType: EXECUTION_JOURNAL_EVENT_TYPES.AGENT_PAUSED,
      inputReference: `agent_run:${run.id}`,
      outputReference: "status:PAUSED",
      evidence: [params.reason],
      correlationId: params.correlationId ?? run.correlationId ?? null,
    });

    return {
      run: pausedRun,
      goal: this.goalManager.resolveGoal({
        caseId: run.caseId,
        currentState: updatedCheckpoint.caseStatus,
        explicitGoal: updatedCheckpoint.goal,
      }),
      decision: updatedCheckpoint.decision,
    };
  }

  async resume(params: {
    session: SessionUser;
    runId: string;
    correlationId?: string;
  }): Promise<AgentRuntimeResult> {
    requirePermission(params.session, PERMISSIONS.AI_RUN);
    const run = await this.stateManager.getRun(params.session.tenantId, params.runId);

    if (run.status !== "PAUSED" && run.status !== "AWAITING_APPROVAL") {
      throw new ValidationError(
        `AgentRun '${run.id}' has status '${run.status}' and cannot be resumed.`
      );
    }

    const checkpoint = parseCheckpoint(run.checkpointJson, {
      step: run.currentStep ?? run.status,
      goal: run.goal ?? "",
    });

    let humanApproved = false;
    let approvalId: string | undefined;

    if (run.status === "AWAITING_APPROVAL") {
      const targetApprovalId = run.approvalRequestId ?? checkpoint.approvalId;
      if (!targetApprovalId) {
        throw new ValidationError(
          `AgentRun '${run.id}' is AWAITING_APPROVAL without an approvalRequestId.`
        );
      }
      const approval = await this.approvalManager.getApproval(params.session, targetApprovalId);
      if (approval.status !== "APPROVED") {
        throw new ValidationError(
          `AgentRun '${run.id}' cannot resume until approval '${approval.approval_id}' is APPROVED (current: ${approval.status}).`
        );
      }
      humanApproved = true;
      approvalId = approval.approval_id;
    }

    const context = await this.contextAssembler.assemble({
      tenantId: params.session.tenantId,
      caseId: run.caseId,
    });

    const goal = this.goalManager.resolveGoal({
      caseId: context.caseRecord.id,
      currentState: context.caseRecord.status,
      explicitGoal: checkpoint.goal || context.caseRecord.goal,
      specialty: context.caseRecord.referral.specialty,
      hasVerifiedCompletion: Boolean(context.caseRecord.firstCompletedVisitAt),
    });

    const resumedCheckpoint: AgentRunCheckpoint = {
      ...checkpoint,
      step: "RESUMED",
      caseStatus: context.caseRecord.status,
      updatedAt: new Date().toISOString(),
    };

    const activeRun = await this.stateManager.saveCheckpoint({
      runId: run.id,
      status: "STARTED",
      currentStep: "RESUMED",
      checkpoint: resumedCheckpoint,
      pausedAt: null,
    });

    await this.executionJournal.record({
      tenantId: params.session.tenantId,
      caseId: run.caseId,
      actorType: "AGENT",
      actorId: run.agent,
      eventType: EXECUTION_JOURNAL_EVENT_TYPES.AGENT_RESUMED,
      inputReference: `agent_run:${run.id}`,
      outputReference: approvalId ? `approval:${approvalId}` : "status:STARTED",
      policyDecision: humanApproved ? "ALLOW" : undefined,
      evidence: [`resumedFrom=${run.status}`],
      correlationId: params.correlationId ?? run.correlationId ?? null,
    });

    return this.executeStep({
      session: params.session,
      run: activeRun,
      context,
      goal,
      toolInput: checkpoint.toolInput,
      sensitiveCommunication: checkpoint.sensitiveCommunication,
      humanApproved,
      approvalId,
      correlationId: params.correlationId ?? run.correlationId ?? undefined,
    });
  }

  async retry(params: {
    session: SessionUser;
    runId: string;
    toolInputOverride?: Record<string, unknown>;
    correlationId?: string;
  }): Promise<AgentRuntimeResult> {
    requirePermission(params.session, PERMISSIONS.AI_RUN);
    const run = await this.stateManager.getRun(params.session.tenantId, params.runId);

    if (run.status !== "FAILED" && run.status !== "PAUSED") {
      throw new ValidationError(
        `AgentRun '${run.id}' has status '${run.status}' and can only be retried from FAILED or PAUSED.`
      );
    }

    const currentRetryCount = run.retryCount ?? 0;
    const maxRetries = run.maxRetries ?? 3;
    if (currentRetryCount >= maxRetries) {
      throw new ValidationError(
        `AgentRun '${run.id}' exceeded maxRetries (${maxRetries}) and cannot be retried.`
      );
    }

    const checkpoint = parseCheckpoint(run.checkpointJson, {
      step: run.currentStep ?? "FAILED",
      goal: run.goal ?? "",
    });
    const nextRetryCount = currentRetryCount + 1;

    const context = await this.contextAssembler.assemble({
      tenantId: params.session.tenantId,
      caseId: run.caseId,
    });

    const goal = this.goalManager.resolveGoal({
      caseId: context.caseRecord.id,
      currentState: context.caseRecord.status,
      explicitGoal: checkpoint.goal || context.caseRecord.goal,
      specialty: context.caseRecord.referral.specialty,
      hasVerifiedCompletion: Boolean(context.caseRecord.firstCompletedVisitAt),
    });

    const retriedCheckpoint: AgentRunCheckpoint = {
      ...checkpoint,
      step: `RETRY_${nextRetryCount}`,
      toolInput: params.toolInputOverride ?? checkpoint.toolInput,
      updatedAt: new Date().toISOString(),
    };

    const activeRun = await this.stateManager.saveCheckpoint({
      runId: run.id,
      status: "STARTED",
      currentStep: `RETRY_${nextRetryCount}`,
      checkpoint: retriedCheckpoint,
      retryCount: nextRetryCount,
      errorMessage: null,
      completedAt: null,
    });

    await this.executionJournal.record({
      tenantId: params.session.tenantId,
      caseId: run.caseId,
      actorType: "AGENT",
      actorId: run.agent,
      eventType: EXECUTION_JOURNAL_EVENT_TYPES.AGENT_RETRIED,
      inputReference: `agent_run:${run.id}`,
      outputReference: `attempt:${nextRetryCount}`,
      evidence: [`previousError=${run.lastError ?? run.errorMessage ?? "none"}`],
      correlationId: params.correlationId ?? run.correlationId ?? null,
    });

    return this.executeStep({
      session: params.session,
      run: activeRun,
      context,
      goal,
      toolInput: params.toolInputOverride ?? checkpoint.toolInput,
      sensitiveCommunication: checkpoint.sensitiveCommunication,
      correlationId: params.correlationId ?? run.correlationId ?? undefined,
    });
  }

  async cancel(params: {
    session: SessionUser;
    runId: string;
    reason?: string;
    correlationId?: string;
  }): Promise<AgentRuntimeResult> {
    requirePermission(params.session, PERMISSIONS.AI_RUN);
    const run = await this.stateManager.getRun(params.session.tenantId, params.runId);

    if (TERMINAL_RUN_STATUSES.has(run.status)) {
      throw new ValidationError(
        `AgentRun '${run.id}' is already in terminal status '${run.status}' and cannot be cancelled.`
      );
    }

    if (run.status === "AWAITING_APPROVAL" && run.approvalRequestId) {
      const approval = await this.approvalManager.getApproval(
        params.session,
        run.approvalRequestId
      );
      if (approval.status === "PENDING") {
        await this.approvalManager.cancelPendingApproval({
          session: params.session,
          approvalId: approval.approval_id,
          comments: params.reason ?? "Cancelled with AgentRun.",
          correlationId: params.correlationId,
        });
      }
    }

    const checkpoint = parseCheckpoint(run.checkpointJson, {
      step: "CANCELLED",
      goal: run.goal ?? "",
    });
    const now = new Date();
    const cancelledCheckpoint: AgentRunCheckpoint = {
      ...checkpoint,
      step: "CANCELLED",
      pauseReason: params.reason,
      updatedAt: now.toISOString(),
    };

    const cancelledRun = await this.stateManager.saveCheckpoint({
      runId: run.id,
      status: "CANCELLED",
      currentStep: "CANCELLED",
      checkpoint: cancelledCheckpoint,
      cancelledAt: now,
      completedAt: now,
      latencyMs: Math.max(0, now.getTime() - run.startedAt.getTime()),
    });

    await this.executionJournal.record({
      tenantId: params.session.tenantId,
      caseId: run.caseId,
      actorType: "AGENT",
      actorId: run.agent,
      eventType: EXECUTION_JOURNAL_EVENT_TYPES.AGENT_CANCELLED,
      inputReference: `agent_run:${run.id}`,
      outputReference: "status:CANCELLED",
      evidence: [params.reason ?? "Agent run cancelled"],
      correlationId: params.correlationId ?? run.correlationId ?? null,
    });

    return {
      run: cancelledRun,
      goal: this.goalManager.resolveGoal({
        caseId: run.caseId,
        currentState: cancelledCheckpoint.caseStatus,
        explicitGoal: cancelledCheckpoint.goal,
      }),
      decision: cancelledCheckpoint.decision,
    };
  }

  async complete(params: {
    session: SessionUser;
    runId: string;
    summary?: string;
    correlationId?: string;
  }): Promise<AgentRuntimeResult> {
    requirePermission(params.session, PERMISSIONS.AI_RUN);
    const run = await this.stateManager.getRun(params.session.tenantId, params.runId);
    if (TERMINAL_RUN_STATUSES.has(run.status)) {
      throw new ValidationError(
        `AgentRun '${run.id}' is already in terminal status '${run.status}'.`
      );
    }

    const checkpoint = parseCheckpoint(run.checkpointJson, {
      step: "COMPLETED",
      goal: run.goal ?? "",
    });
    const now = new Date();
    const completedCheckpoint: AgentRunCheckpoint = {
      ...checkpoint,
      step: "COMPLETED",
      updatedAt: now.toISOString(),
    };

    const completedRun = await this.stateManager.saveCheckpoint({
      runId: run.id,
      status: "COMPLETED",
      currentStep: "COMPLETED",
      checkpoint: completedCheckpoint,
      completedAt: now,
      latencyMs: Math.max(0, now.getTime() - run.startedAt.getTime()),
    });

    await this.executionJournal.record({
      tenantId: params.session.tenantId,
      caseId: run.caseId,
      actorType: "AGENT",
      actorId: run.agent,
      eventType: EXECUTION_JOURNAL_EVENT_TYPES.AGENT_COMPLETED,
      inputReference: `agent_run:${run.id}`,
      outputReference: "status:COMPLETED",
      evidence: [params.summary ?? "Manually completed"],
      correlationId: params.correlationId ?? run.correlationId ?? null,
    });

    return {
      run: completedRun,
      goal: this.goalManager.resolveGoal({
        caseId: run.caseId,
        currentState: completedCheckpoint.caseStatus,
        explicitGoal: completedCheckpoint.goal,
      }),
      decision: completedCheckpoint.decision,
    };
  }

  async fail(params: {
    session: SessionUser;
    runId: string;
    errorMessage: string;
    correlationId?: string;
  }): Promise<AgentRuntimeResult> {
    requirePermission(params.session, PERMISSIONS.AI_RUN);
    const run = await this.stateManager.getRun(params.session.tenantId, params.runId);
    if (TERMINAL_RUN_STATUSES.has(run.status)) {
      throw new ValidationError(
        `AgentRun '${run.id}' is already in terminal status '${run.status}' and cannot be failed.`
      );
    }

    const checkpoint = parseCheckpoint(run.checkpointJson, {
      step: "FAILED",
      goal: run.goal ?? "",
    });
    const now = new Date();
    const failedCheckpoint: AgentRunCheckpoint = {
      ...checkpoint,
      step: "FAILED",
      lastError: params.errorMessage,
      updatedAt: now.toISOString(),
    };

    const failedRun = await this.stateManager.saveCheckpoint({
      runId: run.id,
      status: "FAILED",
      currentStep: "FAILED",
      checkpoint: failedCheckpoint,
      errorMessage: params.errorMessage,
      lastError: params.errorMessage,
      completedAt: now,
      latencyMs: Math.max(0, now.getTime() - run.startedAt.getTime()),
    });

    await this.executionJournal.record({
      tenantId: params.session.tenantId,
      caseId: run.caseId,
      actorType: "AGENT",
      actorId: run.agent,
      eventType: EXECUTION_JOURNAL_EVENT_TYPES.AGENT_FAILED,
      inputReference: `agent_run:${run.id}`,
      outputReference: "status:FAILED",
      evidence: [params.errorMessage],
      correlationId: params.correlationId ?? run.correlationId ?? null,
    });

    return {
      run: failedRun,
      goal: this.goalManager.resolveGoal({
        caseId: run.caseId,
        currentState: failedCheckpoint.caseStatus,
        explicitGoal: failedCheckpoint.goal,
      }),
      decision: failedCheckpoint.decision,
    };
  }

  async escalate(params: {
    session: SessionUser;
    runId: string;
    reason: string;
    correlationId?: string;
  }): Promise<AgentRuntimeResult> {
    requirePermission(params.session, PERMISSIONS.AI_RUN);
    const run = await this.stateManager.getRun(params.session.tenantId, params.runId);
    if (TERMINAL_RUN_STATUSES.has(run.status)) {
      throw new ValidationError(
        `AgentRun '${run.id}' is already in terminal status '${run.status}' and cannot be escalated.`
      );
    }

    const checkpoint = parseCheckpoint(run.checkpointJson, {
      step: "ESCALATED",
      goal: run.goal ?? "",
    });
    const now = new Date();
    const escalatedCheckpoint: AgentRunCheckpoint = {
      ...checkpoint,
      step: "ESCALATED",
      escalationReason: params.reason,
      updatedAt: now.toISOString(),
    };

    const careCase = await prisma.case.update({
      where: { id: run.caseId },
      data: {
        humanReviewRequired: true,
        escalationReason: params.reason,
      },
      select: { status: true },
    });

    await prisma.workflowEvent.create({
      data: {
        tenantId: params.session.tenantId,
        caseId: run.caseId,
        eventType: "ESCALATED",
        fromStatus: careCase.status,
        toStatus: careCase.status,
        actorId: params.session.userId,
        actorRole: params.session.role,
        reason: params.reason,
        metadata: {
          agentRunId: run.id,
          correlationId: params.correlationId ?? run.correlationId ?? null,
        },
      },
    });

    await recordAuditEvent({
      tenantId: params.session.tenantId,
      actorId: params.session.userId,
      actorEmail: params.session.email,
      actorRole: params.session.role,
      action: "AGENT_ESCALATED",
      entityType: "AgentRun",
      entityId: run.id,
      correlationId: params.correlationId ?? run.correlationId ?? undefined,
      summary: `AgentRun ${run.id} escalated to human review: ${params.reason}`,
      metadata: {
        caseId: run.caseId,
        reason: params.reason,
      },
    });

    const escalatedRun = await this.stateManager.saveCheckpoint({
      runId: run.id,
      status: "ESCALATED",
      currentStep: "ESCALATED",
      checkpoint: escalatedCheckpoint,
      escalatedAt: now,
      completedAt: now,
      latencyMs: Math.max(0, now.getTime() - run.startedAt.getTime()),
    });

    await this.executionJournal.record({
      tenantId: params.session.tenantId,
      caseId: run.caseId,
      actorType: "AGENT",
      actorId: run.agent,
      eventType: EXECUTION_JOURNAL_EVENT_TYPES.AGENT_ESCALATED,
      inputReference: `agent_run:${run.id}`,
      outputReference: "status:ESCALATED",
      policyDecision: "REQUIRE_HUMAN",
      evidence: [params.reason],
      correlationId: params.correlationId ?? run.correlationId ?? null,
    });

    return {
      run: escalatedRun,
      goal: this.goalManager.resolveGoal({
        caseId: run.caseId,
        currentState: careCase.status,
        explicitGoal: escalatedCheckpoint.goal,
      }),
      decision: escalatedCheckpoint.decision,
    };
  }

  // Backward-compatible low-level observability helpers
  startRun(params: {
    tenantId: string;
    caseId: string;
    agent?: string;
    model?: string;
    promptVersion?: string;
    correlationId?: string | null;
  }): Promise<AgentRun> {
    return startAgentRun(params);
  }

  completeRun(params: {
    agentRunId: string;
    status: "COMPLETED" | "AWAITING_APPROVAL";
    startedAt: Date;
    decisionTraceId?: string;
    approvalRequestId?: string;
    policyResult?: string;
    retryCount?: number;
    tokenUsage?: TokenUsageInput;
  }): Promise<AgentRun> {
    return completeAgentRun(params);
  }

  failRun(params: {
    agentRunId: string;
    startedAt: Date;
    errorMessage: string;
    retryCount?: number;
  }): Promise<AgentRun> {
    return failAgentRun(params);
  }
}

export const careLoopAgentRuntime = new CareLoopAgentRuntime();
