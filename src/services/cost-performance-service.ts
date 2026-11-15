import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  computeCostAndPerformanceMetrics,
  CostAndPerformanceMetrics,
} from "@/lib/optimization/cost-performance-engine";
import { safeAICache } from "@/lib/optimization/safe-ai-cache";

export async function getCostAndPerformanceMetrics(
  session: SessionUser,
  options?: { careManagerHourlyWageDollars?: number }
): Promise<CostAndPerformanceMetrics> {
  requirePermission(session, PERMISSIONS.ANALYTICS_READ);

  const [cases, agentRuns, toolSpans, approvals, decisionTraces] = await Promise.all([
    prisma.case.findMany({
      where: { tenantId: session.tenantId },
      select: {
        id: true,
        status: true,
        firstCompletedVisitAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.agentRun.findMany({
      where: { tenantId: session.tenantId },
      select: {
        latencyMs: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        model: true,
        status: true,
      },
    }),
    prisma.toolExecutionSpan.findMany({
      where: { tenantId: session.tenantId },
      select: {
        latencyMs: true,
        status: true,
        retryCount: true,
      },
    }),
    prisma.approvalRequest.findMany({
      where: { tenantId: session.tenantId },
      select: {
        requestedAt: true,
        approvedAt: true,
        status: true,
      },
    }),
    prisma.aIDecisionTrace.findMany({
      where: { tenantId: session.tenantId },
      select: {
        id: true,
        model: true,
        humanApprovalRequired: true,
      },
    }),
  ]);

  const verifiedCompletedCases = cases.filter(
    (c) =>
      c.firstCompletedVisitAt !== null ||
      c.status === "VERIFIED" ||
      c.status === "CLOSED"
  ).length;

  return computeCostAndPerformanceMetrics({
    totalCases: cases.length,
    verifiedCompletedCases,
    agentRuns,
    decisionTraces,
    toolSpans,
    approvals,
    careManagerHourlyWageDollars: options?.careManagerHourlyWageDollars,
  });
}

export function getCacheEfficiencyStats() {
  return safeAICache.getStats();
}
