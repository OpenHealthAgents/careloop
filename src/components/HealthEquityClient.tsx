"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Clock,
  GitCompare,
  Minus,
  Scale,
  TrendingUp,
} from "lucide-react";
import type { CohortMetric } from "@/domain/equity/analytics";
import { CareLoopStageBar } from "./CareLoopStageBar";

function SampleSizeBadge({ n, isSmall, caution }: { n: number; isSmall: boolean; caution?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-800">
        n={n}
      </span>
      {isSmall && (
        <span
          title={caution ?? "Small cohort sample size"}
          className="inline-flex items-center gap-0.5 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900"
        >
          <AlertTriangle className="h-2.5 w-2.5" />
          Small Sample
        </span>
      )}
    </span>
  );
}

function TrendBadge({ trend }: { trend: string }) {
  if (trend === "INCREASING") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
        <ArrowUpRight className="h-3 w-3" />
        INCREASING GAP
      </span>
    );
  }
  if (trend === "DECREASING") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
        <ArrowDownRight className="h-3 w-3" />
        DECREASING GAP
      </span>
    );
  }
  if (trend === "STABLE") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
        <Minus className="h-3 w-3" />
        STABLE
      </span>
    );
  }
  return <span className="text-[10px] text-slate-400">Insufficient trend data</span>;
}

