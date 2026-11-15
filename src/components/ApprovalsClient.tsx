"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { TenantApprovalListItem } from "@/services/approval-service";

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-100 text-rose-800 border-rose-200",
  EXPIRED: "bg-slate-100 text-slate-600 border-slate-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

export function ApprovalsClient({
  initialApprovals,
  canDecide,
}: {
  initialApprovals: TenantApprovalListItem[];
  canDecide: boolean;
}) {
  const [approvals, setApprovals] = useState<TenantApprovalListItem[]>(initialApprovals);
  const [filter, setFilter] = useState<string>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(
    null
  );

  async function refreshList() {
    const res = await fetch("/api/approvals", { cache: "no-store" });
    const data = await res.json();
    if (res.ok && Array.isArray(data.approvals)) {
      setApprovals(data.approvals);
    }
  }

  async function handleDecision(
    approvalId: string,
    decision: "APPROVED" | "REJECTED" | "CANCELLED",
    resumeImmediately = false
  ) {
    setBusyId(approvalId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/approvals/${approvalId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, resumeImmediately }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "Approval action failed");
      }
      await refreshList();
      setFeedback({
        kind: "success",
        text: resumeImmediately
          ? "Approval granted and paused agent execution resumed."
          : `Approval ${decision.toLowerCase()} successfully.`,
      });
    } catch (err) {
      setFeedback({
        kind: "error",
        text: err instanceof Error ? err.message : "Approval action failed",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleResume(approvalId: string) {
    setBusyId(approvalId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/approvals/${approvalId}/resume`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "Resume agent failed");
      }
      await refreshList();
      setFeedback({
        kind: "success",
        text: "Agent execution resumed from persisted approval state.",
      });
    } catch (err) {
      setFeedback({
        kind: "error",
        text: err instanceof Error ? err.message : "Resume agent failed",
      });
    } finally {
      setBusyId(null);
    }
  }

  const filtered =
    filter === "ALL" ? approvals : approvals.filter((item) => item.status === filter);
  const pendingCount = approvals.filter((a) => a.status === "PENDING").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {["ALL", "PENDING", "APPROVED", "REJECTED", "EXPIRED", "CANCELLED"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                filter === status
                  ? "bg-teal-700 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {status}
              {status === "PENDING" ? ` (${pendingCount})` : ""}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={refreshList}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {feedback && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${
            feedback.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Case / Member</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No approval requests match the selected filter.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.approval_id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <Link
                      href={`/cases/${item.case_id}`}
                      className="font-semibold text-teal-700 hover:underline"
                    >
                      {item.memberLabel}
                    </Link>
                    <div className="text-[11px] text-slate-500">
                      {item.specialty} · {item.caseStatus}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] font-semibold text-slate-800">
                    {item.action}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{item.risk_level}</td>
                  <td className="max-w-xs px-4 py-3 text-slate-600">{item.reason}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        STATUS_BADGE[item.status] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canDecide && item.status === "PENDING" && (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === item.approval_id}
                          onClick={() => handleDecision(item.approval_id, "APPROVED", true)}
                          className="rounded bg-teal-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                        >
                          Approve & Resume
                        </button>
                        <button
                          type="button"
                          disabled={busyId === item.approval_id}
                          onClick={() => handleDecision(item.approval_id, "REJECTED")}
                          className="rounded bg-rose-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={busyId === item.approval_id}
                          onClick={() => handleDecision(item.approval_id, "CANCELLED")}
                          className="rounded border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {canDecide && item.status === "APPROVED" && !item.resumed_at && (
                      <button
                        type="button"
                        disabled={busyId === item.approval_id}
                        onClick={() => handleResume(item.approval_id)}
                        className="rounded bg-indigo-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-800 disabled:opacity-50"
                      >
                        Resume Agent
                      </button>
                    )}
                    {item.resumed_at && (
                      <span className="text-[11px] text-emerald-700">Resumed</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
