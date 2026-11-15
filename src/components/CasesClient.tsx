"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Search, UserCheck } from "lucide-react";
import { CASE_SIDE_STATES, CASE_STATUS_ORDER } from "@/domain/cases/state-machine";
import { CaseStatusBadge, RiskTierBadge } from "./StatusBadges";
import { EmptyState } from "./ui/EmptyState";

interface CaseListItem {
  id: string;
  status: string;
  riskLevel: string;
  priorityScore: number;
  primaryBarrierCategory?: string | null;
  primaryBarrierCode?: string | null;
  humanReviewRequired: boolean;
  firstCompletedVisitAt?: string | null;
  updatedAt: string;
  member: {
    firstName: string;
    lastName: string;
    externalMemberId: string;
    preferredLanguage: string;
  };
  referral: {
    externalReferralId: string;
    specialty: string;
    urgency: string;
  };
  assignedTo?: { id: string; name: string; role: string } | null;
  _count: {
    barriers?: number;
    interventions: number;
    appointments: number;
    verifications: number;
    communications?: number;
    caseNotes?: number;
  };
}

const ALL_STATUSES = [...CASE_STATUS_ORDER, ...CASE_SIDE_STATES];

export function CasesClient({ cases }: { cases: CaseListItem[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [languageFilter, setLanguageFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"ALL" | "ACTIVE" | "EXCEPTION" | "COMPLETED">("ALL");

  const availableLanguages = useMemo(
    () => Array.from(new Set(cases.map((c) => c.member.preferredLanguage))).sort(),
    [cases]
  );

  const stats = useMemo(() => {
    const exceptionSet = new Set<string>(CASE_SIDE_STATES);
    return {
      total: cases.length,
      active: cases.filter(
        (c) => c.status !== "CLOSED" && c.status !== "VERIFIED" && !exceptionSet.has(c.status)
      ).length,
      exceptions: cases.filter((c) => exceptionSet.has(c.status) || c.humanReviewRequired).length,
      completed: cases.filter((c) => c.status === "VERIFIED" || c.status === "CLOSED").length,
    };
  }, [cases]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const exceptionSet = new Set<string>(CASE_SIDE_STATES);

    return cases.filter((c) => {
      if (viewMode === "ACTIVE") {
        if (c.status === "CLOSED" || c.status === "VERIFIED" || exceptionSet.has(c.status)) {
          return false;
        }
      } else if (viewMode === "EXCEPTION") {
        if (!exceptionSet.has(c.status) && !c.humanReviewRequired) return false;
      } else if (viewMode === "COMPLETED") {
        if (c.status !== "VERIFIED" && c.status !== "CLOSED") return false;
      }

      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (riskFilter !== "ALL" && c.riskLevel !== riskFilter) return false;
      if (languageFilter !== "ALL" && c.member.preferredLanguage !== languageFilter) return false;

      if (q) {
        const haystack = [
          c.referral.externalReferralId,
          c.referral.specialty,
          c.member.firstName,
          c.member.lastName,
          c.member.externalMemberId,
          c.primaryBarrierCode ?? "",
          c.assignedTo?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [cases, viewMode, statusFilter, riskFilter, languageFilter, search]);

  const hasFilters =
    viewMode !== "ALL" || statusFilter !== "ALL" || riskFilter !== "ALL" || languageFilter !== "ALL" || search.trim() !== "";

  function resetFilters() {
    setViewMode("ALL");
    setStatusFilter("ALL");
    setRiskFilter("ALL");
    setLanguageFilter("ALL");
    setSearch("");
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <button
          onClick={() => setViewMode("ALL")}
          className={`rounded-xl border p-3.5 text-left transition ${
            viewMode === "ALL"
              ? "border-teal-600 bg-teal-50/50"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <div className="text-xs font-medium text-slate-500">All Tenant Cases</div>
          <div className="mt-1 text-xl font-bold text-slate-900">{stats.total}</div>
        </button>

        <button
          onClick={() => setViewMode("ACTIVE")}
          className={`rounded-xl border p-3.5 text-left transition ${
            viewMode === "ACTIVE"
              ? "border-teal-600 bg-teal-50/50"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <div className="text-xs font-medium text-slate-500">Active Coordination</div>
          <div className="mt-1 text-xl font-bold text-sky-700">{stats.active}</div>
        </button>

        <button
          onClick={() => setViewMode("EXCEPTION")}
          className={`rounded-xl border p-3.5 text-left transition ${
            viewMode === "EXCEPTION"
              ? "border-amber-600 bg-amber-50/60"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Escalated / Human Review
          </div>
          <div className="mt-1 text-xl font-bold text-amber-700">{stats.exceptions}</div>
        </button>

        <button
          onClick={() => setViewMode("COMPLETED")}
          className={`rounded-xl border p-3.5 text-left transition ${
            viewMode === "COMPLETED"
              ? "border-emerald-600 bg-emerald-50/50"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <div className="text-xs font-medium text-slate-500">Verified / Closed</div>
          <div className="mt-1 text-xl font-bold text-emerald-700">{stats.completed}</div>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="relative flex-1 min-w-56">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search member, referral ID, specialty, barrier, assignee..."
            className="w-full rounded-lg border border-slate-300 py-1.5 pl-9 pr-3 text-xs focus:border-teal-600 focus:outline-none"
          />
        </div>

        <select
          aria-label="Filter by Case Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
        >
          <option value="ALL">All Statuses</option>
          {ALL_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by Risk Tier"
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
        >
          <option value="ALL">All Risk Tiers</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
          <option value="UNKNOWN">UNKNOWN</option>
        </select>

        <select
          aria-label="Filter by Preferred Language"
          value={languageFilter}
          onChange={(e) => setLanguageFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
        >
          <option value="ALL">All Languages</option>
          {availableLanguages.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Clear ({filtered.length}/{cases.length})
          </button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Referral ID</th>
              <th className="px-4 py-3">Member & Specialty</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Barrier</th>
              <th className="px-4 py-3">Assignee</th>
              <th className="px-4 py-3">Workspace Activity</th>
              <th className="px-4 py-3">Verified Visit</th>
              <th className="px-4 py-3 text-right">Workspace</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                  {c.referral.externalReferralId}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">
                    {c.member.firstName} {c.member.lastName}
                  </div>
                  <div className="text-xs text-slate-500">
                    {c.referral.specialty} • {c.member.preferredLanguage}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <CaseStatusBadge status={c.status} />
                    <span className="text-[11px] font-medium text-slate-700">
                      {c.humanReviewRequired
                        ? "Review Required"
                        : c.status === "NEW" || c.status === "TRIAGED"
                          ? "Triage & Discovery"
                          : c.status === "BARRIER_IDENTIFIED"
                            ? "Provider Matching"
                            : c.status === "INTERVENTION_IN_PROGRESS"
                              ? "Member Outreach"
                              : c.status === "APPOINTMENT_SCHEDULED"
                                ? "Visit Reminder"
                                : c.status === "APPOINTMENT_COMPLETED"
                                  ? "Verify Claim Signal"
                                  : c.status === "VERIFIED"
                                    ? "Verified Complete"
                                    : "Monitoring"}
                    </span>
                    {c.humanReviewRequired && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800">
                        <UserCheck className="h-3 w-3" />
                        Human Review Flag
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <RiskTierBadge riskTier={c.riskLevel} score={c.priorityScore} />
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="font-medium text-slate-800">
                    {c.primaryBarrierCode ?? "Barrier unknown"}
                  </div>
                  <div className="text-slate-500">{c.primaryBarrierCategory ?? "UNKNOWN"}</div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-700">
                  {c.assignedTo ? c.assignedTo.name : <span className="text-slate-400">Unassigned</span>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {c._count.interventions} interv. • {c._count.appointments} appt. •{" "}
                  {c._count.caseNotes ?? 0} notes • {c._count.verifications} verif.
                </td>
                <td className="px-4 py-3 text-xs">
                  {c.firstCompletedVisitAt ? (
                    <span className="font-semibold text-emerald-700">
                      {new Date(c.firstCompletedVisitAt).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-slate-400">Pending</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/cases/${c.id}`}
                    className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Open Case →
                  </Link>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6">
                  <EmptyState
                    title="No cases match current filters"
                    description="Try clearing search keywords or switching the status, risk tier, or preferred language filters."
                    action={
                      hasFilters && (
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600"
                        >
                          Reset All Filters
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
