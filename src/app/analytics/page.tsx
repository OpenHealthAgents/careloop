import React from "react";
import { AgentEvaluationPanel } from "@/components/AgentEvaluationPanel";
import { ObservabilityDashboardClient } from "@/components/ObservabilityDashboardClient";
import { AppShell } from "@/components/AppShell";
import { requirePageSession } from "@/lib/auth/page-session";
import { getDashboardAnalytics, getHealthEquityAnalytics } from "@/services/analytics-service";
import { getAgentEvaluationReport } from "@/services/evaluation-service";
import { getObservabilityMetrics } from "@/services/observability-service";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const { session, permissions } = await requirePageSession("analytics.read");
  const [dashboard, equity, evaluation, observabilityMetrics] = await Promise.all([
    getDashboardAnalytics(session.tenantId),
    getHealthEquityAnalytics(session.tenantId),
    getAgentEvaluationReport(session),
    getObservabilityMetrics(session),
  ]);

  return (
    <AppShell
      user={session}
      permissions={permissions}
      title="Analytics & Agent Observability"
      subtitle="Operational conversion metrics, agent & tool reliability, workflow transitions, human workload, and case outcomes."
    >
      <div className="space-y-6">
        {/* Observability Dashboards (Agent Reliability, Tool Reliability, Workflow Reliability, Human Workload, Case Outcomes) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">
            Agent & System Observability Dashboards
          </h2>
          <ObservabilityDashboardClient initialMetrics={observabilityMetrics} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-900">
            Intervention Effectiveness (Referral-to-Completed-Visit)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Tracks which non-clinical interventions correlate with verified completed visits.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Intervention</th>
                  <th className="px-3 py-2">Cases</th>
                  <th className="px-3 py-2">Completed</th>
                  <th className="px-3 py-2">Completion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {equity.interventionEffectiveness.map((row) => (
                  <tr key={row.interventionType}>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {row.interventionType.replaceAll("_", " ")}
                    </td>
                    <td className="px-3 py-2">{row.totalUsed}</td>
                    <td className="px-3 py-2">{row.completedCasesWithIntervention}</td>
                    <td className="px-3 py-2 font-semibold text-teal-800">
                      {row.completionRatePct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-900">Case Workflow State Breakdown</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Current distribution across active, completed, and exception/escalated states.
          </p>
          <div className="mt-4 space-y-2">
            {dashboard.statusBreakdown.map((s) => (
              <div
                key={s.status}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
              >
                <span className="font-semibold text-slate-800">{s.status}</span>
                <span className="font-bold text-slate-900">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>

      <AgentEvaluationPanel initialReport={evaluation} />
    </AppShell>
  );
}
