import type { SessionUser } from "@/lib/auth/session";
import { getDashboardAnalytics, getHealthEquityAnalytics } from "@/services/analytics-service";
import { getAgentEvaluationReport } from "@/services/evaluation-service";
import { getObservabilityMetrics } from "@/services/observability-service";
import type { AnalyticsProvider } from "./contracts";

export * from "./contracts";
export { getDashboardAnalytics, getHealthEquityAnalytics } from "@/services/analytics-service";
export { getAgentEvaluationReport } from "@/services/evaluation-service";
export { getLearningInsights } from "@/services/learning-loop-service";
export { getObservabilityMetrics } from "@/services/observability-service";

export class CareLoopAnalyticsProvider implements AnalyticsProvider {
  getDashboard(tenantId: string) {
    return getDashboardAnalytics(tenantId);
  }

  getEquity(tenantId: string) {
    return getHealthEquityAnalytics(tenantId);
  }

  getObservability(session: SessionUser) {
    return getObservabilityMetrics(session);
  }

  getEvaluation(session: SessionUser) {
    return getAgentEvaluationReport(session);
  }
}

export const careLoopAnalyticsProvider = new CareLoopAnalyticsProvider();
