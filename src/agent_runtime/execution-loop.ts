import { CaseStatus, Prisma } from "@prisma/client";
import { inspectCaseContext, type OrchestratorInspection } from "@/agent/orchestrator-agent";
import { CaseOrchestratorDecision } from "@/ai";
import { getToolDefinition } from "@/ai/tool-registry";
import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { SessionUser } from "@/lib/auth/session";
import { PolicyDecision } from "@/policy";
import { ApprovalRecord } from "@/services/approval-service";
import { recordAIDecisionTrace } from "@/services/decision-trace-service";
import { EXECUTION_JOURNAL_EVENT_TYPES } from "@/services/execution-journal-service";
import { recordCaseLearningOutcome } from "@/services/learning-loop-service";
import { ToolResult } from "@/tools";
import type {
  AgentRun,
  AgentRunCheckpoint,
  AssembledRuntimeContext,
} from "./contracts";
import { CareLoopAgentRuntime, careLoopAgentRuntime } from "./runtime";

export type AgenticLoopPhase =
  | "OBSERVE"
  | "UNDERSTAND"
  | "PLAN"
  | "POLICY_CHECK"
  | "ACT"
  | "VERIFY"
  | "UPDATE_STATE"
  | "LEARN";

export type AgenticLoopStopReason =
  | "GOAL_ACHIEVED"
  | "HUMAN_REQUIRED"
  | "BLOCKED"
  | "MEMBER_DECLINED"
  | "CASE_CLOSED";

export interface AgenticExecutionLoopParams {
  session: SessionUser;
  caseId: string;
  maxIterations?: number;
  maxRetriesPerStep?: number;
  maxLoopRepeats?: number;
  stepTimeoutMs?: number;
  totalTimeoutMs?: number;
  sensitiveCommunication?: boolean;
  toolInputProvider?: (params: {
    iteration: number;
    decision: CaseOrchestratorDecision;
    context: AssembledRuntimeContext;
    inspection: OrchestratorInspection;
  }) => Record<string, unknown> | undefined;
  correlationId?: string;
}

export interface AgenticLoopIterationTrace {
  iteration: number;
  phasesExecuted: AgenticLoopPhase[];
  caseStateBefore: CaseStatus;
  caseStateAfter: CaseStatus;
  decision?: CaseOrchestratorDecision;
  policyDecision?: PolicyDecision;
  toolResult?: ToolResult;
  retriesUsed: number;
  timedOut: boolean;
  verified: boolean;
  learned: boolean;
}

export interface AgenticExecutionLoopResult {
  caseId: string;
  stopReason: AgenticLoopStopReason;
  stopDetail: string;
  iterationsExecuted: number;
  loopDetected: boolean;
  timedOut: boolean;
  failureRecovered: boolean;
  totalRetries: number;
  finalCaseState: CaseStatus;
  finalRun?: AgentRun;
  approval?: ApprovalRecord;
  iterations: AgenticLoopIterationTrace[];
}