function CohortTable({ title, rows }: { title: string; rows: CohortMetric[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Cohort</th>
              <th className="px-3 py-2">Sample (n)</th>
              <th className="px-3 py-2">Completion</th>
              <th className="px-3 py-2">Disparity vs Avg</th>
              <th className="px-3 py-2">Trend</th>
              <th className="px-3 py-2">Time to Care</th>
              <th className="px-3 py-2">Appt Comp / No-Show</th>
              <th className="px-3 py-2">Top Barrier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={`${r.dimension}-${r.cohort}`} className="hover:bg-slate-50">
                <td className="px-3 py-2.5 font-semibold text-slate-900">{r.cohort}</td>
                <td className="px-3 py-2.5">
                  <SampleSizeBadge n={r.totalCases} isSmall={r.isSmallSample} caution={r.sampleCaution} />
                </td>
                <td className="px-3 py-2.5 font-semibold text-slate-900">
                  {r.completionRatePct}%{" "}
                  <span className="text-[11px] font-normal text-slate-500">
                    ({r.completedCases}/{r.totalCases})
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`rounded px-1.5 py-0.5 font-semibold ${
                      r.disparityGapPctPoints < -5
                        ? "bg-rose-50 text-rose-800"
                        : r.disparityGapPctPoints > 5
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {r.disparityGapPctPoints > 0 ? `+${r.disparityGapPctPoints}` : r.disparityGapPctPoints} pts
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <TrendBadge trend={r.disparityTrend} />
                </td>
                <td className="px-3 py-2.5">
                  {r.avgTimeToCareDays !== null ? `${r.avgTimeToCareDays}d` : "N/A"}
                </td>
                <td className="px-3 py-2.5 text-slate-700">
                  {r.appointmentCompletionRatePct !== null ? `${r.appointmentCompletionRatePct}%` : "N/A"} /{" "}
                  <span className="text-rose-700">
                    {r.noShowRatePct !== null ? `${r.noShowRatePct}%` : "N/A"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-600">{r.topBarrier}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                  No cohort records available in the selected range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function HealthEquityClient({ initialData }: { initialData: any }) {
  const [data, setData] = useState<any>(initialData);
  const [loading, setLoading] = useState(false);

  const options = initialData.comparisonOptions ?? [];
  const defaultA = initialData.comparison?.cohortA
    ? `${initialData.comparison.cohortA.dimension}::${initialData.comparison.cohortA.cohort}`
    : options[0]?.key ?? "";
  const defaultB = initialData.comparison?.cohortB
    ? `${initialData.comparison.cohortB.dimension}::${initialData.comparison.cohortB.cohort}`
    : options[1]?.key ?? "";

  const [compareA, setCompareA] = useState<string>(defaultA);
  const [compareB, setCompareB] = useState<string>(defaultB);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  async function refreshEquity(nextA = compareA, nextB = compareB, from = dateFrom, to = dateTo) {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (nextA) sp.set("compareA", nextA);
      if (nextB) sp.set("compareB", nextB);
      if (from) sp.set("dateFrom", from);
      if (to) sp.set("dateTo", to);
      const res = await fetch(`/api/analytics/equity?${sp.toString()}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  const insights = data.insights ?? {};
  const compA = data.comparison?.cohortA as CohortMetric | null;
  const compB = data.comparison?.cohortB as CohortMetric | null;
  const deltas = data.comparison?.deltas ?? {};

  return (
    <div className="space-y-6">
      <CareLoopStageBar activeStage="LEARN" />
      {/* Governance & Sample Size Caution Banner */}
      <div className="flex flex-col gap-2 rounded-xl border border-teal-200 bg-teal-50 p-4 text-xs text-teal-950">
        <div className="flex items-start gap-2.5">
          <Scale className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
          <div>
            <div className="font-semibold">Equity Governance & Statistical Caution Guardrail</div>
            <p className="mt-0.5">{data.governanceNotice}</p>
            <p className="mt-1 text-teal-900">
              All cohorts show explicit sample size (<strong>n</strong>). Any cohort with{" "}
              <strong>n &lt; {data.minReliableCohortSize ?? 5}</strong> is flagged as{" "}
              <strong>Small Sample</strong> to prevent misleading conclusions from tiny sample sizes.
              Individual-level analytics are never exposed.
            </p>
          </div>
        </div>
      </div>

      {/* Disparity Monitoring */}
      {data.disparityMonitoring && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-600">
            Disparity Monitoring (Reliable Cohorts n ≥ {data.minReliableCohortSize ?? 5})
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { key: "disparityInAccess", label: "Disparity in Access" },
              { key: "disparityInCompletion", label: "Disparity in Completion" },
              { key: "disparityInTimeToCare", label: "Disparity in Time-to-Care" },
              { key: "disparityInInterventionSuccess", label: "Disparity in Intervention Success" },
            ].map((item) => {
              const m = data.disparityMonitoring[item.key];
              const badgeColor =
                m?.status === "ALERT"
                  ? "bg-rose-100 text-rose-800"
                  : m?.status === "OK"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-600";
              return (
                <div key={item.key} className="rounded-lg border border-slate-200 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800">{item.label}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badgeColor}`}>
                      {m?.status ?? "INSUFFICIENT_DATA"}
                    </span>
                  </div>
                  <div className="text-lg font-bold text-slate-900">
                    {m?.maxGap !== null && m?.maxGap !== undefined
                      ? `${m.maxGap} ${m.unit === "days" ? "days" : "pts"}`
                      : "N/A"}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Threshold: {m?.threshold} {m?.unit === "days" ? "days" : "pts"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6 Analytical Answers */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Q1: Lowest Completion */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
            <BarChart3 className="h-4 w-4 text-rose-600" />
            Lowest Referral Completion Cohorts
          </div>
          <div className="space-y-2 text-xs">
            {(insights.lowestCompletionCohorts ?? []).map((c: CohortMetric) => (
              <div
                key={`low-${c.dimension}-${c.cohort}`}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <div>
                  <div className="font-semibold text-slate-900">
                    {c.cohort}{" "}
                    <span className="text-[10px] font-normal text-slate-500">({c.dimension})</span>
                  </div>
                  <SampleSizeBadge n={c.totalCases} isSmall={c.isSmallSample} caution={c.sampleCaution} />
                </div>
                <span className="font-bold text-rose-700">{c.completionRatePct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Q2 & Q6: Longest Time-to-Care & Common Barriers */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
              <Clock className="h-4 w-4 text-amber-600" />
              Longest Time-to-Care Populations
            </div>
            <div className="space-y-1.5 text-xs">
              {(insights.longestTimeToCareCohorts ?? []).slice(0, 4).map((c: CohortMetric) => (
                <div
                  key={`time-${c.dimension}-${c.cohort}`}
                  className="flex items-center justify-between rounded bg-slate-50 px-3 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{c.cohort}</span>
                    <SampleSizeBadge n={c.totalCases} isSmall={c.isSmallSample} />
                  </div>
                  <span className="font-bold text-slate-900">{c.avgTimeToCareDays}d</span>
                </div>
              ))}
              {(!insights.longestTimeToCareCohorts || insights.longestTimeToCareCohorts.length === 0) && (
                <p className="text-xs text-slate-500">No completed visit timestamps yet.</p>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Most Common Barriers Overall
            </div>
            <div className="space-y-1.5 text-xs">
              {(insights.mostCommonBarriers ?? []).map((b: { category: string; count: number; pct: number }) => (
                <div key={b.category} className="flex justify-between">
                  <span className="text-slate-700">{b.category.replaceAll("_", " ")}</span>
                  <span className="font-semibold text-slate-900">
                    {b.count} ({b.pct}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Q3, Q4 & Q5: Best Interventions & Disparity Reduction / Trends */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
              <TrendingUp className="h-4 w-4 text-emerald-700" />
              Interventions Reducing Disparities
            </div>
            <p className="text-[11px] text-slate-500">
              Completion lift inside trailing/underserved cohorts (With vs. Without intervention).
            </p>
            <div className="space-y-1.5 text-xs">
              {(insights.disparityReducingInterventions ?? []).slice(0, 4).map((row: any) => (
                <div
                  key={row.interventionType}
                  className="rounded border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">
                      {row.interventionType.replaceAll("_", " ")}
                    </span>
                    <span
                      className={`font-bold ${
                        row.liftPctPoints > 0 ? "text-emerald-700" : "text-slate-600"
                      }`}
                    >
                      {row.liftPctPoints > 0 ? `+${row.liftPctPoints}` : row.liftPctPoints} pts lift
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      With: {row.rateWithInterventionPct}% vs Without: {row.rateWithoutInterventionPct}%
                    </span>
                    <SampleSizeBadge
                      n={row.underservedTotalWithIntervention}
                      isSmall={row.isSmallSample}
                      caution={row.sampleCaution}
                    />
                  </div>
                </div>
              ))}
              {(!insights.disparityReducingInterventions ||
                insights.disparityReducingInterventions.length === 0) && (
                <p className="text-xs text-slate-500">No underserved intervention lift data yet.</p>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs">
            <div className="font-bold uppercase tracking-wide text-slate-600">
              Disparity Direction (Earlier vs Recent Referrals)
            </div>
            {(insights.disparityTrends ?? []).slice(0, 4).map((t: CohortMetric) => (
              <div key={`trend-${t.dimension}-${t.cohort}`} className="flex items-center justify-between">
                <span className="text-slate-700">
                  {t.cohort} (n={t.totalCases})
                </span>
                <TrendBadge trend={t.disparityTrend} />
              </div>
            ))}
            {(!insights.disparityTrends || insights.disparityTrends.length === 0) && (
              <p className="text-[11px] text-slate-500">
                Requires referrals spanning multiple time intervals to compute increasing vs. decreasing disparity trends.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Side-by-Side Cohort Comparison */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-teal-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              Side-by-Side Cohort Comparison
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              type="date"
              aria-label="Equity date from"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1"
            />
            <input
              type="date"
              aria-label="Equity date to"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1"
            />
            <select
              aria-label="Cohort A"
              value={compareA}
              onChange={(e) => setCompareA(e.target.value)}
              className="rounded border border-slate-300 bg-white px-2.5 py-1"
            >
              {options.map((opt: any) => (
                <option key={`a-${opt.key}`} value={opt.key}>
                  A: {opt.cohort} ({opt.dimension}, n={opt.totalCases})
                </option>
              ))}
            </select>
            <span className="font-semibold text-slate-500">vs</span>
            <select
              aria-label="Cohort B"
              value={compareB}
              onChange={(e) => setCompareB(e.target.value)}
              className="rounded border border-slate-300 bg-white px-2.5 py-1"
            >
              {options.map((opt: any) => (
                <option key={`b-${opt.key}`} value={opt.key}>
                  B: {opt.cohort} ({opt.dimension}, n={opt.totalCases})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={loading}
              onClick={() => refreshEquity(compareA, compareB, dateFrom, dateTo)}
              className="rounded-lg bg-teal-700 px-3 py-1.5 font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
            >
              {loading ? "Comparing..." : "Compare"}
            </button>
          </div>
        </div>

        {compA && compB ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
              <div className="text-slate-500 font-semibold">Completion Rate</div>
              <div className="mt-1 font-bold text-slate-900">
                {compA.cohort}: {compA.completionRatePct}% vs {compB.cohort}: {compB.completionRatePct}%
              </div>
              <div className="mt-1 text-[11px] text-slate-600">
                Delta: <strong>{deltas.completionRateDiffPctPts} pts</strong> (n={compA.totalCases} vs n=
                {compB.totalCases})
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
              <div className="text-slate-500 font-semibold">Time to Care (Avg Days)</div>
              <div className="mt-1 font-bold text-slate-900">
                {compA.avgTimeToCareDays ?? "N/A"}d vs {compB.avgTimeToCareDays ?? "N/A"}d
              </div>
              <div className="mt-1 text-[11px] text-slate-600">
                Delta:{" "}
                <strong>
                  {deltas.avgTimeToCareDiffDays !== null ? `${deltas.avgTimeToCareDiffDays}d` : "N/A"}
                </strong>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
              <div className="text-slate-500 font-semibold">Appointment Completion Rate</div>
              <div className="mt-1 font-bold text-slate-900">
                {compA.appointmentCompletionRatePct ?? "N/A"}% vs{" "}
                {compB.appointmentCompletionRatePct ?? "N/A"}%
              </div>
              <div className="mt-1 text-[11px] text-slate-600">
                Delta:{" "}
                <strong>
                  {deltas.appointmentCompletionDiffPctPts !== null
                    ? `${deltas.appointmentCompletionDiffPctPts} pts`
                    : "N/A"}
                </strong>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
              <div className="text-slate-500 font-semibold">No-Show Rate & Top Barrier</div>
              <div className="mt-1 font-bold text-slate-900">
                {compA.noShowRatePct ?? "N/A"}% vs {compB.noShowRatePct ?? "N/A"}%
              </div>
              <div className="mt-1 text-[11px] text-slate-600">
                Barriers: {compA.topBarrier} vs {compB.topBarrier}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Select two cohorts above to inspect comparative metrics.</p>
        )}
      </div>

      {/* Dimension Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CohortTable title="By Preferred Language" rows={data.byLanguage ?? []} />
        <CohortTable title="By Urbanicity / Geography" rows={data.byUrbanicity ?? []} />
        <CohortTable title="By Coverage Type" rows={data.byCoverage ?? []} />
        <CohortTable title="By Age Group Cohort" rows={data.byAgeGroup ?? []} />
      </div>

      <CohortTable
        title="By Race / Ethnicity Cohort (Monitoring & Equity Evaluation Only)"
        rows={data.byRaceEthnicity ?? []}
      />
    </div>
  );
}
