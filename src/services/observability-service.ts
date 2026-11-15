import { AgentRunStatus } from "@prisma/client";
import {
  ORCHESTRATOR_MODEL_DEFAULT,
  ORCHESTRATOR_PROMPT_VERSION,
} from "@/ai";
import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { computeCostAndPerformanceMetrics } from "@/lib/optimization/cost-performance-engine";
import { toAIDecisionTraceRecord } from "./decision-trace-service";
import { toExecutionJournalEntry } from "./execution-journal-service";

export interface TokenUsageInput {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export async function startAgentRun(params: {
  tenantId: string;
  caseId: string;
  agent?: string;
  model?: string;
  promptVersion?: string;
  correlationId?: string | null;
}) {
  return prisma.agentRun.create({
    data: {
      tenantId: params.tenantId,
      caseId: params.caseId,
      agent: params.agent ?? "CareLoopCaseOrchestrator",
      model: params.model ?? ORCHESTRATOR_MODEL_DEFAULT,
      promptVersion: params.promptVersion ?? ORCHESTRATOR_PROMPT_VERSION,
      status: "STARTED",
      correlationId: params.correlationId ?? null,
      startedAt: new Date(),
    },
  });
}

export async function completeAgentRun(params: {
  agentRunId: string;
  status: Extract<AgentRunStatus, "COMPLETED" | "AWAITING_APPROVAL">;
  startedAt: Date;
  decisionTraceId?: string;
  approvalRequestId?: string;
  policyResult?: string;
  retryCount?: number;
  tokenUsage?: TokenUsageInput;
}) {
  const completedAt = new Date();
  const latencyMs = Math.max(0, completedAt.getTime() - params.startedAt.getTime());
  const promptTokens = params.tokenUsage?.promptTokens ?? 0;
  const completionTokens = params.tokenUsage?.completionTokens ?? 0;
  const totalTokens = params.tokenUsage?.totalTokens ?? promptTokens + completionTokens;

  return prisma.agentRun.update({
    where: { id: params.agentRunId },
    data: {
      status: params.status,
      completedAt,
      latencyMs,
      decisionTraceId: params.decisionTraceId ?? null,
      approvalRequestId: params.approvalRequestId ?? null,
      policyResult: params.policyResult ?? null,
      retryCount: params.retryCount ?? 0,
      promptTokens,
      completionTokens,
      totalTokens,
    },
  });
}

export async function failAgentRun(params: {
  agentRunId: string;
  startedAt: Date;
  errorMessage: string;
  retryCount?: number;
}) {
  const completedAt = new Date();
  const latencyMs = Math.max(0, completedAt.getTime() - params.startedAt.getTime());

  return prisma.agentRun.update({
    where: { id: params.agentRunId },
    data: {
      status: "FAILED",
      completedAt,
      latencyMs,
      retryCount: params.retryCount ?? 0,
      errorMessage: params.errorMessage.slice(0, 500),
    },
  });
}

export async function recordToolExecutionSpan(params: {
  tenantId: string;
  caseId?: string | null;
  agentRunId?: string | null;
  tool: string;
  status: "SUCCEEDED" | "FAILED";
  startedAt: Date;
  retryCount?: number;
  policyDecision?: string | null;
  replayed?: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
  correlationId?: string | null;
}) {
  const completedAt = new Date();
  const latencyMs = Math.max(0, completedAt.getTime() - params.startedAt.getTime());

  return prisma.toolExecutionSpan.create({
    data: {
      tenantId: params.tenantId,
      caseId: params.caseId ?? null,
      agentRunId: params.agentRunId ?? null,
      tool: params.tool,
      status: params.status,
      latencyMs,
      retryCount: params.retryCount ?? 0,
      policyDecision: params.policyDecision ?? null,
      replayed: Boolean(params.replayed),
      errorCode: params.errorCode ?? null,
      errorMessage: params.errorMessage ? params.errorMessage.slice(0, 500) : null,
      correlationId: params.correlationId ?? null,
      startedAt: params.startedAt,
      completedAt,
    },
  });
}

function percentile95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * Reconstructs the end-to-end execution trace for a single case:
 * Case -> Agent Run -> Decision -> Policy Check -> Tool Call -> Tool Result -> Evidence -> State Transition
 */
export async function getCaseExecutionTrace(session: SessionUser, caseId: string) {
  requirePermission(session, PERMISSIONS.CASES_READ);

  const careCase = await prisma.case.findFirst({
    where: { id: caseId, tenantId: session.tenantId },
    select: {
      id: true,
      status: true,
      goal: true,
      riskLevel: true,
      firstCompletedVisitAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!careCase) {
    throw new NotFoundError("Case", caseId);
  }

  const [agentRuns, decisionTraces, toolSpans, approvals, journalEvents, workflowEvents, verifications] =
    await Promise.all([
      prisma.agentRun.findMany({
        where: { tenantId: session.tenantId, caseId },
        orderBy: { startedAt: "asc" },
      }),
      prisma.aIDecisionTrace.findMany({
        where: { tenantId: session.tenantId, caseId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.toolExecutionSpan.findMany({
        where: { tenantId: session.tenantId, caseId },
        orderBy: { startedAt: "asc" },
      }),
      prisma.approvalRequest.findMany({
        where: { tenantId: session.tenantId, caseId },
        orderBy: { requestedAt: "asc" },
      }),
      prisma.executionJournalEvent.findMany({
        where: { tenantId: session.tenantId, caseId },
        orderBy: [{ timestamp: "asc" }, { createdAt: "asc" }],
      }),
      prisma.workflowEvent.findMany({
        where: { tenantId: session.tenantId, caseId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.completionVerification.findMany({
        where: { tenantId: session.tenantId, caseId },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  return {
    case_id: careCase.id,
    case_status: careCase.status,
    goal: careCase.goal,
    risk_level: careCase.riskLevel,
    agent_runs: agentRuns.map((run) => ({
      run_id: run.id,
      agent: run.agent,
      model: run.model,
      prompt_version: run.promptVersion,
      status: run.status,
      policy_result: run.policyResult,
      latency_ms: run.latencyMs,
      prompt_tokens: run.promptTokens,
      completion_tokens: run.completionTokens,
      total_tokens: run.totalTokens,
      retry_count: run.retryCount,
      decision_trace_id: run.decisionTraceId,
      approval_request_id: run.approvalRequestId,
      error_message: run.errorMessage,
      correlation_id: run.correlationId,
      started_at: run.startedAt.toISOString(),
      completed_at: run.completedAt ? run.completedAt.toISOString() : null,
    })),
    decisions: decisionTraces.map(toAIDecisionTraceRecord),
    tool_calls: toolSpans.map((span) => ({
      span_id: span.id,
      agent_run_id: span.agentRunId,
      tool: span.tool,
      status: span.status,
      latency_ms: span.latencyMs,
      retry_count: span.retryCount,
      policy_decision: span.policyDecision,
      replayed: span.replayed,
      error_code: span.errorCode,
      error_message: span.errorMessage,
      correlation_id: span.correlationId,
      started_at: span.startedAt.toISOString(),
      completed_at: span.completedAt.toISOString(),
    })),
    approvals: approvals.map((a) => ({
      approval_id: a.id,
      action: a.action,
      status: a.status,
      decision: a.decision,
      requested_at: a.requestedAt.toISOString(),
      approved_at: a.approvedAt ? a.approvedAt.toISOString() : null,
      wait_time_ms:
        a.approvedAt !== null
          ? Math.max(0, a.approvedAt.getTime() - a.requestedAt.getTime())
          : null,
      resumed_at: a.resumedAt ? a.resumedAt.toISOString() : null,
    })),
    evidence: verifications.map((v) => ({
      verification_id: v.id,
      signal_type: v.signalType,
      verified: v.verified,
      verification_status: v.verificationStatus,
      source_system: v.sourceSystem,
      verified_at: v.verifiedAt.toISOString(),
    })),
    journal_events: journalEvents.map(toExecutionJournalEntry),
    state_transitions: workflowEvents.map((w) => ({
      event_id: w.id,
      event_type: w.eventType,
      from_status: w.fromStatus,
      to_status: w.toStatus,
      reason: w.reason,
      created_at: w.createdAt.toISOString(),
    })),
  };
}

/**
 * Tenant-wide observability metrics covering latency, token usage, tool latency,
 * failures, retries, approval wait time, completion rate, agent success rate,
 * and intervention success rate.
 */
export async function getObservabilityMetrics(session: SessionUser) {
  requirePermission(session, PERMISSIONS.ANALYTICS_READ);

  const [agentRuns, toolSpans, approvals, cases, outcomes, workflowEvents, decisionTraces] =
    await Promise.all([
      prisma.agentRun.findMany({
        where: { tenantId: session.tenantId },
        select: {
          id: true,
          caseId: true,
          agent: true,
          model: true,
          promptVersion: true,
          status: true,
          policyResult: true,
          latencyMs: true,
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
          retryCount: true,
          errorMessage: true,
          correlationId: true,
          startedAt: true,
          completedAt: true,
        },
      }),
      prisma.toolExecutionSpan.findMany({
        where: { tenantId: session.tenantId },
        select: {
          id: true,
          tool: true,
          status: true,
          latencyMs: true,
          retryCount: true,
          policyDecision: true,
          replayed: true,
          errorCode: true,
          errorMessage: true,
        },
      }),
      prisma.approvalRequest.findMany({
        where: { tenantId: session.tenantId },
        select: {
          id: true,
          action: true,
          status: true,
          decision: true,
          requestedAt: true,
          approvedAt: true,
          approvedById: true,
          reason: true,
          comments: true,
        },
      }),
      prisma.case.findMany({
        where: { tenantId: session.tenantId },
        select: {
          id: true,
          status: true,
          riskLevel: true,
          priorityScore: true,
          firstCompletedVisitAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.interventionOutcome.findMany({
        where: { tenantId: session.tenantId },
        select: {
          id: true,
          barriersResolved: true,
          outcomeStatus: true,
          recordedAt: true,
        },
      }),
      prisma.workflowEvent.findMany({
        where: { tenantId: session.tenantId },
        select: {
          id: true,
          caseId: true,
          eventType: true,
          fromStatus: true,
          toStatus: true,
          reason: true,
          createdAt: true,
        },
      }),
      prisma.aIDecisionTrace.findMany({
        where: { tenantId: session.tenantId },
        select: {
          id: true,
          model: true,
          toolSelected: true,
          policyResult: true,
          confidence: true,
          humanApprovalRequired: true,
        },
      }),
    ]);

  const agentLatencies = agentRuns
    .map((r) => r.latencyMs)
    .filter((v): v is number => typeof v === "number");

  const toolLatencies = toolSpans.map((s) => s.latencyMs);
  const byTool: Record<
    string,
    { count: number; avg_latency_ms: number; failures: number; retries: number }
  > = {};

  const toolBuckets = new Map<
    string,
    { latencies: number[]; failures: number; retries: number }
  >();
  for (const span of toolSpans) {
    const bucket = toolBuckets.get(span.tool) ?? {
      latencies: [],
      failures: 0,
      retries: 0,
    };
    bucket.latencies.push(span.latencyMs);
    if (span.status === "FAILED") bucket.failures += 1;
    bucket.retries += span.retryCount;
    toolBuckets.set(span.tool, bucket);
  }
  for (const [toolName, bucket] of toolBuckets.entries()) {
    byTool[toolName] = {
      count: bucket.latencies.length,
      avg_latency_ms: average(bucket.latencies),
      failures: bucket.failures,
      retries: bucket.retries,
    };
  }

  const totalPromptTokens = agentRuns.reduce((sum, r) => sum + r.promptTokens, 0);
  const totalCompletionTokens = agentRuns.reduce((sum, r) => sum + r.completionTokens, 0);
  const totalTokens = agentRuns.reduce((sum, r) => sum + r.totalTokens, 0);

  const failedAgentRuns = agentRuns.filter((r) => r.status === "FAILED").length;
  const succeededAgentRuns = agentRuns.filter((r) => r.status === "COMPLETED").length;
  const awaitingApprovalRuns = agentRuns.filter((r) => r.status === "AWAITING_APPROVAL").length;
  const terminalRuns = succeededAgentRuns + failedAgentRuns;

  const failedToolCalls = toolSpans.filter((s) => s.status === "FAILED").length;
  const agentRetries = agentRuns.reduce((sum, r) => sum + r.retryCount, 0);
  const toolRetries = toolSpans.reduce((sum, s) => sum + s.retryCount, 0);

  const approvalWaitsMs = approvals
    .filter((a) => a.approvedAt !== null)
    .map((a) => Math.max(0, a.approvedAt!.getTime() - a.requestedAt.getTime()));

  const totalCases = cases.length;
  const verifiedCompletedCases = cases.filter(
    (c) =>
      c.firstCompletedVisitAt !== null ||
      c.status === "VERIFIED" ||
      c.status === "CLOSED"
  ).length;

  const totalOutcomes = outcomes.length;
  const successfulInterventions = outcomes.filter(
    (o) =>
      o.barriersResolved ||
      o.outcomeStatus === "SUCCESSFUL" ||
      o.outcomeStatus === "COMPLETED" ||
      o.outcomeStatus === "RESOLVED"
  ).length;

  const costPerformance = computeCostAndPerformanceMetrics({
    totalCases,
    verifiedCompletedCases,
    agentRuns,
    decisionTraces,
    toolSpans,
    approvals,
  });

  return {
    cost_performance: costPerformance,
    latency: {
      avg_agent_latency_ms: average(agentLatencies),
      p95_agent_latency_ms: percentile95(agentLatencies),
      min_agent_latency_ms: agentLatencies.length > 0 ? Math.min(...agentLatencies) : 0,
      max_agent_latency_ms: agentLatencies.length > 0 ? Math.max(...agentLatencies) : 0,
    },
    token_usage: {
      total_prompt_tokens: totalPromptTokens,
      total_completion_tokens: totalCompletionTokens,
      total_tokens: totalTokens,
      avg_tokens_per_run:
        agentRuns.length > 0 ? Math.round(totalTokens / agentRuns.length) : 0,
    },
    tool_latency: {
      avg_tool_latency_ms: average(toolLatencies),
      p95_tool_latency_ms: percentile95(toolLatencies),
      by_tool: byTool,
    },
    failures: {
      failed_agent_runs: failedAgentRuns,
      failed_tool_calls: failedToolCalls,
      total_failures: failedAgentRuns + failedToolCalls,
    },
    retries: {
      agent_retries: agentRetries,
      tool_retries: toolRetries,
      total_retries: agentRetries + toolRetries,
    },
    approval_wait_time: {
      decided_count: approvalWaitsMs.length,
      avg_wait_ms: average(approvalWaitsMs),
      max_wait_ms: approvalWaitsMs.length > 0 ? Math.max(...approvalWaitsMs) : 0,
    },
    completion_rate: {
      total_cases: totalCases,
      verified_completed_cases: verifiedCompletedCases,
      rate: totalCases > 0 ? Number((verifiedCompletedCases / totalCases).toFixed(4)) : 0,
    },
    agent_success_rate: {
      total_runs: agentRuns.length,
      succeeded_runs: succeededAgentRuns,
      awaiting_approval_runs: awaitingApprovalRuns,
      failed_runs: failedAgentRuns,
      rate:
        terminalRuns > 0
          ? Number((succeededAgentRuns / terminalRuns).toFixed(4))
          : 0,
    },
    intervention_success_rate: {
      total_interventions_with_outcomes: totalOutcomes,
      successful_interventions: successfulInterventions,
      rate:
        totalOutcomes > 0
          ? Number((successfulInterventions / totalOutcomes).toFixed(4))
          : 0,
    },
    dashboards: {
      agent_reliability: {
        total_runs: agentRuns.length,
        succeeded_runs: succeededAgentRuns,
        failed_runs: failedAgentRuns,
        success_rate: terminalRuns > 0 ? Number((succeededAgentRuns / terminalRuns).toFixed(4)) : 0,
        avg_latency_ms: average(agentLatencies),
        p95_latency_ms: percentile95(agentLatencies),
        total_tokens: totalTokens,
        avg_tokens_per_run: agentRuns.length > 0 ? Math.round(totalTokens / agentRuns.length) : 0,
        total_retries: agentRetries,
        active_models: Array.from(new Set(agentRuns.map((r) => r.model).filter(Boolean))),
        prompt_versions: Array.from(new Set(agentRuns.map((r) => r.promptVersion).filter(Boolean))),
      },
      tool_reliability: {
        total_tool_calls: toolSpans.length,
        failed_tool_calls: failedToolCalls,
        tool_failure_rate:
          toolSpans.length > 0 ? Number((failedToolCalls / toolSpans.length).toFixed(4)) : 0,
        avg_latency_ms: average(toolLatencies),
        p95_latency_ms: percentile95(toolLatencies),
        total_retries: toolRetries,
        by_tool: byTool,
      },
      workflow_reliability: {
        total_state_transitions: workflowEvents.length,
        transitions_by_type: workflowEvents.reduce<Record<string, number>>((acc, w) => {
          acc[w.eventType] = (acc[w.eventType] ?? 0) + 1;
          return acc;
        }, {}),
        active_escalations: cases.filter((c) => c.status === "ESCALATED" || c.status === "REQUIRES_HUMAN_REVIEW").length,
        blocked_cases: cases.filter((c) => c.status === "BLOCKED").length,
        policy_decisions_count: decisionTraces.length,
        policy_breakdown: decisionTraces.reduce<Record<string, number>>((acc, d) => {
          acc[d.policyResult] = (acc[d.policyResult] ?? 0) + 1;
          return acc;
        }, {}),
      },
      human_workload: {
        total_approvals_requested: approvals.length,
        pending_approvals: approvals.filter((a) => a.status === "PENDING").length,
        completed_approvals: approvals.filter((a) => a.status === "APPROVED" || a.status === "REJECTED").length,
        avg_approval_wait_ms: average(approvalWaitsMs),
        max_approval_wait_ms: approvalWaitsMs.length > 0 ? Math.max(...approvalWaitsMs) : 0,
        auto_escalated_approvals: approvals.filter(
          (a) =>
            a.reason?.toLowerCase().includes("escalat") ||
            a.comments?.toLowerCase().includes("escalat")
        ).length,
      },
      case_outcomes: {
        total_cases: totalCases,
        verified_completed_cases: verifiedCompletedCases,
        completion_rate: totalCases > 0 ? Number((verifiedCompletedCases / totalCases).toFixed(4)) : 0,
        active_cases: cases.filter((c) => c.status !== "CLOSED" && c.status !== "VERIFIED").length,
        successful_interventions: successfulInterventions,
        intervention_success_rate:
          totalOutcomes > 0 ? Number((successfulInterventions / totalOutcomes).toFixed(4)) : 0,
      },
    },
  };
}