class StepTimeoutError extends Error {
  constructor(ms: number) {
    super(`Agent step timed out after ${ms}ms`);
    this.name = "StepTimeoutError";
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new StepTimeoutError(timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class AgenticExecutionLoop {
  private readonly runtime: CareLoopAgentRuntime;

  constructor(runtime: CareLoopAgentRuntime = careLoopAgentRuntime) {
    this.runtime = runtime;
  }

  async run(params: AgenticExecutionLoopParams): Promise<AgenticExecutionLoopResult> {
    requirePermission(params.session, PERMISSIONS.AI_RUN);

    const maxIterations = Math.max(1, Math.min(params.maxIterations ?? 8, 20));
    const maxRetriesPerStep = Math.max(0, Math.min(params.maxRetriesPerStep ?? 2, 5));
    const maxLoopRepeats = Math.max(2, Math.min(params.maxLoopRepeats ?? 2, 5));
    const stepTimeoutMs = Math.max(20, params.stepTimeoutMs ?? 15000);
    const totalTimeoutMs = Math.max(50, params.totalTimeoutMs ?? 60000);
    const startedAtMs = Date.now();

    const iterations: AgenticLoopIterationTrace[] = [];
    const signatureCounts = new Map<string, number>();
    let totalRetries = 0;
    let lastRun: AgentRun | undefined;

    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
      if (Date.now() - startedAtMs >= totalTimeoutMs) {
        return {
          caseId: params.caseId,
          stopReason: "BLOCKED",
          stopDetail: `Total execution loop timeout (${totalTimeoutMs}ms) reached.`,
          iterationsExecuted: iterations.length,
          loopDetected: false,
          timedOut: true,
          failureRecovered: false,
          totalRetries,
          finalCaseState: iterations[iterations.length - 1]?.caseStateAfter ?? "NEW",
          finalRun: lastRun,
          iterations,
        };
      }

      const phasesExecuted: AgenticLoopPhase[] = [];

      // 1. OBSERVE
      phasesExecuted.push("OBSERVE");
      const observed = await this.runtime.contextAssembler.assemble({
        tenantId: params.session.tenantId,
        caseId: params.caseId,
      });

      // 2. UNDERSTAND
      phasesExecuted.push("UNDERSTAND");
      const inspection = inspectCaseContext(observed);
      const goal = this.runtime.goalManager.resolveGoal({
        caseId: observed.caseRecord.id,
        currentState: observed.caseRecord.status,
        explicitGoal: observed.caseRecord.goal,
        specialty: observed.caseRecord.referral.specialty,
        hasVerifiedCompletion: Boolean(observed.caseRecord.firstCompletedVisitAt),
      });

      if (observed.caseRecord.status === "CLOSED") {
        return {
          caseId: params.caseId,
          stopReason: "CASE_CLOSED",
          stopDetail: "Case is in CLOSED state.",
          iterationsExecuted: iterations.length,
          loopDetected: false,
          timedOut: false,
          failureRecovered: false,
          totalRetries,
          finalCaseState: observed.caseRecord.status,
          finalRun: lastRun,
          iterations,
        };
      }

      if (goal.achieved) {
        return {
          caseId: params.caseId,
          stopReason: "GOAL_ACHIEVED",
          stopDetail: "Case goal achieved with verified completion.",
          iterationsExecuted: iterations.length,
          loopDetected: false,
          timedOut: false,
          failureRecovered: false,
          totalRetries,
          finalCaseState: observed.caseRecord.status,
          finalRun: lastRun,
          iterations,
        };
      }

      if (!observed.caseRecord.member.consentOutreach) {
        return {
          caseId: params.caseId,
          stopReason: "MEMBER_DECLINED",
          stopDetail: "Member outreach consent is declined/not granted.",
          iterationsExecuted: iterations.length,
          loopDetected: false,
          timedOut: false,
          failureRecovered: false,
          totalRetries,
          finalCaseState: observed.caseRecord.status,
          finalRun: lastRun,
          iterations,
        };
      }

      if (
        observed.caseRecord.status === "BLOCKED" ||
        observed.caseRecord.status === "LOST_TO_FOLLOW_UP"
      ) {
        return {
          caseId: params.caseId,
          stopReason: "BLOCKED",
          stopDetail: `Case is in ${observed.caseRecord.status} state.`,
          iterationsExecuted: iterations.length,
          loopDetected: false,
          timedOut: false,
          failureRecovered: false,
          totalRetries,
          finalCaseState: observed.caseRecord.status,
          finalRun: lastRun,
          iterations,
        };
      }

      if (
        observed.caseRecord.status === "ESCALATED" ||
        observed.caseRecord.status === "REQUIRES_HUMAN_REVIEW"
      ) {
        return {
          caseId: params.caseId,
          stopReason: "HUMAN_REQUIRED",
          stopDetail: `Case is in ${observed.caseRecord.status} state awaiting human action.`,
          iterationsExecuted: iterations.length,
          loopDetected: false,
          timedOut: false,
          failureRecovered: false,
          totalRetries,
          finalCaseState: observed.caseRecord.status,
          finalRun: lastRun,
          iterations,
        };
      }

      // 3. PLAN
      phasesExecuted.push("PLAN");
      const rawDecision = await this.runtime.planner.plan(observed.orchestratorInput);
      const validation = this.runtime.decisionValidator.validate({
        decision: rawDecision,
        currentState: observed.caseRecord.status,
        riskTier: observed.caseRecord.riskLevel,
        consentOutreach: observed.caseRecord.member.consentOutreach,
        hasVerifiedCompletion: Boolean(observed.caseRecord.firstCompletedVisitAt),
        verifiedAvailableSlotsCount:
          observed.orchestratorInput.referral_context.verifiedAvailableSlotsCount,
      });
      const decision = validation.decision;

      // Loop detection: prevent endless repetition of identical state + tool + target
      const loopSignature = `${observed.caseRecord.status}::${decision.tool}::${decision.proposed_next_state ?? "STAY"}`;
      const nextCount = (signatureCounts.get(loopSignature) ?? 0) + 1;
      signatureCounts.set(loopSignature, nextCount);
      if (nextCount > maxLoopRepeats) {
        await this.runtime.executionJournal.record({
          tenantId: params.session.tenantId,
          caseId: params.caseId,
          actorType: "SYSTEM",
          actorId: "AgenticExecutionLoop",
          eventType: EXECUTION_JOURNAL_EVENT_TYPES.AGENT_FAILED,
          inputReference: `loop:${loopSignature}`,
          outputReference: "stop:BLOCKED",
          evidence: [`Loop detected after ${nextCount} repeats of ${loopSignature}`],
          correlationId: params.correlationId ?? null,
        });

        return {
          caseId: params.caseId,
          stopReason: "BLOCKED",
          stopDetail: `Loop detected: '${loopSignature}' repeated ${nextCount} times without state progression.`,
          iterationsExecuted: iterations.length,
          loopDetected: true,
          timedOut: false,
          failureRecovered: false,
          totalRetries,
          finalCaseState: observed.caseRecord.status,
          finalRun: lastRun,
          iterations,
        };
      }

      const toolInput = params.toolInputProvider?.({
        iteration,
        decision,
        context: observed,
        inspection,
      });

      const checkpoint: AgentRunCheckpoint = {
        step: `LOOP_ITERATION_${iteration}`,
        goal: goal.goal,
        caseStatus: observed.caseRecord.status,
        contextHash: observed.caseContext.contextHash,
        contextVersion: observed.caseContext.contextVersion,
        decision,
        toolInput,
        updatedAt: new Date().toISOString(),
      };

      lastRun = await this.runtime.stateManager.createRun({
        tenantId: params.session.tenantId,
        caseId: params.caseId,
        agent: "CareLoopAgenticLoop",
        model: "careloop-orchestrator-v2",
        promptVersion: "2.0.0",
        goal: goal.goal,
        maxRetries: maxRetriesPerStep,
        correlationId: params.correlationId ?? null,
        checkpoint,
      });

      // 4. POLICY_CHECK
      phasesExecuted.push("POLICY_CHECK");
      const policyDecision = this.runtime.policyGate.evaluate({
        session: params.session,
        context: observed,
        decision,
        channel:
          typeof toolInput?.channel === "string"
            ? (toolInput.channel as "SMS" | "PHONE" | "EMAIL" | "PORTAL" | "IN_PERSON_NAVIGATOR")
            : undefined,
        sensitiveCommunication: params.sensitiveCommunication,
      });

      const trace = await recordAIDecisionTrace({
        tenantId: params.session.tenantId,
        caseId: params.caseId,
        agent: lastRun.agent,
        model: lastRun.model,
        promptVersion: lastRun.promptVersion,
        inputContext: observed.orchestratorInput,
        decision: `${decision.recommended_action}: ${decision.reason}`,
        confidence: decision.confidence,
        evidence: decision.evidence,
        policyResult: policyDecision.effect,
        toolSelected: decision.tool,
        humanApprovalRequired: policyDecision.requiresApproval || decision.requires_human,
        correlationId: params.correlationId ?? null,
      });

      if (policyDecision.effect === "DENY") {
        lastRun = await this.runtime.stateManager.saveCheckpoint({
          runId: lastRun.id,
          status: "FAILED",
          currentStep: "POLICY_DENIED",
          checkpoint: {
            ...checkpoint,
            policyDecision: policyDecision.effect,
            decisionTraceId: trace.decision_id,
            lastError: policyDecision.reason,
          },
          decisionTraceId: trace.decision_id,
          policyResult: policyDecision.effect,
          errorMessage: policyDecision.reason,
          completedAt: new Date(),
        });

        iterations.push({
          iteration,
          phasesExecuted,
          caseStateBefore: observed.caseRecord.status,
          caseStateAfter: observed.caseRecord.status,
          decision,
          policyDecision,
          retriesUsed: 0,
          timedOut: false,
          verified: false,
          learned: false,
        });

        return {
          caseId: params.caseId,
          stopReason: "BLOCKED",
          stopDetail: `Policy denied action '${decision.tool}': ${policyDecision.reason}`,
          iterationsExecuted: iterations.length,
          loopDetected: false,
          timedOut: false,
          failureRecovered: false,
          totalRetries,
          finalCaseState: observed.caseRecord.status,
          finalRun: lastRun,
          iterations,
        };
      }

      if (
        policyDecision.effect === "REQUIRE_HUMAN" ||
        policyDecision.effect === "REQUIRE_APPROVAL" ||
        decision.requires_human
      ) {
        const approval =
          policyDecision.effect === "REQUIRE_APPROVAL" || decision.requires_human
            ? await this.runtime.approvalManager.requestApproval({
                session: params.session,
                caseId: params.caseId,
                action: decision.tool,
                reason: decision.reason,
                riskLevel: getToolDefinition(decision.tool).risk_level,
                requestedBy: lastRun.agent,
                toolInput,
                proposedNextState: decision.proposed_next_state ?? null,
                orchestratorSnapshot: decision,
                correlationId: params.correlationId,
                idempotencyKey: `loop-${lastRun.id}-${decision.tool}`,
              })
            : undefined;

        lastRun = await this.runtime.stateManager.saveCheckpoint({
          runId: lastRun.id,
          status: approval ? "AWAITING_APPROVAL" : "ESCALATED",
          currentStep: approval ? "AWAITING_APPROVAL" : "HUMAN_REQUIRED",
          checkpoint: {
            ...checkpoint,
            policyDecision: policyDecision.effect,
            decisionTraceId: trace.decision_id,
            approvalId: approval?.approval_id,
          },
          decisionTraceId: trace.decision_id,
          approvalRequestId: approval?.approval_id ?? null,
          policyResult: policyDecision.effect,
          pausedAt: new Date(),
        });

        iterations.push({
          iteration,
          phasesExecuted,
          caseStateBefore: observed.caseRecord.status,
          caseStateAfter: observed.caseRecord.status,
          decision,
          policyDecision,
          retriesUsed: 0,
          timedOut: false,
          verified: false,
          learned: false,
        });

        return {
          caseId: params.caseId,
          stopReason: "HUMAN_REQUIRED",
          stopDetail: approval
            ? `Paused awaiting human approval (${approval.approval_id}) for '${decision.tool}'.`
            : `Human intervention required: ${policyDecision.reason}`,
          iterationsExecuted: iterations.length,
          loopDetected: false,
          timedOut: false,
          failureRecovered: false,
          totalRetries,
          finalCaseState: observed.caseRecord.status,
          finalRun: lastRun,
          approval,
          iterations,
        };
      }

      if (!toolInput) {
        lastRun = await this.runtime.stateManager.saveCheckpoint({
          runId: lastRun.id,
          status: "PAUSED",
          currentStep: "AWAITING_TOOL_INPUT",
          checkpoint: {
            ...checkpoint,
            policyDecision: policyDecision.effect,
            decisionTraceId: trace.decision_id,
          },
          decisionTraceId: trace.decision_id,
          policyResult: policyDecision.effect,
          pausedAt: new Date(),
        });

        iterations.push({
          iteration,
          phasesExecuted,
          caseStateBefore: observed.caseRecord.status,
          caseStateAfter: observed.caseRecord.status,
          decision,
          policyDecision,
          retriesUsed: 0,
          timedOut: false,
          verified: false,
          learned: false,
        });

        return {
          caseId: params.caseId,
          stopReason: "HUMAN_REQUIRED",
          stopDetail: `Planned '${decision.tool}', awaiting executable input or human review.`,
          iterationsExecuted: iterations.length,
          loopDetected: false,
          timedOut: false,
          failureRecovered: false,
          totalRetries,
          finalCaseState: observed.caseRecord.status,
          finalRun: lastRun,
          iterations,
        };
      }

      // 5. ACT (with bounded retries + timeout handling + failure recovery)
      phasesExecuted.push("ACT");
      let toolResult: ToolResult | undefined;
      let retriesUsed = 0;
      let stepTimedOut = false;
      let lastErrorMessage = "";

      for (let attempt = 0; attempt <= maxRetriesPerStep; attempt += 1) {
        if (attempt > 0) {
          retriesUsed += 1;
          totalRetries += 1;
        }
        try {
          toolResult = await withTimeout(
            this.runtime.toolExecutor.execute(params.session, {
              tool: decision.tool,
              input: toolInput,
              proposedNextState: decision.proposed_next_state ?? undefined,
              agentRunId: lastRun.id,
              idempotencyKey: `loop-${lastRun.id}-iter-${iteration}-att-${attempt}-${decision.tool}`,
              correlationId: params.correlationId,
            }),
            stepTimeoutMs
          );
          if (toolResult.success) {
            break;
          }
          lastErrorMessage = toolResult.error?.message ?? "Tool returned failure";
        } catch (err) {
          if (err instanceof StepTimeoutError) {
            stepTimedOut = true;
          }
          lastErrorMessage = err instanceof Error ? err.message : "Tool execution threw error";
        }
      }

      if (!toolResult || !toolResult.success) {
        // Failure recovery: escalate cleanly rather than crashing or spinning endlessly
        await this.runtime.escalate({
          session: params.session,
          runId: lastRun.id,
          reason: `Step ${iteration} failed after ${retriesUsed} retry(ies): ${lastErrorMessage}`,
          correlationId: params.correlationId,
        });

        iterations.push({
          iteration,
          phasesExecuted,
          caseStateBefore: observed.caseRecord.status,
          caseStateAfter: observed.caseRecord.status,
          decision,
          policyDecision,
          toolResult,
          retriesUsed,
          timedOut: stepTimedOut,
          verified: false,
          learned: false,
        });

        return {
          caseId: params.caseId,
          stopReason: "BLOCKED",
          stopDetail: `Recovered from failure by escalating: ${lastErrorMessage}`,
          iterationsExecuted: iterations.length,
          loopDetected: false,
          timedOut: stepTimedOut,
          failureRecovered: true,
          totalRetries,
          finalCaseState: observed.caseRecord.status,
          finalRun: lastRun,
          iterations,
        };
      }

      // 6. VERIFY
      phasesExecuted.push("VERIFY");
      await this.runtime.evidenceManager.record({
        tenantId: params.session.tenantId,
        caseId: params.caseId,
        agentRunId: lastRun.id,
        sourceType: "AGENTIC_LOOP_STEP_VERIFICATION",
        summary: `Verified ${decision.tool} execution on iteration ${iteration}`,
        payload: {
          iteration,
          tool: decision.tool,
          retriesUsed,
          evidence: toolResult.evidence,
        } as unknown as Prisma.InputJsonValue,
        capturedBy: lastRun.agent,
      });

      // 7. UPDATE_STATE
      phasesExecuted.push("UPDATE_STATE");
      const postStep = await this.runtime.contextAssembler.assemble({
        tenantId: params.session.tenantId,
        caseId: params.caseId,
      });

      lastRun = await this.runtime.stateManager.saveCheckpoint({
        runId: lastRun.id,
        status: "COMPLETED",
        currentStep: `LOOP_ITERATION_${iteration}_COMPLETED`,
        checkpoint: {
          ...checkpoint,
          caseStatus: postStep.caseRecord.status,
          policyDecision: policyDecision.effect,
          decisionTraceId: trace.decision_id,
          lastToolResult: toolResult,
        },
        decisionTraceId: trace.decision_id,
        policyResult: policyDecision.effect,
        retryCount: retriesUsed,
        completedAt: new Date(),
      });

      // 8. LEARN
      phasesExecuted.push("LEARN");
      let learned = false;
      try {
        await recordCaseLearningOutcome({
          tenantId: params.session.tenantId,
          caseId: params.caseId,
        });
        learned = true;
      } catch {
        // Non-fatal if case is mid-flight and learning snapshot isn't finalized
      }

      iterations.push({
        iteration,
        phasesExecuted,
        caseStateBefore: observed.caseRecord.status,
        caseStateAfter: postStep.caseRecord.status,
        decision,
        policyDecision,
        toolResult,
        retriesUsed,
        timedOut: stepTimedOut,
        verified: true,
        learned,
      });
    }

    const finalObserved = await this.runtime.contextAssembler.assemble({
      tenantId: params.session.tenantId,
      caseId: params.caseId,
    });
    const finalGoal = this.runtime.goalManager.resolveGoal({
      caseId: finalObserved.caseRecord.id,
      currentState: finalObserved.caseRecord.status,
      explicitGoal: finalObserved.caseRecord.goal,
      specialty: finalObserved.caseRecord.referral.specialty,
      hasVerifiedCompletion: Boolean(finalObserved.caseRecord.firstCompletedVisitAt),
    });

    return {
      caseId: params.caseId,
      stopReason: finalGoal.achieved ? "GOAL_ACHIEVED" : "BLOCKED",
      stopDetail: finalGoal.achieved
        ? "Case goal achieved."
        : `Max iterations (${maxIterations}) reached without achieving goal.`,
      iterationsExecuted: iterations.length,
      loopDetected: false,
      timedOut: false,
      failureRecovered: false,
      totalRetries,
      finalCaseState: finalObserved.caseRecord.status,
      finalRun: lastRun,
      iterations,
    };
  }
}

export const agenticExecutionLoop = new AgenticExecutionLoop();
