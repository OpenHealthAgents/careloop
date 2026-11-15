import { getAIProvider, runAgentEvaluationSuite, AgentEvalSuiteResult } from "@/ai";
import {
  evaluateAgentTraceSuite,
  TraceEvalSuiteResult,
} from "@/evaluation/agent-eval-framework";
import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export interface LiveAgentEvaluationTelemetry {
  totalAgentRuns: number;
  completedRuns: number;
  failedRuns: number;
  awaitingApprovalRuns: number;
  agentSuccessRatePct: number;
  totalDecisionTraces: number;
  avgDecisionConfidence: number | null;
  humanApprovalRatePct: number;
  policyBlockedOrEscalatedCount: number;
}

export interface AgentEvaluationReport {
  benchmarkSuite: AgentEvalSuiteResult;
  traceEvaluation: TraceEvalSuiteResult;
  liveTelemetry: LiveAgentEvaluationTelemetry;
}

export async function getAgentEvaluationReport(
  session: SessionUser
): Promise<AgentEvaluationReport> {
  requirePermission(session, PERMISSIONS.ANALYTICS_READ);

  const [benchmarkSuite, traceEvaluation, runs, traces] = await Promise.all([
    runAgentEvaluationSuite(getAIProvider()),
    evaluateAgentTraceSuite(),
    prisma.agentRun.findMany({
      where: { tenantId: session.tenantId },
      select: { status: true, policyResult: true },
    }),
    prisma.aIDecisionTrace.findMany({
      where: { tenantId: session.tenantId },
      select: {
        confidence: true,
        humanApprovalRequired: true,
        policyResult: true,
      },
    }),
  ]);

  const totalAgentRuns = runs.length;
  const completedRuns = runs.filter((r) => r.status === "COMPLETED").length;
  const failedRuns = runs.filter((r) => r.status === "FAILED").length;
  const awaitingApprovalRuns = runs.filter((r) => r.status === "AWAITING_APPROVAL").length;
  const finishedRuns = completedRuns + failedRuns;
  const agentSuccessRatePct =
    finishedRuns > 0 ? Math.round((completedRuns / finishedRuns) * 1000) / 10 : 100;

  const totalDecisionTraces = traces.length;
  const avgDecisionConfidence =
    totalDecisionTraces > 0
      ? Math.round(
          (traces.reduce((sum, t) => sum + t.confidence, 0) / totalDecisionTraces) * 1000
        ) / 1000
      : null;

  const humanApprovalRequiredCount = traces.filter((t) => t.humanApprovalRequired).length;
  const humanApprovalRatePct =
    totalDecisionTraces > 0
      ? Math.round((humanApprovalRequiredCount / totalDecisionTraces) * 1000) / 10
      : 0;

  const policyBlockedOrEscalatedCount = traces.filter((t) => {
    const upper = t.policyResult.toUpperCase();
    return upper.includes("DENIED") || upper.includes("BLOCK") || upper.includes("ESCALAT");
  }).length;

  return {
    benchmarkSuite,
    traceEvaluation,
    liveTelemetry: {
      totalAgentRuns,
      completedRuns,
      failedRuns,
      awaitingApprovalRuns,
      agentSuccessRatePct,
      totalDecisionTraces,
      avgDecisionConfidence,
      humanApprovalRatePct,
      policyBlockedOrEscalatedCount,
    },
  };
}
