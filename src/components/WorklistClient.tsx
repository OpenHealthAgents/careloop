"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { CareLoopStageBar } from "./CareLoopStageBar";
import { CaseStatusBadge, RiskTierBadge } from "./StatusBadges";
import { EmptyState } from "./ui/EmptyState";
import { FeedbackBanner } from "./ui/FeedbackBanner";

interface WorklistCase {
  id: string;
  status: string;
  priorityScore: number;
  riskLevel: string;
  riskExplanation: string | null;
  humanReviewRequired: boolean;
  primaryBarrierCategory: string | null;
  primaryBarrierCode: string | null;
  referral: {
    externalReferralId: string;
    referralDate: string;
    specialty: string;
    urgency: string;
  };
  member: {
    firstName: string;
    lastName: string;
    preferredLanguage: string;
    geography: string;
  };
  matchedProvider: { name: string } | null;
  riskAssessments: Array<{
    score: number;
    riskLevel: string;
    confidence: number;
    explanation: string;
    evidenceSignals: unknown;
    modelVersion: string;
    assessedAt: string;
  }>;
}

export function WorklistClient({
  cases,
  canRunAi,
}: {
  cases: WorklistCase[];
  canRunAi: boolean;
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(cases[0]?.id ?? null);
  const [rescoringId, setRescoringId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter((c) => {
      if (riskFilter !== "ALL" && c.riskLevel !== riskFilter) return false;
      if (reviewOnly && !c.humanReviewRequired) return false;
      if (q) {
        const hay = `${c.referral.externalReferralId} ${c.member.firstName} ${c.member.lastName} ${c.referral.specialty} ${c.primaryBarrierCode ?? ""} ${c.member.geography}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cases, search, riskFilter, reviewOnly]);

  async function rescoreCase(caseId: string) {
    setRescoringId(caseId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/ai-assess`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setFeedback({ type: "error", text: json?.error?.message ?? "Failed to re-score referral." });
      } else {
        setFeedback({ type: "success", text: "Operational risk & barrier assessment refreshed." });
        router.refresh();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error re-scoring referral." });
    } finally {
      setRescoringId(null);
    }
  }

  return (
    <div className="space-y-3">
      <CareLoopStageBar activeStage="IDENTIFY" />
      {feedback && (
        <FeedbackBanner
          type={feedback.type}
          text={feedback.text}
          onDismiss={() => setFeedback(null)}
        />
      )}

      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600">
        <Info className="h-4 w-4 shrink-0 text-teal-700" />
        <span>
          Referrals are sorted by actionable non-completion risk. Protected characteristics are{" "}
          <strong>never</strong> used as individual risk predictors; scores reflect operational
          aging, provider availability, language/network fit, and engagement history.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs text-xs">
        <div className="relative flex-1 min-w-52">
          <Search className="pointer-events-none absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search worklist"
            placeholder="Search referral ID, member, specialty, barrier, geography..."
            className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-xs focus:border-teal-600 focus:outline-none"
          />
        </div>
        <select
          aria-label="Filter worklist by risk level"
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
        >
          <option value="ALL">All Risk Tiers ({cases.length})</option>
          <option value="HIGH">HIGH Risk</option>
          <option value="MEDIUM">MEDIUM Risk</option>
          <option value="LOW">LOW Risk</option>
          <option value="UNKNOWN">UNKNOWN</option>
        </select>
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={reviewOnly}
            onChange={(e) => setReviewOnly(e.target.checked)}
          />
          Human Review Required Only
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Risk & Confidence</th>
              <th scope="col" className="px-4 py-3">Referral & Member</th>
              <th scope="col" className="px-4 py-3">Why Prioritized (Evidence)</th>
              <th scope="col" className="px-4 py-3">Barrier & Provider</th>
              <th scope="col" className="px-4 py-3">What Happens Next?</th>
              <th scope="col" className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredCases.map((c) => {
              const latest = c.riskAssessments[0] ?? null;
              const rawSignals = Array.isArray(latest?.evidenceSignals)
                ? latest.evidenceSignals
                : [];
              const isExpanded = expandedId === c.id;

              return (
                <React.Fragment key={c.id}>
                  <tr className="hover:bg-slate-50 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <RiskTierBadge riskTier={c.riskLevel} score={c.priorityScore} />
                      <div className="mt-1 text-[11px] text-slate-500">
                        Confidence:{" "}
                        <strong className="text-slate-700">
                          {latest ? `${Math.round(latest.confidence * 100)}%` : "N/A"}
                        </strong>
                      </div>
                      {c.humanReviewRequired && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          <ShieldAlert className="h-3 w-3" />
                          Human Review
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-semibold text-slate-800">
                        {c.referral.externalReferralId}
                      </div>
                      <div className="font-medium text-slate-900">
                        {c.member.firstName} {c.member.lastName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {c.referral.specialty} • {c.member.preferredLanguage} • {c.member.geography}
                      </div>
                    </td>

                    <td className="px-4 py-3 max-w-md">
                      <p className="text-xs text-slate-800 leading-relaxed">
                        {latest?.explanation ?? c.riskExplanation ?? "Pending risk explanation."}
                      </p>
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedId(isExpanded ? null : c.id)}
                        className="mt-1 text-[11px] font-semibold text-teal-700 hover:underline"
                      >
                        {isExpanded ? "Hide signal breakdown ↑" : "Inspect signal breakdown ↓"}
                      </button>
                    </td>

                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium text-slate-800">
                        {c.primaryBarrierCode ?? "Barrier unknown"}
                      </div>
                      <div className="text-slate-500">{c.primaryBarrierCategory ?? "UNKNOWN"}</div>
                      <div className="mt-1 text-slate-600">
                        {c.matchedProvider ? c.matchedProvider.name : "No provider matched"}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <CaseStatusBadge status={c.status} />
                      </div>
                      <div className="text-xs font-semibold text-slate-800">
                        {c.humanReviewRequired
                          ? "Review & Authorize Action"
                          : c.status === "NEW" || c.status === "TRIAGED"
                            ? "Barrier Detection & Routing"
                            : c.status === "BARRIER_IDENTIFIED"
                              ? "Match In-Network Provider"
                              : c.status === "INTERVENTION_IN_PROGRESS"
                                ? "Outreach & Slot Selection"
                                : c.status === "APPOINTMENT_SCHEDULED"
                                  ? "24-Hour Pre-Visit Check-In"
                                  : c.status === "APPOINTMENT_COMPLETED"
                                    ? "Corroborate Claim & Verify"
                                    : c.status === "VERIFIED"
                                      ? "Finalize Outcome Closure"
                                      : c.status === "ESCALATED"
                                        ? "Resolve Escalated Blocker"
                                        : "Continue Monitoring"}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {c.humanReviewRequired
                          ? "Care Manager gate active"
                          : "Guarded autonomous execution"}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap space-y-1.5">
                      <div>
                        <Link
                          href={`/cases/${c.id}`}
                          className="inline-flex items-center rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600"
                        >
                          Open Case
                        </Link>
                      </div>
                      {canRunAi && (
                        <div>
                          <button
                            type="button"
                            disabled={rescoringId !== null}
                            onClick={() => rescoreCase(c.id)}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <RefreshCw
                              className={`h-3 w-3 ${rescoringId === c.id ? "animate-spin" : ""}`}
                            />
                            Re-score
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-slate-50/80">
                      <td colSpan={6} className="px-4 py-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <span className="font-semibold text-slate-800">
                            Risk Factor Breakdown
                          </span>
                          {latest && (
                            <span className="text-[11px] text-slate-500">
                              Model: <code className="text-slate-700">{latest.modelVersion}</code> •
                              Calculated: {new Date(latest.assessedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {rawSignals.length > 0 ? (
                            rawSignals.map((sig: any, idx: number) =>
                              typeof sig === "string" ? (
                                <span
                                  key={idx}
                                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-700"
                                >
                                  {sig}
                                </span>
                              ) : (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-800"
                                >
                                  <span className="rounded bg-rose-50 px-1.5 py-0.5 font-bold text-rose-800">
                                    +{sig.points}
                                  </span>
                                  <span>{sig.signal}</span>
                                </span>
                              )
                            )
                          ) : (
                            <span className="text-slate-500">
                              {c.riskExplanation ?? "Baseline operational risk."}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {filteredCases.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6">
                  <EmptyState
                    title="No prioritized referrals match current filters"
                    description="Reset search keywords, risk tier, or Human Review toggle to view open prioritized referrals."
                    action={
                      (search || riskFilter !== "ALL" || reviewOnly) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch("");
                            setRiskFilter("ALL");
                            setReviewOnly(false);
                          }}
                          className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600"
                        >
                          Clear Filters
                        </button>
                      )
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
