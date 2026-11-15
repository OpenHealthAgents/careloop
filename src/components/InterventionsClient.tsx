"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Edit3, Play, ShieldAlert, Sparkles, X } from "lucide-react";
import { ExecutionModeBadge, RiskTierBadge } from "./StatusBadges";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { EmptyState } from "./ui/EmptyState";
import { FeedbackBanner } from "./ui/FeedbackBanner";

interface InterventionItem {
  id: string;
  caseId: string;
  type: string;
  reason: string;
  triggeringBarrierCategory?: string | null;
  triggeringBarrierCode?: string | null;
  recommendedAction: string;
  executionMode: "AUTOMATED" | "HUMAN_ASSISTED" | "HUMAN_ONLY";
  automationEligible: boolean;
  isHighRisk: boolean;
  confidence: number;
  requiredHumanInvolvement: string;
  expectedOutcome: string;
  autoExecuted: boolean;
  status: string;
  epistemicOrigin: string;
  evidence?: unknown;
  outcomes?: Array<{
    id: string;
    outcomeStatus: string;
    summary: string;
    barriersResolved: boolean;
    followUpRequired: boolean;
    recordedAt: string;
    recordedBy?: { name: string } | null;
  }>;
  careCase: {
    id: string;
    riskLevel: string;
    priorityScore: number;
    member: { firstName: string; lastName: string };
    referral: { externalReferralId: string; specialty: string };
  };
}

