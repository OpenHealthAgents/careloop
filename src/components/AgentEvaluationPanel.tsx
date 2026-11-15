"use client";

import React, { useState } from "react";
import type { AgentEvaluationReport } from "@/services/evaluation-service";

export function AgentEvaluationPanel({
  initialReport,
}: {
  initialReport: AgentEvaluationReport;
}) {
  const [report, setReport] = useState<AgentEvaluationReport>(initialReport);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRerun() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/evaluation", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "Failed to run agent evaluation suite");
      }
      setReport(data.evaluation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run agent evaluation suite");
    } finally {
      setRunning(false);
    }
  }

  const { benchmarkSuite, liveTelemetry } = report;

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Agent Evaluation & Policy Safety Suite
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Provider: {benchmarkSuite.providerName} ({benchmarkSuite.modelVersion}) · Prompt{" "}
            {benchmarkSuite.promptVersion}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRerun}
          disabled={running}
          className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {running ? "Running Suite..." : "Re-run Evaluation Suite"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="text-[11px] font-medium text-slate-500">Benchmark Pass Rate</div>
          <div className="mt-1 text-lg font-bold text-teal-800">
            {benchmarkSuite.passRatePct}% ({benchmarkSuite.passedCases}/{benchmarkSuite.totalCases})
          </div>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="text-[11px] font-medium text-slate-500">Policy Safety Compliance</div>
          <div className="mt-1 text-lg font-bold text-slate-900">
            {benchmarkSuite.policySafetyPassRatePct}%
          </div>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="text-[11px] font-medium text-slate-500">Live Agent Success Rate</div>
          <div className="mt-1 text-lg font-bold text-slate-900">
            {liveTelemetry.agentSuccessRatePct}% ({liveTelemetry.completedRuns}/
            {liveTelemetry.totalAgentRuns} runs)
          </div>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="text-[11px] font-medium text-slate-500">Avg Decision Confidence</div>
          <div className="mt-1 text-lg font-bold text-slate-900">
            {liveTelemetry.avgDecisionConfidence !== null
              ? `${Math.round(liveTelemetry.avgDecisionConfidence * 100)}%`
              : "N/A"}{" "}
            <span className="text-xs font-normal text-slate-500">
              ({liveTelemetry.totalDecisionTraces} traces)
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Passed</th>
              <th className="px-3 py-2">Pass Rate</th>
              <th className="px-3 py-2">Avg Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {benchmarkSuite.byCategory.map((cat) => (
              <tr key={cat.category}>
                <td className="px-3 py-2 font-medium text-slate-900">
                  {cat.category.replaceAll("_", " ")}
                </td>
                <td className="px-3 py-2">
                  {cat.passed}/{cat.total}
                </td>
                <td className="px-3 py-2 font-semibold text-teal-800">{cat.passRatePct}%</td>
                <td className="px-3 py-2">{cat.avgScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
