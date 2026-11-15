"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  BarChart2,
  CheckCircle2,
  Clock,
  Filter,
  Scale,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { CareLoopStageBar } from "./CareLoopStageBar";
import { CaseStatusBadge, RiskTierBadge } from "./StatusBadges";
import { FeedbackBanner } from "./ui/FeedbackBanner";

interface ExecutiveDashboardClientProps {
  initialData: any;
}

export function ExecutiveDashboardClient({ initialData }: ExecutiveDashboardClientProps) {
  const [data, setData] = useState<any>(initialData);
  const [loading, setLoading] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [geography, setGeography] = useState("");
  const [referralType, setReferralType] = useState("");
  const [barrier, setBarrier] = useState("");
  const [intervention, setIntervention] = useState("");
  const [providerId, setProviderId] = useState("");
  const [populationSelection, setPopulationSelection] = useState(""); // e.g., "preferredLanguage:Spanish"
  const [showReconciliation, setShowReconciliation] = useState(true);

  async function applyFilters(overrides?: Partial<Record<string, string>>) {
    setLoading(true);
    try {
      const vals = {
        dateFrom: overrides?.dateFrom ?? dateFrom,
        dateTo: overrides?.dateTo ?? dateTo,
        geography: overrides?.geography ?? geography,
        referralType: overrides?.referralType ?? referralType,
        barrier: overrides?.barrier ?? barrier,
        intervention: overrides?.intervention ?? intervention,
        providerId: overrides?.providerId ?? providerId,
        populationSelection: overrides?.populationSelection ?? populationSelection,
      };

      const sp = new URLSearchParams();
      if (vals.dateFrom) sp.set("dateFrom", vals.dateFrom);
      if (vals.dateTo) sp.set("dateTo", vals.dateTo);
      if (vals.geography) sp.set("geography", vals.geography);
      if (vals.referralType) sp.set("referralType", vals.referralType);
      if (vals.barrier) sp.set("barrier", vals.barrier);
      if (vals.intervention) sp.set("intervention", vals.intervention);
      if (vals.providerId) sp.set("providerId", vals.providerId);
      if (vals.populationSelection) {
        const [dim, val] = vals.populationSelection.split("::");
        if (dim && val) {
          sp.set("populationDimension", dim);
          sp.set("cohortValue", val);
        }
      }

      const res = await fetch(`/api/dashboard?${sp.toString()}`);
      if (res.ok) {
        setFilterError(null);
        setData(await res.json());
      } else {
        setFilterError("Unable to apply dashboard filter combination; showing previous verified metrics.");
      }
    } catch {
      setFilterError("Network error updating dashboard metrics.");
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setGeography("");
    setReferralType("");
    setBarrier("");
    setIntervention("");
    setProviderId("");
    setPopulationSelection("");
    applyFilters({
      dateFrom: "",
      dateTo: "",
      geography: "",
      referralType: "",
      barrier: "",
      intervention: "",
      providerId: "",
      populationSelection: "",
    });
  }

  const opts = data.filterOptions ?? {};

  return (
    <div className="space-y-6" aria-busy={loading}>
      <CareLoopStageBar activeStage="IDENTIFY" />
      {filterError && (
        <FeedbackBanner
          type="error"
          text={filterError}
          onDismiss={() => setFilterError(null)}
        />
      )}
      {/* Multi-Dimensional Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
            <Filter className="h-4 w-4 text-teal-700" />
            Executive Cohort & Source Reconciliation Filters
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => applyFilters()}
              disabled={loading}
              className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Apply Filters"}
            </button>
            <button
              type="button"
              onClick={clearFilters}
              disabled={loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <input
            type="date"
            aria-label="Date from"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5"
          />
          <input
            type="date"
            aria-label="Date to"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5"
          />
          <select
            aria-label="Geography filter"
            value={geography}
            onChange={(e) => setGeography(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
          >
            <option value="">All Geographies</option>
            {(opts.geographies ?? []).map((g: string) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select
            aria-label="Referral type filter"
            value={referralType}
            onChange={(e) => setReferralType(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
          >
            <option value="">All Referral Types / Specialties</option>
            {(opts.referralTypes ?? []).map((s: string) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            aria-label="Barrier filter"
            value={barrier}
            onChange={(e) => setBarrier(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
          >
            <option value="">All Barriers</option>
            {(opts.barriers ?? []).map((b: string) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select
            aria-label="Intervention filter"
            value={intervention}
            onChange={(e) => setIntervention(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
          >
            <option value="">All Interventions</option>
            {(opts.interventions ?? []).map((inv: string) => (
              <option key={inv} value={inv}>
                {inv.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <select
            aria-label="Provider filter"
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
          >
            <option value="">All Providers</option>
            {(opts.providers ?? []).map((p: { id: string; name: string }) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Population cohort filter"
            value={populationSelection}
            onChange={(e) => setPopulationSelection(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
          >
            <option value="">All Populations / Cohorts</option>
            {(opts.languages ?? []).map((l: string) => (
              <option key={`lang-${l}`} value={`preferredLanguage::${l}`}>
                Language: {l}
              </option>
            ))}
            {(opts.urbanicity ?? []).map((u: string) => (
              <option key={`urb-${u}`} value={`urbanicity::${u}`}>
                Urbanicity: {u}
              </option>
            ))}
            {(opts.coverageTypes ?? []).map((cov: string) => (
              <option key={`cov-${cov}`} value={`coverageType::${cov}`}>
                Coverage: {cov}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* North-Star Metric Hero */}
      <div className="rounded-2xl border border-teal-200 bg-linear-to-r from-teal-900 to-slate-900 p-6 text-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-700/60 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-teal-100">
              <CheckCircle2 className="h-3.5 w-3.5" />
              North-Star Outcome Metric
            </div>
            <h2 className="text-lg font-bold">
              Eligible Referrals Resulting in a Verified Completed Behavioral-Health Visit
            </h2>
            <p className="text-xs text-slate-300">
              Reconciled directly from eligible Referral records and verified CompletionVerification
              signals. Outreach sent or appointments merely scheduled never count.
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-extrabold text-teal-300">
              {data.northStar.ratePct}%
            </div>
            <div className="mt-1 text-xs text-slate-200 font-medium">
              {data.northStar.completedEligibleCount} completed / {data.northStar.eligibleReferralsCount} eligible referrals
            </div>
          </div>
        </div>
      </div>

      {/* 1. VOLUME & 2. CONVERSION */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-teal-700" />
            <h2 className="text-sm font-semibold text-slate-900">Volume (Reconciled Source Counts)</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Referrals Received</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{data.volume.referralsReceived}</div>
              <div className="text-[11px] text-slate-500">{data.volume.eligibleReferrals} eligible</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Active Cases</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {data.kpis.activeCasesCount ?? 0}
              </div>
              <div className="text-[11px] text-slate-500">open care journeys</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Members Prioritized</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{data.volume.membersPrioritized}</div>
              <div className="text-[11px] text-slate-500">distinct risk-scored members</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Interventions Initiated</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{data.volume.interventionsInitiated}</div>
              <div className="text-[11px] text-slate-500">
                of {data.volume.interventionsRecommendedTotal} staged
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-teal-700" />
            <h2 className="text-sm font-semibold text-slate-900">Conversion Progression</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-3.5">
              <div className="text-xs font-semibold text-slate-600">Referrals → Appointments</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {data.conversion.referralsToAppointments.pct}%
              </div>
              <div className="text-xs text-slate-500">
                {data.conversion.referralsToAppointments.numerator} /{" "}
                {data.conversion.referralsToAppointments.denominator} cases
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3.5">
              <div className="text-xs font-semibold text-slate-600">Appointments → Completed Visits</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {data.conversion.appointmentsToCompletedVisits.pct}%
              </div>
              <div className="text-xs text-slate-500">
                {data.conversion.appointmentsToCompletedVisits.numerator} /{" "}
                {data.conversion.appointmentsToCompletedVisits.denominator} scheduled cases
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3.5">
              <div className="text-xs font-semibold text-slate-600">Completed → Continued Engagement</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {data.conversion.completedVisitsToContinuedEngagement.pct}%
              </div>
              <div className="text-xs text-slate-500">
                {data.conversion.completedVisitsToContinuedEngagement.numerator} /{" "}
                {data.conversion.completedVisitsToContinuedEngagement.denominator} completed visits
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. EFFICIENCY & 4. OUTCOMES */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-sky-700" />
            <h2 className="text-sm font-semibold text-slate-900">Efficiency</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Median Time to Care</div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {data.efficiency.medianTimeToCareDays !== null &&
                data.efficiency.medianTimeToCareDays !== undefined
                  ? `${data.efficiency.medianTimeToCareDays}d`
                  : "N/A"}
              </div>
              <div className="text-[11px] text-slate-500">
                {data.efficiency.avgDaysToCare !== null
                  ? `Avg ${data.efficiency.avgDaysToCare}d • Appt ${data.efficiency.avgTimeToAppointmentDays ?? "N/A"}d`
                  : "Median days to visit"}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Intervention Success</div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {data.efficiency.interventionSuccessRatePct}%
              </div>
              <div className="text-[11px] text-slate-500">
                {data.efficiency.interventionSuccessCount} /{" "}
                {data.efficiency.interventionEvaluatedCount} resolved
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Human Hours / Completed</div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {data.efficiency.humanHoursPerCompletedCase !== null
                  ? `${data.efficiency.humanHoursPerCompletedCase}h`
                  : "N/A"}
              </div>
              <div className="text-[11px] text-slate-500">
                across {data.kpis.completedCount} completed
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            <strong>Reconciliation Formula:</strong> {data.efficiency.humanHoursFormula}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-700" />
            <h2 className="text-sm font-semibold text-slate-900">Outcomes</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-[11px] font-semibold text-slate-500">Referral Completion</div>
              <div className="mt-1 text-xl font-bold text-emerald-700">
                {data.outcomes.referralCompletionRatePct}%
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-[11px] font-semibold text-slate-500">Appt Completion</div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {data.outcomes.appointmentCompletionRatePct}%
              </div>
              <div className="text-[10px] text-slate-500">
                {data.outcomes.appointmentCompletedCount}/{data.outcomes.appointmentFinalizedCount}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-[11px] font-semibold text-slate-500">No-Show Rate</div>
              <div className="mt-1 text-xl font-bold text-rose-700">
                {data.outcomes.noShowRatePct}%
              </div>
              <div className="text-[10px] text-slate-500">{data.outcomes.noShowCount} no-shows</div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-[11px] font-semibold text-slate-500">Unable-to-Reach</div>
              <div className="mt-1 text-xl font-bold text-amber-700">
                {data.outcomes.unableToReachRatePct ?? 0}%
              </div>
              <div className="text-[10px] text-slate-500">
                {data.outcomes.unableToReachCount ?? 0} cases
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-[11px] font-semibold text-slate-500">Escalation Rate</div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {data.outcomes.escalationRatePct ?? 0}%
              </div>
              <div className="text-[10px] text-slate-500">
                {data.outcomes.escalationCount ?? data.kpis.escalatedCount ?? 0} escalated
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-[11px] font-semibold text-slate-500">Provider Match</div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {data.outcomes.providerMatchSuccessPct}%
              </div>
              <div className="text-[10px] text-slate-500">
                {data.outcomes.verifiedSlotMatchesCount} verified slots
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4b. AGENTIC EXECUTION & HUMAN OVERSIGHT */}
      {data.agenticMetrics && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Agentic Execution & Human Oversight
              </h2>
            </div>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-medium text-teal-800 border border-teal-200">
              {data.agenticMetrics.objective ??
                "Successful equitable care execution — do not optimize automation rate blindly."}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-[11px] font-semibold text-slate-500">Agent Runs</div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {data.agenticMetrics.agentRuns}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-[11px] font-semibold text-slate-500">Successful Runs</div>
              <div className="mt-1 text-xl font-bold text-emerald-700">
                {data.agenticMetrics.successfulRuns}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-[11px] font-semibold text-slate-500">Human Handoffs</div>
              <div className="mt-1 text-xl font-bold text-amber-700">
                {data.agenticMetrics.humanHandoffs}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-[11px] font-semibold text-slate-500">Approval Rate</div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {data.agenticMetrics.approvalRatePct}%
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-[11px] font-semibold text-slate-500">Tool Failure Rate</div>
              <div className="mt-1 text-xl font-bold text-rose-700">
                {data.agenticMetrics.toolFailureRatePct}%
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-[11px] font-semibold text-slate-500">Avg Actions/Case</div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {data.agenticMetrics.averageActionsPerCase}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-[11px] font-semibold text-slate-500">Avg Time/Case</div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {data.agenticMetrics.averageTimePerCaseSec}s
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-[11px] font-semibold text-slate-500">Automation Rate</div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {data.agenticMetrics.automationRatePct}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. EQUITY, BARRIERS & INTERVENTION EFFECTIVENESS */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-teal-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              Health Equity, Disparity Gaps & Intervention Effectiveness
            </h2>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-900">
              Time-to-Care Disparity Spread:{" "}
              {data.equity.disparityInTimeToCareDays !== null
                ? `${data.equity.disparityInTimeToCareDays}d`
                : "N/A"}
            </span>
            <span className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 font-semibold text-rose-900">
              Completion Rate Disparity Spread:{" "}
              {data.equity.disparityInAppointmentCompletionPctPts !== null
                ? `${data.equity.disparityInAppointmentCompletionPctPts} pts`
                : "N/A"}
            </span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-3">
            <div className="text-xs font-semibold text-slate-800">
              Completion by Language & Urbanicity
            </div>
            <div className="space-y-2 text-xs">
              {[...(data.equity.byLanguage ?? []), ...(data.equity.byUrbanicity ?? [])].map(
                (row: any) => (
                  <div
                    key={`${row.dimension}-${row.cohort}`}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">{row.cohort}</span>
                      <span className="ml-1.5 text-[11px] text-slate-500">
                        ({row.completedCases}/{row.totalCases})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{row.completionRatePct}%</span>
                      <span className="text-[11px] text-slate-500">
                        {row.avgTimeToCareDays !== null ? `${row.avgTimeToCareDays}d` : "—"}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="lg:col-span-3 space-y-3">
            <div className="text-xs font-semibold text-slate-800">Barrier Distribution</div>
            <div className="space-y-2 text-xs">
              {data.barrierBreakdown.map((b: any) => (
                <div
                  key={b.category}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <span className="font-medium text-slate-800">
                    {b.category.replaceAll("_", " ")}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {b.count} ({b.pct}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-3">
            <div className="text-xs font-semibold text-slate-800">Intervention Effectiveness</div>
            <div className="space-y-2 text-xs">
              {(data.equity.interventionEffectiveness ?? []).map((row: any) => (
                <div
                  key={row.interventionType}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <span className="font-medium text-slate-800">
                    {row.interventionType.replaceAll("_", " ")}
                  </span>
                  <span className="font-semibold text-teal-800">
                    {row.completionRatePct}% ({row.completedCasesWithIntervention}/{row.totalUsed})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 6. SOURCE DATA RECONCILIATION / TRACEABILITY TABLE */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-700" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Metric Traceability & Source Reconciliation ({data.reconciliationRows.length} Cases)
              </h2>
              <p className="text-xs text-slate-500">
                Every count and percentage above reconciles directly to these filtered underlying records.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowReconciliation((s) => !s)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            {showReconciliation ? "Hide Records" : "Inspect Records"}
          </button>
        </div>

        {showReconciliation && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Referral ID</th>
                  <th className="px-4 py-3">Member & Cohort</th>
                  <th className="px-4 py-3">Geography & Specialty</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Barrier</th>
                  <th className="px-4 py-3">Matched Provider</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Verified Visit</th>
                  <th className="px-4 py-3 text-right">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.reconciliationRows.map((r: any) => (
                  <tr key={r.caseId} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono font-semibold text-slate-800">
                      {r.externalReferralId}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-900">{r.memberName}</div>
                      <div className="text-[11px] text-slate-500">
                        {r.preferredLanguage} • {r.coverageType}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      <div>{r.geography}</div>
                      <div className="text-[11px] text-slate-500">{r.specialty}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <RiskTierBadge riskTier={r.riskLevel} score={r.priorityScore} />
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{r.primaryBarrierCategory}</td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {r.matchedProviderName ?? <span className="text-slate-400">Unmatched</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <CaseStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      {r.hasVerifiedVisit ? (
                        <span className="font-semibold text-emerald-700">
                          Verified{" "}
                          {r.firstCompletedVisitAt
                            ? `(${new Date(r.firstCompletedVisitAt).toLocaleDateString()})`
                            : ""}
                        </span>
                      ) : (
                        <span className="text-slate-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/cases/${r.caseId}`}
                        className="font-semibold text-teal-700 hover:underline"
                      >
                        Inspect Case →
                      </Link>
                    </td>
                  </tr>
                ))}
                {data.reconciliationRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      No cases match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