export function InterventionsClient({
  interventions,
  canApprove,
  canExecute,
}: {
  interventions: InterventionItem[];
  canApprove: boolean;
  canExecute: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modeFilter, setModeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [modifyingId, setModifyingId] = useState<string | null>(null);
  const [modifyText, setModifyText] = useState("");
  const [outcomeTargetId, setOutcomeTargetId] = useState<string | null>(null);
  const [outcomeSummary, setOutcomeSummary] = useState("");
  const [barriersResolved, setBarriersResolved] = useState(true);
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; label: string } | null>(null);

  const filtered = useMemo(
    () =>
      interventions.filter((inv) => {
        if (modeFilter !== "ALL" && inv.executionMode !== modeFilter) return false;
        if (statusFilter !== "ALL" && inv.status !== statusFilter) return false;
        return true;
      }),
    [interventions, modeFilter, statusFilter]
  );

  async function decide(id: string, payload: Record<string, unknown>, message: string) {
    setBusyId(id);
    setBanner(null);
    try {
      const res = await fetch(`/api/interventions/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setBanner({ type: "error", text: json.error?.message ?? "Action failed" });
      } else {
        setBanner({ type: "success", text: message });
        router.refresh();
      }
    } catch {
      setBanner({ type: "error", text: "Network error performing action." });
    } finally {
      setBusyId(null);
    }
  }

  async function runAutomated(id: string) {
    setBusyId(id);
    setBanner(null);
    try {
      const res = await fetch(`/api/interventions/${id}/execute`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setBanner({
          type: "error",
          text: json.error?.message ?? "Automated execution blocked by safety policy.",
        });
      } else {
        setBanner({
          type: "success",
          text: "Automated low/medium-risk intervention executed and outcome recorded.",
        });
        router.refresh();
      }
    } catch {
      setBanner({ type: "error", text: "Network error running automated intervention." });
    } finally {
      setBusyId(null);
    }
  }

  async function logOutcome(id: string) {
    if (!outcomeSummary.trim()) return;
    setBusyId(id);
    setBanner(null);
    try {
      const res = await fetch(`/api/interventions/${id}/outcomes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcomeStatus: barriersResolved ? "BARRIER_RESOLVED" : "FOLLOW_UP_NEEDED",
          summary: outcomeSummary.trim(),
          barriersResolved,
          followUpRequired,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBanner({ type: "error", text: json.error?.message ?? "Failed to record intervention outcome." });
      } else {
        setOutcomeTargetId(null);
        setOutcomeSummary("");
        setBanner({ type: "success", text: "Intervention outcome recorded cleanly in audit history." });
        router.refresh();
      }
    } catch {
      setBanner({ type: "error", text: "Network error recording outcome." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-700">Classification:</span>
          {["ALL", "AUTOMATED", "HUMAN_ASSISTED", "HUMAN_ONLY"].map((mode) => (
            <button
              key={mode}
              onClick={() => setModeFilter(mode)}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                modeFilter === mode
                  ? "bg-teal-700 text-white"
                  : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {mode.replaceAll("_", " ")}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="statusFilter" className="font-semibold text-slate-700">
            Status:
          </label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs"
          >
            <option value="ALL">All Statuses</option>
            <option value="RECOMMENDED">RECOMMENDED</option>
            <option value="APPROVED">APPROVED</option>
            <option value="MODIFIED">MODIFIED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="FAILED">FAILED</option>
          </select>
        </div>
      </div>

      {banner && (
        <FeedbackBanner
          type={banner.type}
          text={banner.text}
          onDismiss={() => setBanner(null)}
        />
      )}

      <div className="space-y-3">
        {filtered.map((inv) => {
          const evidenceList = Array.isArray(inv.evidence)
            ? inv.evidence.map(String)
            : [];
          const canAutoRun =
            canExecute &&
            inv.status === "RECOMMENDED" &&
            inv.executionMode === "AUTOMATED" &&
            inv.automationEligible &&
            !inv.isHighRisk &&
            inv.careCase.riskLevel !== "HIGH";

          return (
            <div
              key={inv.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {inv.type.replaceAll("_", " ")}
                    </span>
                    <ExecutionModeBadge mode={inv.executionMode} isHighRisk={inv.isHighRisk} />
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-800">
                      {inv.status}
                    </span>
                    {inv.autoExecuted && (
                      <span className="rounded bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                        AUTO-EXECUTED
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      Confidence: {Math.round((inv.confidence ?? 0.75) * 100)}%
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <Link
                      href={`/cases/${inv.caseId}`}
                      className="font-semibold text-teal-700 hover:underline"
                    >
                      {inv.careCase.member.firstName} {inv.careCase.member.lastName}
                    </Link>
                    <span>•</span>
                    <span>{inv.careCase.referral.externalReferralId}</span>
                    <span>•</span>
                    <RiskTierBadge
                      riskTier={inv.careCase.riskLevel}
                      score={inv.careCase.priorityScore}
                    />
                    <span>•</span>
                    <span>
                      Barrier:{" "}
                      <strong>
                        {inv.triggeringBarrierCategory ?? "UNKNOWN"} /{" "}
                        {inv.triggeringBarrierCode ?? "Barrier unknown"}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {canAutoRun && (
                    <button
                      disabled={busyId !== null}
                      onClick={() => runAutomated(inv.id)}
                      className="inline-flex items-center gap-1 rounded bg-sky-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Run Automated Action
                    </button>
                  )}

                  {canApprove && inv.status === "RECOMMENDED" && (
                    <>
                      <button
                        disabled={busyId !== null}
                        onClick={() =>
                          decide(inv.id, { decision: "APPROVE" }, "Intervention approved.")
                        }
                        className="inline-flex items-center gap-1 rounded bg-teal-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </button>
                      <button
                        disabled={busyId !== null}
                        onClick={() => {
                          setModifyingId(inv.id);
                          setModifyText(inv.recommendedAction);
                        }}
                        className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Modify
                      </button>
                      <button
                        disabled={busyId !== null}
                        onClick={() =>
                          setRejectTarget({
                            id: inv.id,
                            label: `${inv.careCase.referral.externalReferralId} (${inv.type.replaceAll("_", " ")})`,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </>
                  )}

                  {canExecute && (inv.status === "APPROVED" || inv.status === "MODIFIED") && (
                    <button
                      disabled={busyId !== null}
                      onClick={() => decide(inv.id, { decision: "START" }, "Intervention started.")}
                      className="inline-flex items-center gap-1 rounded bg-sky-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Start
                    </button>
                  )}

                  {canExecute &&
                    (inv.status === "APPROVED" ||
                      inv.status === "MODIFIED" ||
                      inv.status === "IN_PROGRESS") && (
                      <button
                        disabled={busyId !== null}
                        onClick={() =>
                          decide(
                            inv.id,
                            {
                              decision: "COMPLETE",
                              outcome: "Intervention executed cleanly from Interventions Queue",
                              barriersResolved: true,
                              followUpRequired: false,
                            },
                            "Intervention marked completed and outcome recorded."
                          )
                        }
                        className="rounded bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                      >
                        Mark Complete
                      </button>
                    )}

                  {canExecute && inv.status !== "RECOMMENDED" && inv.status !== "REJECTED" && (
                    <button
                      disabled={busyId !== null}
                      onClick={() => {
                        setOutcomeTargetId(outcomeTargetId === inv.id ? null : inv.id);
                        setOutcomeSummary("");
                      }}
                      className="rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Track Outcome
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3 rounded-lg bg-slate-50 p-3 text-xs">
                <div>
                  <div className="font-semibold text-slate-700">Action & Rationale</div>
                  <p className="mt-1 text-slate-800">{inv.recommendedAction}</p>
                  <p className="mt-1 text-slate-500">Rationale: {inv.reason}</p>
                </div>

                <div>
                  <div className="font-semibold text-slate-700">Human Involvement & Automation</div>
                  <p className="mt-1 text-slate-700">{inv.requiredHumanInvolvement}</p>
                  <p className="mt-1 text-slate-500">
                    Automation Eligible:{" "}
                    <strong>{inv.automationEligible ? "Yes (LOW/MED Risk Only)" : "No — Approval Required"}</strong>
                  </p>
                  {inv.isHighRisk && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-rose-700">
                      <ShieldAlert className="h-3 w-3" />
                      High-risk safeguard active: never auto-executed.
                    </p>
                  )}
                </div>

                <div>
                  <div className="font-semibold text-slate-700">Expected Outcome & Evidence</div>
                  <p className="mt-1 text-slate-800">{inv.expectedOutcome}</p>
                  {evidenceList.length > 0 && (
                    <ul className="mt-1.5 list-disc pl-4 space-y-0.5 text-[11px] text-slate-600">
                      {evidenceList.slice(0, 3).map((ev, idx) => (
                        <li key={idx}>{ev}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {modifyingId === inv.id && (
                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <input
                    type="text"
                    value={modifyText}
                    onChange={(e) => setModifyText(e.target.value)}
                    className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-xs"
                  />
                  <button
                    onClick={async () => {
                      await decide(
                        inv.id,
                        { decision: "MODIFY", modifiedAction: modifyText },
                        "Intervention modified and approved."
                      );
                      setModifyingId(null);
                    }}
                    className="rounded bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Save & Approve
                  </button>
                  <button
                    onClick={() => setModifyingId(null)}
                    className="rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {outcomeTargetId === inv.id && (
                <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                  <div className="font-semibold text-slate-800">Record Intervention Outcome</div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      placeholder="Summarize what happened (e.g., NEMT ride voucher booked for Tuesday)..."
                      value={outcomeSummary}
                      onChange={(e) => setOutcomeSummary(e.target.value)}
                      className="flex-1 min-w-60 rounded border border-slate-300 px-3 py-1.5"
                    />
                    <label className="inline-flex items-center gap-1.5 text-slate-700">
                      <input
                        type="checkbox"
                        checked={barriersResolved}
                        onChange={(e) => setBarriersResolved(e.target.checked)}
                      />
                      Barrier resolved
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-slate-700">
                      <input
                        type="checkbox"
                        checked={followUpRequired}
                        onChange={(e) => setFollowUpRequired(e.target.checked)}
                      />
                      Follow-up required
                    </label>
                    <button
                      onClick={() => logOutcome(inv.id)}
                      className="rounded bg-emerald-700 px-3 py-1.5 font-semibold text-white hover:bg-emerald-600"
                    >
                      Save Outcome
                    </button>
                  </div>
                </div>
              )}

              {inv.outcomes && inv.outcomes.length > 0 && (
                <div className="border-t border-slate-100 pt-2.5 space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Tracked Outcomes ({inv.outcomes.length})
                  </div>
                  {inv.outcomes.map((out) => (
                    <div
                      key={out.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded bg-emerald-50/60 px-3 py-1.5 text-xs text-emerald-900"
                    >
                      <span>
                        <strong>{out.outcomeStatus}:</strong> {out.summary}
                      </span>
                      <span className="text-[11px] text-emerald-700">
                        {out.barriersResolved ? "Barrier Resolved" : "Barrier Still Active"} •{" "}
                        {new Date(out.recordedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <EmptyState
            title="No interventions match the selected filters"
            description="Adjust execution classification or status filters to inspect queued care interventions."
            action={
              (modeFilter !== "ALL" || statusFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setModeFilter("ALL");
                    setStatusFilter("ALL");
                  }}
                  className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600"
                >
                  Reset Filters
                </button>
              )
            }
          />
        )}
      </div>

      <ConfirmDialog
        open={rejectTarget !== null}
        title={`Reject Intervention (${rejectTarget?.label ?? ""})?`}
        description="Provide a brief operational rationale for rejecting this recommendation; the decision is stored in the immutable audit log."
        confirmLabel="Confirm Reject"
        tone="danger"
        requireNote
        busy={busyId !== null}
        onCancel={() => setRejectTarget(null)}
        onConfirm={async (note) => {
          if (!rejectTarget) return;
          await decide(rejectTarget.id, { decision: "REJECT", notes: note }, "Intervention rejected.");
          setRejectTarget(null);
        }}
      />
    </div>
  );
}
