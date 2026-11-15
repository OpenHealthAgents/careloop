import type { SessionUser } from "@/lib/auth/session";

export interface AnalyticsSnapshot {
  tenantId: string;
  generatedAt: string;
  data: Record<string, unknown>;
}

export interface AnalyticsProvider {
  getDashboard(tenantId: string): Promise<unknown>;
  getEquity(tenantId: string): Promise<unknown>;
  getObservability(session: SessionUser): Promise<unknown>;
  getEvaluation(session: SessionUser): Promise<unknown>;
}
