"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertOctagon,
  CalendarPlus,
  Check,
  CheckCircle2,
  Edit3,
  FileText,
  History,
  MessageSquare,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import { BARRIER_TAXONOMY } from "@/domain/barriers/taxonomy";
import { buildCaseGoal, CASE_SIDE_STATES, CASE_STATUS_ORDER } from "@/domain/cases/state-machine";
import {
  AvailabilitySourceBadge,
  CaseStatusBadge,
  EpistemicBadge,
  ExecutionModeBadge,
  RiskTierBadge,
} from "./StatusBadges";
import { CaseBriefPanel } from "./CaseBriefPanel";
import { CareLoopStageBar } from "./CareLoopStageBar";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { FeedbackBanner } from "./ui/FeedbackBanner";
import type { Permission } from "@/lib/auth/rbac";
import { BarrierCategory, CaseStatus, VerificationSignalType } from "@prisma/client";

interface CaseDetailClientProps {
  initialData: {
    careCase: any;
    rankedProviders: any[];
    allowedNextStatuses: CaseStatus[];
  };
  permissions: Permission[];
}

export function CaseDetailClient({ initialData, permissions }: CaseDetailClientProps) {
  const router = useRouter();
  const permSet = new Set(permissions);
  const { careCase, rankedProviders, allowedNextStatuses } = initialData;

  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Barrier confirmation form
  const [barrierCat, setBarrierCat] = useState<BarrierCategory>(
    careCase.primaryBarrierCategory ?? "UNKNOWN"
  );
  const [barrierSub, setBarrierSub] = useState<string>(
    careCase.primaryBarrierCode ?? "Barrier unknown"
  );
  const [barrierNote, setBarrierNote] = useState("Confirmed with member during intake review");

  // Transition / Escalation form
  const [targetStatus, setTargetStatus] = useState<string>(allowedNextStatuses[0] ?? "");
  const [transitionReason, setTransitionReason] = useState("");
  const [escalationDetail, setEscalationDetail] = useState("");

  // Case Note form
  const [noteCategory, setNoteCategory] = useState<
    "COORDINATION" | "BARRIER_DISCOVERY" | "OUTREACH" | "ESCALATION" | "CLOSURE"
  >("COORDINATION");
  const [noteContent, setNoteContent] = useState("");

  // Outreach form
  const [outreachChannel, setOutreachChannel] = useState<"SMS" | "PHONE" | "EMAIL" | "PORTAL">(
    careCase.member.consentSms ? "SMS" : "PHONE"
  );
  const [outreachPurpose, setOutreachPurpose] = useState<string>("REFERRAL_NOTIFICATION");
  const [readingLevel, setReadingLevel] = useState<"SIMPLE" | "PLAIN" | "STANDARD">("PLAIN");
  const [outreachInterventionId, setOutreachInterventionId] = useState<string>(
    careCase.interventions?.[0]?.id ?? ""
  );
  const [draftedMessage, setDraftedMessage] = useState<string>("");

  // Appointment scheduling state
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    careCase.matchedProviderId ?? rankedProviders[0]?.provider?.id ?? ""
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string>(
    rankedProviders[0]?.nextVerifiedSlot?.id ?? ""
  );
  const [scheduledAt, setScheduledAt] = useState<string>(() => {
    const slot = rankedProviders[0]?.nextVerifiedSlot?.slotStartAt;
    if (slot) return new Date(slot).toISOString().slice(0, 16);
    const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [modality, setModality] = useState<"TELEHEALTH" | "IN_PERSON">("TELEHEALTH");

  // Verification form
  const [verifySignal, setVerifySignal] = useState<VerificationSignalType>("APPOINTMENT_COMPLETED");
  const [verifySource, setVerifySource] = useState("EHR_APPOINTMENT_FEED");
  const [verifyNote, setVerifyNote] = useState(
    "Confirmed member attended first 50-minute behavioral-health visit."
  );
  const [closeAfterVerify, setCloseAfterVerify] = useState(true);

  const [modifyingId, setModifyingId] = useState<string | null>(null);
  const [modifyActionText, setModifyActionText] = useState("");
  const [modifyingBarrierId, setModifyingBarrierId] = useState<string | null>(null);
  const [modifyBarrierCat, setModifyBarrierCat] = useState<BarrierCategory>("ACCESS");
  const [modifyBarrierSub, setModifyBarrierSub] = useState<string>("provider shortage");
  const [modifyBarrierNote, setModifyBarrierNote] = useState<string>("");
  const [overrideAction, setOverrideAction] = useState("");
  const [overrideRationale, setOverrideRationale] = useState("");
  const [evidenceSourceType, setEvidenceSourceType] = useState("CARE_MANAGER_ATTESTATION");
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [confirmState, setConfirmState] = useState<
    | null
    | {
        kind: "REJECT_INTERVENTION";
        id: string;
        label: string;
      }
    | {
        kind: "APPT_NO_SHOW" | "APPT_CANCEL";
        id: string;
        label: string;
      }
    | {
        kind: "ESCALATE_CASE";
      }
  >(null);

  async function apiAction(key: string, url: string, method: string, body?: unknown, successMsg?: string) {
    setBusy(key);
    setFeedback(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: json?.error?.message ?? "Action failed" });
        return null;
      }
      if (successMsg) {
        setFeedback({ type: "success", text: successMsg });
      }
      router.refresh();
      return json;
    } catch {
      setFeedback({ type: "error", text: "Network error performing action" });
      return null;
    } finally {
      setBusy(null);
    }
  }

  const latestTrace = careCase.aiRecommendations?.[0] ?? null;
  const canEditCase = permSet.has("cases.manage");
  const canApproveIntervention = permSet.has("interventions.approve");
  const canExecuteIntervention = permSet.has("interventions.execute");
  const canManageAppt = permSet.has("appointments.manage");
  const canVerify = permSet.has("completion.verify");
  const canEscalate = permSet.has("cases.escalate");
  const canSendOutreach = permSet.has("outreach.send");
  const canRunAi = permSet.has("ai.run");

  const subBarriersForSelectedCat = BARRIER_TAXONOMY[barrierCat]?.subBarriers ?? ["Barrier unknown"];

  const journeySteps = [
    { label: "Referral Received", done: true },
    { label: "Provider Matched", done: Boolean(careCase.matchedProviderId) },
    { label: "Appointment Scheduled", done: careCase.appointments.length > 0 },
    { label: "First Visit Verified", done: Boolean(careCase.firstCompletedVisitAt) },
  ];

  return (
    <div className="space-y-5">
      <CareLoopStageBar careCase={careCase} />
      {feedback && (
        <FeedbackBanner
          type={feedback.type}
          text={feedback.text}
          onDismiss={() => setFeedback(null)}
        />
      )}

      {/* Journey Progress Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm font-bold text-slate-800">
              {careCase.referral.externalReferralId}
            </span>
            <CaseStatusBadge status={careCase.status} />
            <RiskTierBadge riskTier={careCase.riskLevel} score={careCase.priorityScore} />
            {careCase.humanReviewRequired && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
                <UserCheck className="h-3.5 w-3.5" />
                Human Review Required
              </span>
            )}
          </div>
          {canRunAi && (
            <button
              disabled={busy !== null}
              onClick={() =>
                apiAction(
                  "ai-assess",
                  `/api/cases/${careCase.id}/ai-assess`,
                  "POST",
                  {},
                  "AI risk, barrier, and intervention recommendations refreshed."
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy === "ai-assess" ? "animate-spin" : ""}`} />
              Re-run AI Assessment
            </button>
          )}
        </div>

        <div className="mt-3 rounded-lg border border-teal-100 bg-teal-50/50 px-3 py-2 text-xs text-slate-800">
          <span className="font-semibold uppercase tracking-wide text-teal-800">Case Goal: </span>
          <span>{careCase.goal ?? buildCaseGoal({ specialty: careCase.referral?.specialty })}</span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {journeySteps.map((step, idx) => (
            <div
              key={step.label}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs font-semibold ${
                step.done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                  step.done ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                }`}
              >
                {step.done ? "✓" : idx + 1}
              </span>
              <span>{step.label}</span>
            </div>
          ))}
        </div>

        {/* Full 10-State Case Lifecycle Strip + Exception Alert */}
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Explicit Case Lifecycle Pipeline
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {CASE_STATUS_ORDER.map((st, idx) => {
              const currentIdx = CASE_STATUS_ORDER.indexOf(careCase.status);
              const isCurrent = careCase.status === st;
              const isPassed = currentIdx > idx;
              return (
                <span
                  key={st}
                  className={`rounded px-2 py-0.5 text-[10px] font-semibold border ${
                    isCurrent
                      ? "border-teal-600 bg-teal-700 text-white"
                      : isPassed
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                  }`}
                >
                  {idx + 1}. {st.replaceAll("_", " ")}
                </span>
              );
            })}
          </div>
          {(CASE_SIDE_STATES as string[]).includes(careCase.status) && (
            <div className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
              <strong>Exception State Active ({careCase.status}):</strong>{" "}
              {careCase.escalationReason ??
                "Case paused or flagged outside the happy path; resolve via explicit workflow transition once human review clears."}
            </div>
          )}
        </div>

        {/* Central Workspace Quick Navigation */}
        <nav aria-label="Case Workspace Section Shortcuts" className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 text-[11px] font-semibold">
          {[
            { href: "#barriers", label: "Barriers" },
            { href: "#interventions", label: "Interventions" },
            { href: "#appointments", label: "Matching & Scheduling" },
            { href: "#outcome", label: "Appointments & Verification" },
            { href: "#communications", label: "Communications" },
            { href: "#escalation", label: "Escalation & State" },
            { href: "#notes", label: "Notes" },
            { href: "#timeline", label: "Timeline" },
            { href: "#ai-recommendations", label: "Assessment Audit" },
            { href: "#audit-history", label: "Audit History" },
          ].map((nav) => (
            <a
              key={nav.href}
              href={nav.href}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-800"
            >
              {nav.label}
            </a>
          ))}
        </nav>
      </div>

      {/* Top Care Manager 10-Question Brief (Above the Fold) */}
      <CaseBriefPanel careCase={careCase} />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Main Operational Column */}
        <div className="space-y-6 lg:col-span-8">
          {/* 1. Epistemic Audit Trace (Collapsible Enterprise Disclosure) */}
          <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-slate-800 hover:text-teal-800">
              <span>
                Decision Support Basis: Observed Facts vs. Inferences vs. Non-Binding Recommendations
              </span>
              <span className="text-[11px] font-normal text-slate-500">
                {latestTrace
                  ? `${latestTrace.providerName} (${latestTrace.modelVersion}) • ${Math.round(
                      latestTrace.confidence * 100
                    )}% confidence — Click to expand`
                  : "No assessment recorded"}
              </span>
            </summary>

            {(careCase.riskAssessments?.[0] || careCase.riskExplanation) && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>Priority Rationale:</strong>{" "}
                    {careCase.riskAssessments?.[0]?.explanation ?? careCase.riskExplanation}
                  </span>
                  {careCase.riskAssessments?.[0] && (
                    <span className="text-[11px] text-slate-500">
                      {careCase.riskAssessments[0].modelVersion} • Confidence{" "}
                      {Math.round(careCase.riskAssessments[0].confidence * 100)}% •{" "}
                      {new Date(careCase.riskAssessments[0].assessedAt).toLocaleString()}
                    </span>
                  )}
                </div>
                {Array.isArray(careCase.riskAssessments?.[0]?.evidenceSignals) && (
                  <div className="flex flex-wrap gap-1.5">
                    {careCase.riskAssessments[0].evidenceSignals.map((sig: any, idx: number) =>
                      typeof sig === "string" ? (
                        <span
                          key={idx}
                          className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px]"
                        >
                          {sig}
                        </span>
                      ) : (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px]"
                        >
                          <strong className="text-rose-700">+{sig.points}</strong>
                          <span>{sig.signal}</span>
                        </span>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {latestTrace ? (
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <EpistemicBadge status="FACT" />
                    <span className="text-[11px] text-slate-500">Observed DB Signals</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {(latestTrace.facts as string[]).map((f, i) => (
                      <li key={i}>• {f}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <EpistemicBadge status="INFERENCE" />
                    <span className="text-[11px] text-slate-500">Not a Fact</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-700">
                    {(latestTrace.inferences as any[]).map((inf, i) => (
                      <li key={i}>
                        <div className="font-medium">{inf.statement}</div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          Uncertainty: {inf.uncertainty}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <EpistemicBadge status="RECOMMENDATION" />
                    <span className="text-[11px] text-slate-500">Human Decides</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-700">
                    {(latestTrace.recommendations as any[]).map((rec, i) => (
                      <li key={i}>
                        <div className="font-medium">{rec.action}</div>
                        <div className="mt-0.5 text-[11px] text-slate-500">{rec.rationale}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">No AI traces recorded yet.</p>
            )}
          </details>

          {/* Dedicated AI Recommendations Ledger */}
          <div id="ai-recommendations" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900">
              AI Recommendations & Traceability ({careCase.aiRecommendations?.length ?? 0})
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Every AI recommendation passes through policy guards, captures prompt/model versions,
              and awaits human accountability.
            </p>
            {careCase.aiRecommendations && careCase.aiRecommendations.length > 0 ? (
              <div className="mt-3 space-y-2.5">
                {careCase.aiRecommendations.map((rec: any) => (
                  <div key={rec.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{rec.operation}</span>
                        <span className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                          {rec.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {rec.providerName} ({rec.modelVersion}, prompt {rec.promptVersion}) • Conf{" "}
                        {Math.round((rec.confidence ?? 0) * 100)}%
                      </span>
                    </div>
                    {rec.resultingAction && (
                      <div className="text-slate-800">
                        <strong>Resulting Action:</strong> {rec.resultingAction}
                      </div>
                    )}
                    <div className="text-[11px] text-slate-500">
                      <strong>Uncertainty:</strong> {rec.uncertainty}
                      {rec.humanReviewer && (
                        <span>
                          {" "}
                          • Reviewed by <strong>{rec.humanReviewer.name}</strong> ({rec.humanReviewer.role})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">No AI recommendation records yet.</p>
            )}
          </div>

          {/* 2. Barrier Classification & Human Confirmation */}
          <div id="barriers" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900">
              Barrier Identification & Human Confirmation
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              AI-inferred barriers are never treated as facts until confirmed by a human coordinator.
              Insufficient evidence is labeled <strong>Barrier unknown</strong>.
            </p>

            <div className="mt-3 space-y-2.5">
              {careCase.barriers.map((b: any) => (
                <div
                  key={b.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <EpistemicBadge status={b.epistemicStatus} />
                      <span className="font-semibold text-slate-900">{b.category}</span>
                      <span className="text-slate-700">— {b.subBarrier}</span>
                      <span className="rounded bg-white border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                        {b.reviewStatus ?? (b.confirmedByHuman ? "ACCEPTED" : "PENDING_REVIEW")}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Source: <strong>{b.source ?? "DETERMINISTIC_RULES"}</strong>
                      {b.modelVersion ? ` (${b.modelVersion})` : ""} • Confidence{" "}
                      {b.confidence !== null && b.confidence !== undefined
                        ? `${Math.round(b.confidence * 100)}%`
                        : "N/A"}{" "}
                      • {new Date(b.detectedAt ?? b.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {(b.evidenceSummary || (Array.isArray(b.evidenceSignals) && b.evidenceSignals.length > 0)) && (
                    <div className="text-[11px] text-slate-700">
                      <strong>Evidence & Signals:</strong>{" "}
                      {b.evidenceSummary ??
                        (Array.isArray(b.evidenceSignals) ? b.evidenceSignals.join("; ") : "")}
                    </div>
                  )}

                  {b.uncertainty && (
                    <div className="text-[11px] text-slate-500">
                      <strong>Uncertainty:</strong> {b.uncertainty}
                    </div>
                  )}

                  {b.reviewNotes && (
                    <div className="text-[11px] text-teal-800">
                      <strong>Review Note:</strong> {b.reviewNotes}
                    </div>
                  )}

                  {canEditCase && b.reviewStatus !== "REJECTED" && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          apiAction(
                            `accept-barrier-${b.id}`,
                            `/api/barriers/${b.id}/review`,
                            "POST",
                            { action: "ACCEPT" },
                            `Barrier accepted as FACT: ${b.category} — ${b.subBarrier}.`
                          )
                        }
                        className="rounded bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setModifyingBarrierId(b.id);
                          setModifyBarrierCat(b.category);
                          setModifyBarrierSub(b.subBarrier);
                          setModifyBarrierNote(b.reviewNotes ?? "");
                        }}
                        className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Modify
                      </button>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          apiAction(
                            `reject-barrier-${b.id}`,
                            `/api/barriers/${b.id}/review`,
                            "POST",
                            {
                              action: "REJECT",
                              notes: "Rejected by Care Manager — insufficient supporting evidence",
                            },
                            "Barrier rejected and logged to audit trail."
                          )
                        }
                        className="rounded border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          apiAction(
                            `unknown-barrier-${b.id}`,
                            `/api/barriers/${b.id}/review`,
                            "POST",
                            {
                              action: "MARK_UNKNOWN",
                              notes: "Marked Barrier unknown pending direct member discovery",
                            },
                            "Barrier marked as Barrier unknown (UNKNOWN)."
                          )
                        }
                        className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                      >
                        Mark Unknown
                      </button>
                    </div>
                  )}

                  {modifyingBarrierId === b.id && (
                    <div className="mt-2 grid gap-2 border-t border-slate-200 pt-2 sm:grid-cols-3">
                      <select
                        value={modifyBarrierCat}
                        onChange={(e) => {
                          const cat = e.target.value as BarrierCategory;
                          setModifyBarrierCat(cat);
                          setModifyBarrierSub(BARRIER_TAXONOMY[cat].subBarriers[0]);
                        }}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        {(Object.keys(BARRIER_TAXONOMY) as BarrierCategory[]).map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                      <select
                        value={modifyBarrierSub}
                        onChange={(e) => setModifyBarrierSub(e.target.value)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        {(BARRIER_TAXONOMY[modifyBarrierCat]?.subBarriers ?? ["Barrier unknown"]).map(
                          (sub) => (
                            <option key={sub} value={sub}>
                              {sub}
                            </option>
                          )
                        )}
                      </select>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiAction(
                              `mod-barrier-${b.id}`,
                              `/api/barriers/${b.id}/review`,
                              "POST",
                              {
                                action: "MODIFY",
                                category: modifyBarrierCat,
                                subBarrier: modifyBarrierSub,
                                notes: modifyBarrierNote || "Modified by Care Manager",
                              },
                              `Barrier modified to ${modifyBarrierCat} — ${modifyBarrierSub}.`
                            );
                            setModifyingBarrierId(null);
                          }}
                          className="rounded bg-teal-700 px-2.5 py-1 text-xs font-semibold text-white"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setModifyingBarrierId(null)}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                      <input
                        type="text"
                        value={modifyBarrierNote}
                        onChange={(e) => setModifyBarrierNote(e.target.value)}
                        placeholder="Audit reason for modification"
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs sm:col-span-3"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {canEditCase && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                <div className="mb-2 text-xs font-semibold text-slate-700">
                  Confirm or Correct Primary Barrier (Writes FACT Record)
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <select
                    value={barrierCat}
                    onChange={(e) => {
                      const nextCat = e.target.value as BarrierCategory;
                      setBarrierCat(nextCat);
                      setBarrierSub(BARRIER_TAXONOMY[nextCat].subBarriers[0]);
                    }}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    {(Object.keys(BARRIER_TAXONOMY) as BarrierCategory[]).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>

                  <select
                    value={barrierSub}
                    onChange={(e) => setBarrierSub(e.target.value)}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    {subBarriersForSelectedCat.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>

                  <button
                    disabled={busy !== null}
                    onClick={() =>
                      apiAction(
                        "confirm-barrier",
                        `/api/cases/${careCase.id}/barriers`,
                        "POST",
                        {
                          category: barrierCat,
                          subBarrier: barrierSub,
                          evidenceNote: barrierNote,
                        },
                        `Barrier confirmed as FACT: ${barrierCat} — ${barrierSub}.`
                      )
                    }
                    className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    Confirm Barrier Fact
                  </button>
                </div>
                <input
                  type="text"
                  value={barrierNote}
                  onChange={(e) => setBarrierNote(e.target.value)}
                  placeholder="Supporting evidence note"
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
            )}
          </div>

          {/* 3. Interventions (Human-in-the-Loop) */}
          <div id="interventions" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900">
              Recommended & Active Interventions
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Approve, modify, reject, or execute coordinated interventions.
            </p>

            <div className="mt-3 space-y-3">
              {careCase.interventions.map((inv: any) => {
                const canAutoRun =
                  canExecuteIntervention &&
                  inv.status === "RECOMMENDED" &&
                  inv.executionMode === "AUTOMATED" &&
                  inv.automationEligible &&
                  !inv.isHighRisk &&
                  careCase.riskLevel !== "HIGH";
                const evidenceList = Array.isArray(inv.evidence)
                  ? inv.evidence.map(String)
                  : [];

                return (
                <div
                  key={inv.id}
                  className="rounded-lg border border-slate-200 p-3.5 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1 flex-1 min-w-60">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {inv.type.replaceAll("_", " ")}
                        </span>
                        <ExecutionModeBadge
                          mode={inv.executionMode ?? "HUMAN_ASSISTED"}
                          isHighRisk={inv.isHighRisk}
                        />
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {inv.status}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Confidence: {Math.round((inv.confidence ?? 0.75) * 100)}%
                        </span>
                        <span className="text-[11px] text-slate-400">{inv.epistemicOrigin}</span>
                      </div>
                      <p className="text-xs text-slate-800 font-medium">{inv.recommendedAction}</p>
                      <p className="text-[11px] text-slate-600">
                        <strong>Barrier:</strong>{" "}
                        {inv.triggeringBarrierCategory ?? "UNKNOWN"} /{" "}
                        {inv.triggeringBarrierCode ?? "Barrier unknown"} •{" "}
                        <strong>Rationale:</strong> {inv.reason}
                      </p>
                      {inv.requiredHumanInvolvement && (
                        <p className="text-[11px] text-slate-600">
                          <strong>Human Involvement:</strong> {inv.requiredHumanInvolvement}
                        </p>
                      )}
                      {inv.expectedOutcome && (
                        <p className="text-[11px] text-slate-600">
                          <strong>Expected Outcome:</strong> {inv.expectedOutcome}
                        </p>
                      )}
                      {evidenceList.length > 0 && (
                        <p className="text-[11px] text-slate-500">
                          <strong>Evidence:</strong> {evidenceList.slice(0, 2).join(" | ")}
                        </p>
                      )}
                      {inv.outcomes?.[0] && (
                        <p className="mt-1 text-xs font-medium text-emerald-700">
                          Tracked Outcome ({inv.outcomes[0].outcomeStatus}): {inv.outcomes[0].summary}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {canAutoRun && (
                        <button
                          disabled={busy !== null}
                          onClick={() =>
                            apiAction(
                              `auto-${inv.id}`,
                              `/api/interventions/${inv.id}/execute`,
                              "POST",
                              {},
                              "Low/medium-risk AUTOMATED intervention executed with audited outcome."
                            )
                          }
                          className="inline-flex items-center gap-1 rounded bg-sky-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-600"
                        >
                          <Sparkles className="h-3 w-3" />
                          Run Auto
                        </button>
                      )}
                      {canApproveIntervention && inv.status === "RECOMMENDED" && (
                        <>
                          <button
                            disabled={busy !== null}
                            onClick={() =>
                              apiAction(
                                `approve-${inv.id}`,
                                `/api/interventions/${inv.id}/review`,
                                "POST",
                                { decision: "APPROVE" },
                                "Intervention approved and moved into active execution."
                              )
                            }
                            className="inline-flex items-center gap-1 rounded bg-teal-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-600"
                          >
                            <Check className="h-3 w-3" />
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setModifyingId(inv.id);
                              setModifyActionText(inv.recommendedAction);
                            }}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Edit3 className="h-3 w-3" />
                            Modify
                          </button>
                          <button
                            disabled={busy !== null}
                            onClick={() =>
                              setConfirmState({
                                kind: "REJECT_INTERVENTION",
                                id: inv.id,
                                label: inv.type.replaceAll("_", " "),
                              })
                            }
                            className="inline-flex items-center gap-1 rounded border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            <X className="h-3 w-3" />
                            Reject
                          </button>
                        </>
                      )}

                      {canExecuteIntervention &&
                        (inv.status === "APPROVED" || inv.status === "MODIFIED") && (
                          <button
                            disabled={busy !== null}
                            onClick={() =>
                              apiAction(
                                `start-${inv.id}`,
                                `/api/interventions/${inv.id}/review`,
                                "POST",
                                { decision: "START" },
                                "Intervention started."
                              )
                            }
                            className="inline-flex items-center gap-1 rounded bg-sky-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-600"
                          >
                            <Play className="h-3 w-3" />
                            Start
                          </button>
                        )}

                      {canExecuteIntervention &&
                        (inv.status === "APPROVED" ||
                          inv.status === "MODIFIED" ||
                          inv.status === "IN_PROGRESS") && (
                          <button
                            disabled={busy !== null}
                            onClick={() =>
                              apiAction(
                                `complete-${inv.id}`,
                                `/api/interventions/${inv.id}/review`,
                                "POST",
                                {
                                  decision: "COMPLETE",
                                  outcome: "Intervention executed by care team",
                                },
                                "Intervention marked completed."
                              )
                            }
                            className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Complete
                          </button>
                        )}
                    </div>
                  </div>

                  {modifyingId === inv.id && (
                    <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                      <input
                        type="text"
                        value={modifyActionText}
                        onChange={(e) => setModifyActionText(e.target.value)}
                        className="flex-1 rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                      />
                      <button
                        onClick={async () => {
                          await apiAction(
                            `modify-${inv.id}`,
                            `/api/interventions/${inv.id}/review`,
                            "POST",
                            { decision: "MODIFY", modifiedAction: modifyActionText },
                            "Intervention modified and approved."
                          );
                          setModifyingId(null);
                        }}
                        className="rounded bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setModifyingId(null)}
                        className="rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>

          {/* 4. Provider Matching & Assisted Scheduling */}
          <div id="appointments" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900">
              Provider Matching & Assisted Scheduling
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              CareLoop explicitly distinguishes <strong>VERIFIED AVAILABILITY</strong> from stale{" "}
              <strong>DIRECTORY DATA</strong>.
            </p>

            <div className="mt-3 space-y-2.5">
              {rankedProviders.map((match: any) => (
                <div
                  key={match.provider.id}
                  className={`rounded-lg border p-3 text-xs ${
                    selectedProviderId === match.provider.id
                      ? "border-teal-500 bg-teal-50/40"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-semibold text-slate-900">
                        {match.provider.name}
                      </span>
                      <span className="ml-2 text-slate-500">
                        {match.provider.organizationName} • {match.provider.specialty}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-800">
                        Match {match.matchScore}%
                      </span>
                      <AvailabilitySourceBadge source={match.availabilityLabel} />
                    </div>
                  </div>
                  <div className="mt-1.5 text-slate-600">
                    Languages: {match.provider.languages.join(", ")} •{" "}
                    {match.provider.telehealthAvailable ? "Telehealth Available" : "In-Person Only"}
                  </div>
                  {match.availabilityWarning && (
                    <div className="mt-1.5 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
                      ⚠ {match.availabilityWarning}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      {match.reasons.join(" • ")}
                    </span>
                    {canManageAppt && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProviderId(match.provider.id);
                          if (match.nextVerifiedSlot) {
                            setSelectedSlotId(match.nextVerifiedSlot.id);
                            setScheduledAt(
                              new Date(match.nextVerifiedSlot.slotStartAt).toISOString().slice(0, 16)
                            );
                            setModality(match.nextVerifiedSlot.modality);
                          } else {
                            setSelectedSlotId("");
                          }
                        }}
                        className="rounded border border-teal-600 px-2.5 py-1 font-semibold text-teal-800 hover:bg-teal-50"
                      >
                        Select Provider
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {canManageAppt && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <CalendarPlus className="h-4 w-4 text-teal-700" />
                  Schedule Behavioral-Health Appointment
                </div>
                <div className="grid gap-2 sm:grid-cols-4">
                  <select
                    value={selectedProviderId}
                    onChange={(e) => {
                      setSelectedProviderId(e.target.value);
                      setSelectedSlotId("");
                    }}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs sm:col-span-2"
                  >
                    {rankedProviders.map((m: any) => (
                      <option key={m.provider.id} value={m.provider.id}>
                        {m.provider.name} ({m.availabilityLabel})
                      </option>
                    ))}
                  </select>

                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  />

                  <select
                    value={modality}
                    onChange={(e) => setModality(e.target.value as "TELEHEALTH" | "IN_PERSON")}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="TELEHEALTH">TELEHEALTH</option>
                    <option value="IN_PERSON">IN_PERSON</option>
                  </select>
                </div>
                <button
                  disabled={busy !== null || !selectedProviderId}
                  onClick={() =>
                    apiAction(
                      "schedule-appt",
                      `/api/cases/${careCase.id}/appointments`,
                      "POST",
                      {
                        providerId: selectedProviderId,
                        slotId: selectedSlotId || undefined,
                        scheduledStartAt: new Date(scheduledAt).toISOString(),
                        modality,
                      },
                      "Appointment scheduled and tracked."
                    )
                  }
                  className="mt-2.5 rounded-md bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
                >
                  Schedule Appointment
                </button>
              </div>
            )}
          </div>

          {/* 5. Appointments, Case Outcome & Completion Verification */}
          <div id="outcome" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900">
              Case Outcome, Appointments & Completion Verification
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Success is never &ldquo;Message sent&rdquo;. Track actual appointment attendance and verify
              visit completion via appointment, claim, or confirmation signals.
            </p>

            {/* Unified Case Outcome Summary */}
            <div className="mt-3 grid gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-3">
              <div>
                <div className="text-[11px] font-semibold uppercase text-slate-500">
                  Case Outcome Status
                </div>
                <div className="mt-0.5 font-semibold text-slate-900">
                  {careCase.firstCompletedVisitAt
                    ? "Visit Completion Verified"
                    : careCase.status === "CLOSED"
                      ? "Closed"
                      : "In Active Coordination"}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase text-slate-500">
                  First Completed Visit
                </div>
                <div className="mt-0.5 font-medium text-emerald-700">
                  {careCase.firstCompletedVisitAt
                    ? new Date(careCase.firstCompletedVisitAt).toLocaleString()
                    : "Pending verification"}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase text-slate-500">
                  Closure / Outcome Note
                </div>
                <div className="mt-0.5 text-slate-700">
                  {careCase.closureReason ??
                    `${careCase.verifications?.length ?? 0} verification signal(s) • ${
                      careCase.interventions?.reduce(
                        (acc: number, i: any) => acc + (i.outcomes?.length ?? 0),
                        0
                      ) ?? 0
                    } intervention outcome(s)`}
                </div>
              </div>
            </div>

            {careCase.firstCompletedVisitAt && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs">
                <span className="font-medium text-emerald-950">
                  <strong>Outcome Recorded:</strong> Completed visit contributes to live Executive Outcomes and Health Equity intervention learning.
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/dashboard"
                    className="rounded-md bg-emerald-700 px-2.5 py-1 font-semibold text-white hover:bg-emerald-600"
                  >
                    View Outcome Dashboard →
                  </Link>
                  <Link
                    href="/health-equity"
                    className="rounded-md border border-emerald-300 bg-white px-2.5 py-1 font-semibold text-emerald-900 hover:bg-emerald-100"
                  >
                    View Equity Analytics →
                  </Link>
                </div>
              </div>
            )}

            {careCase.appointments.length > 0 ? (
              <div className="mt-3 space-y-2.5">
                {careCase.appointments.map((appt: any) => (
                  <div
                    key={appt.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {appt.provider.name} • {appt.modality}
                      </div>
                      <div className="text-slate-600">
                        {new Date(appt.scheduledStartAt).toLocaleString()} • Status:{" "}
                        <strong>{appt.status}</strong>
                      </div>
                      <div className="mt-1">
                        <AvailabilitySourceBadge source={appt.availabilitySourceAtBooking} />
                      </div>
                    </div>
                    {canManageAppt && (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() =>
                            apiAction(
                              `remind-${appt.id}`,
                              `/api/appointments/${appt.id}`,
                              "PATCH",
                              { action: "SEND_REMINDER" },
                              "Appointment reminder dispatched."
                            )
                          }
                          className="rounded border border-slate-300 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Send Reminder
                        </button>
                        {(appt.status === "REQUESTED" || appt.status === "PROPOSED") && (
                          <button
                            onClick={() =>
                              apiAction(
                                `schedule-${appt.id}`,
                                `/api/appointments/${appt.id}`,
                                "PATCH",
                                { action: "SCHEDULE" },
                                "Appointment confirmed as SCHEDULED."
                              )
                            }
                            className="rounded bg-teal-700 px-2.5 py-1 font-semibold text-white hover:bg-teal-600"
                          >
                            Mark Scheduled
                          </button>
                        )}
                        {appt.status === "SCHEDULED" && (
                          <button
                            onClick={() =>
                              apiAction(
                                `confirm-${appt.id}`,
                                `/api/appointments/${appt.id}`,
                                "PATCH",
                                { action: "CONFIRM" },
                                "Appointment confirmed."
                              )
                            }
                            className="rounded bg-sky-700 px-2.5 py-1 font-semibold text-white hover:bg-sky-600"
                          >
                            Mark Confirmed
                          </button>
                        )}
                        {(appt.status === "SCHEDULED" ||
                          appt.status === "CONFIRMED" ||
                          appt.status === "UNKNOWN") && (
                          <>
                            <button
                              onClick={() =>
                                apiAction(
                                  `complete-${appt.id}`,
                                  `/api/appointments/${appt.id}`,
                                  "PATCH",
                                  { action: "COMPLETE" },
                                  "Appointment marked completed."
                                )
                              }
                              className="rounded bg-emerald-700 px-2.5 py-1 font-semibold text-white hover:bg-emerald-600"
                            >
                              Mark Completed
                            </button>
                            <button
                              disabled={busy !== null}
                              onClick={() =>
                                setConfirmState({
                                  kind: "APPT_NO_SHOW",
                                  id: appt.id,
                                  label: appt.provider.name,
                                })
                              }
                              className="rounded border border-rose-300 px-2.5 py-1 font-semibold text-rose-700 hover:bg-rose-50"
                            >
                              Mark No-Show
                            </button>
                            <button
                              onClick={() =>
                                apiAction(
                                  `unknown-appt-${appt.id}`,
                                  `/api/appointments/${appt.id}`,
                                  "PATCH",
                                  { action: "MARK_UNKNOWN" },
                                  "Appointment status marked UNKNOWN pending verification."
                                )
                              }
                              className="rounded border border-amber-300 px-2.5 py-1 font-semibold text-amber-800 hover:bg-amber-50"
                            >
                              Mark Unknown
                            </button>
                          </>
                        )}
                        {appt.status !== "COMPLETED" &&
                          appt.status !== "CANCELLED" &&
                          appt.status !== "RESCHEDULED" && (
                            <button
                              disabled={busy !== null}
                              onClick={() =>
                                setConfirmState({
                                  kind: "APPT_CANCEL",
                                  id: appt.id,
                                  label: appt.provider.name,
                                })
                              }
                              className="rounded border border-slate-300 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                          )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">No appointments scheduled yet.</p>
            )}

            {canVerify && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3.5">
                <div className="mb-2 text-xs font-semibold text-emerald-900">
                  Verify First Completed Behavioral-Health Visit
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    value={verifySignal}
                    onChange={(e) => setVerifySignal(e.target.value as VerificationSignalType)}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="APPOINTMENT_COMPLETED">APPOINTMENT_COMPLETED</option>
                    <option value="CLAIM_RECEIVED">CLAIM_RECEIVED</option>
                    <option value="PROVIDER_CONFIRMATION">PROVIDER_CONFIRMATION</option>
                    <option value="MEMBER_CONFIRMATION">MEMBER_CONFIRMATION</option>
                    <option value="SUBSEQUENT_TREATMENT_ENGAGEMENT">
                      SUBSEQUENT_TREATMENT_ENGAGEMENT
                    </option>
                  </select>
                  <input
                    type="text"
                    value={verifySource}
                    onChange={(e) => setVerifySource(e.target.value)}
                    placeholder="Source system (e.g., X12_837_CLAIMS)"
                    className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                </div>
                <input
                  type="text"
                  value={verifyNote}
                  onChange={(e) => setVerifyNote(e.target.value)}
                  className="mt-2 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={closeAfterVerify}
                      onChange={(e) => setCloseAfterVerify(e.target.checked)}
                    />
                    Close case automatically once visit completion is verified
                  </label>
                  <button
                    disabled={busy !== null}
                    onClick={() =>
                      apiAction(
                        "verify-completion",
                        `/api/cases/${careCase.id}/verifications`,
                        "POST",
                        {
                          appointmentId: careCase.appointments[0]?.id,
                          signalType: verifySignal,
                          sourceSystem: verifySource,
                          evidenceNote: verifyNote,
                          closeCaseAfterVerify: closeAfterVerify,
                        },
                        "Visit completion verified and Executive Dashboard metrics updated!"
                      )
                    }
                    className="rounded-md bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    Record Completion Verification
                  </button>
                </div>
              </div>
            )}

            {careCase.verifications.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-xs font-semibold text-slate-700">
                  Verification Evidence Ledger ({careCase.verifications.length})
                </div>
                {careCase.verifications.map((v: any) => (
                  <div
                    key={v.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{v.signalType}</span>
                        <span className="rounded bg-white border border-slate-300 px-1.5 py-0.5 text-[10px] font-bold text-slate-800">
                          {v.verificationStatus ?? "VERIFIED"}
                        </span>
                        <span className="text-[11px] text-slate-600">
                          Confidence: {Math.round((v.confidence ?? 0) * 100)}%
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {new Date(v.verifiedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-slate-700">{v.evidenceNote}</div>
                    <div className="text-[11px] text-slate-500">
                      Source: <strong>{v.sourceSystem}</strong>
                      {v.verifiedBy && (
                        <span>
                          {" "}
                          • Verifier: <strong>{v.verifiedBy.name}</strong> ({v.verifiedBy.role})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 6. Member Outreach (Consent-Aware) */}
          <div id="communications" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-teal-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Supportive Member Outreach (Not Care Completion)
              </h2>
            </div>

            {canSendOutreach && (
              <div className="mt-3 space-y-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <select
                    value={outreachChannel}
                    onChange={(e) => setOutreachChannel(e.target.value as any)}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="SMS">SMS (Consent: {careCase.member.consentSms ? "Yes" : "No"})</option>
                    <option value="EMAIL">EMAIL</option>
                    <option value="PORTAL">IN-APP (PORTAL)</option>
                    <option value="PHONE">PHONE</option>
                  </select>
                  <select
                    value={outreachPurpose}
                    onChange={(e) => setOutreachPurpose(e.target.value)}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="REFERRAL_NOTIFICATION">Referral Notification</option>
                    <option value="PROVIDER_OPTIONS">Provider Options</option>
                    <option value="SCHEDULING_REMINDER">Scheduling Reminder</option>
                    <option value="APPOINTMENT_CONFIRMATION">Appointment Confirmation</option>
                    <option value="APPOINTMENT_REMINDER">Appointment Reminder</option>
                    <option value="MISSED_APPOINTMENT">Missed Appointment</option>
                    <option value="RE_ENGAGEMENT">Re-engagement</option>
                    <option value="HUMAN_OUTREACH">Human Outreach</option>
                    <option value="COMPLETION_CONFIRMATION">Completion Confirmation</option>
                  </select>
                  <select
                    value={readingLevel}
                    onChange={(e) => setReadingLevel(e.target.value as "SIMPLE" | "PLAIN" | "STANDARD")}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="SIMPLE">Reading Level: Simple (~Grade 5)</option>
                    <option value="PLAIN">Reading Level: Plain (~Grade 6-7)</option>
                    <option value="STANDARD">Reading Level: Standard</option>
                  </select>
                  <select
                    value={outreachInterventionId}
                    onChange={(e) => setOutreachInterventionId(e.target.value)}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="">No specific intervention</option>
                    {careCase.interventions.map((inv: any) => (
                      <option key={inv.id} value={inv.id}>
                        Intervention: {inv.type.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    disabled={busy !== null}
                    onClick={async () => {
                      const res = await apiAction(
                        "draft-outreach",
                        `/api/cases/${careCase.id}/outreach`,
                        "POST",
                        {
                          channel: outreachChannel,
                          purpose: outreachPurpose,
                          readingLevel,
                          interventionId: outreachInterventionId || undefined,
                          sendImmediately: false,
                        },
                        "Supportive draft generated with language & reading-level adaptation."
                      );
                      if (res?.draftMessage) setDraftedMessage(res.draftMessage);
                    }}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                  >
                    Generate Draft ({careCase.member.preferredLanguage} • {readingLevel})
                  </button>
                </div>

                {draftedMessage && (
                  <textarea
                    rows={3}
                    value={draftedMessage}
                    onChange={(e) => setDraftedMessage(e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white p-2.5 text-xs"
                  />
                )}

                <button
                  disabled={busy !== null}
                  onClick={() =>
                    apiAction(
                      "send-outreach",
                      `/api/cases/${careCase.id}/outreach`,
                      "POST",
                      {
                        channel: outreachChannel,
                        purpose: outreachPurpose,
                        readingLevel,
                        interventionId: outreachInterventionId || undefined,
                        customMessage: draftedMessage || undefined,
                        sendImmediately: true,
                      },
                      "Communication validated and recorded cleanly."
                    )
                  }
                  className="rounded-md bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  Approve & Dispatch Communication
                </button>
              </div>
            )}

            <div className="mt-3 space-y-2">
              {careCase.communications.map((o: any) => (
                <div
                  key={o.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs space-y-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-900">{o.channel}</span>
                      <span className="rounded bg-white border border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-800">
                        {o.messageType ?? "HUMAN_OUTREACH"}
                      </span>
                      <span className="rounded bg-teal-50 border border-teal-200 px-1.5 py-0.5 text-[10px] font-semibold text-teal-900">
                        {o.deliveryStatus} ({o.deliveryMode ?? "MOCK"})
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          o.internalAiLabel === "AI_GENERATED" || o.draftedByAi
                            ? "bg-violet-100 text-violet-900"
                            : "bg-slate-200 text-slate-800"
                        }`}
                      >
                        {o.internalAiLabel ?? (o.draftedByAi ? "AI_GENERATED" : "HUMAN_AUTHORED")}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {new Date(o.sentAt ?? o.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-slate-800">{o.content || o.messageSummary}</div>
                  <div className="text-[11px] text-slate-500">
                    Recipient: <strong>{o.recipient ?? careCase.member.firstName}</strong> • Template:{" "}
                    <span className="font-mono">{o.templateKey ?? "custom"}</span> • Language:{" "}
                    {o.language} ({o.readingLevel ?? "PLAIN"})
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Member Context, Escalation & Workflow Timeline */}
        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900">Member & Referral Context</h2>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-slate-500">Member</dt>
                <dd className="font-semibold text-slate-900">
                  {careCase.member.firstName} {careCase.member.lastName} ({careCase.member.externalMemberId})
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Preferred Language</dt>
                <dd className="font-medium text-slate-900">{careCase.member.preferredLanguage}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Geography / Urbanicity</dt>
                <dd className="text-slate-800">
                  {careCase.member.geography} ({careCase.member.urbanicity})
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Coverage / Network</dt>
                <dd className="text-slate-800">
                  {careCase.member.coverageType} • {careCase.referral.networkRequired}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Eligibility</dt>
                <dd className="font-medium text-slate-900">{careCase.referral.eligibilityVerified}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Transportation Access</dt>
                <dd className="text-slate-800">{careCase.member.transportationAccess}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Digital Access</dt>
                <dd className="text-slate-800">{careCase.member.digitalAccessLevel}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Prior No-Shows</dt>
                <dd className="text-slate-800">{careCase.member.priorNoShowCount}</dd>
              </div>
              <div className="border-t border-slate-100 pt-2">
                <dt className="text-slate-500">Referral Need</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {careCase.referral.behavioralHealthNeed}
                </dd>
              </div>
              {careCase.referral.operationalNotes && (
                <div>
                  <dt className="text-slate-500">Operational Notes</dt>
                  <dd className="mt-0.5 text-slate-700">{careCase.referral.operationalNotes}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Workflow Transition & Human Escalation */}
          {(canEditCase || canEscalate) && (
            <div id="escalation" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="text-sm font-semibold text-slate-900">
                Explicit State Transition & Escalation
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Only policy-valid state transitions from <strong>{careCase.status}</strong> are permitted.
                Every transition emits an immutable WorkflowEvent.
              </p>

              {allowedNextStatuses.length > 0 && canEditCase ? (
                <div className="mt-3 space-y-2.5">
                  <select
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                  >
                    {allowedNextStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={transitionReason}
                    onChange={(e) => setTransitionReason(e.target.value)}
                    placeholder="Reason for transition (minimum 3 characters)"
                    aria-invalid={transitionReason.trim().length > 0 && transitionReason.trim().length < 3}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                  {transitionReason.trim().length > 0 && transitionReason.trim().length < 3 && (
                    <p role="alert" className="text-[11px] font-medium text-rose-700">
                      Enter at least 3 characters for the workflow audit event.
                    </p>
                  )}
                  {targetStatus === "ESCALATED" && (
                    <input
                      type="text"
                      value={escalationDetail}
                      onChange={(e) => setEscalationDetail(e.target.value)}
                      placeholder="Escalation trigger detail (optional)"
                      className="w-full rounded border border-rose-200 bg-rose-50/40 px-2.5 py-1.5 text-xs"
                    />
                  )}
                  <button
                    disabled={busy !== null || transitionReason.trim().length < 3}
                    onClick={async () => {
                      const res = await apiAction(
                        "transition",
                        `/api/cases/${careCase.id}/transition`,
                        "POST",
                        {
                          toStatus: targetStatus,
                          reason: transitionReason,
                          escalationReason:
                            targetStatus === "ESCALATED"
                              ? escalationDetail || transitionReason
                              : undefined,
                          closureReason:
                            targetStatus === "CLOSED" ? transitionReason : undefined,
                        },
                        `Case transitioned to ${targetStatus}.`
                      );
                      if (res) {
                        setTransitionReason("");
                        setEscalationDetail("");
                      }
                    }}
                    className="w-full rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    Apply State Transition
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Case is in terminal or restricted state ({careCase.status}).
                </p>
              )}

              {canEscalate && allowedNextStatuses.includes("ESCALATED") && (
                <button
                  disabled={busy !== null}
                  onClick={() => setConfirmState({ kind: "ESCALATE_CASE" })}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                >
                  <AlertOctagon className="h-3.5 w-3.5" />
                  Escalate to Human Care Manager
                </button>
              )}
              {canEditCase && allowedNextStatuses.includes("CLOSED") && (
                <button
                  disabled={busy !== null}
                  onClick={() =>
                    apiAction(
                      "close-case",
                      `/api/cases/${careCase.id}/transition`,
                      "POST",
                      {
                        toStatus: "CLOSED",
                        reason: transitionReason || "Closed by Care Manager after review",
                        closureReason: transitionReason || "Closed by Care Manager after review",
                      },
                      "Case closed and logged to audit trail."
                    )
                  }
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  Close Case
                </button>
              )}
            </div>
          )}

          {/* Care Manager Case Notes */}
          <div id="notes" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-teal-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Care Manager Notes ({careCase.caseNotes?.length ?? 0})
              </h2>
            </div>

            {canEditCase && (
              <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <select
                  value={noteCategory}
                  onChange={(e) => setNoteCategory(e.target.value as any)}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5"
                >
                  <option value="COORDINATION">COORDINATION</option>
                  <option value="BARRIER_DISCOVERY">BARRIER_DISCOVERY</option>
                  <option value="OUTREACH">OUTREACH</option>
                  <option value="ESCALATION">ESCALATION</option>
                  <option value="CLOSURE">CLOSURE</option>
                </select>
                <textarea
                  rows={2}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Document coordination call, member blocker, or follow-up note..."
                  className="w-full rounded border border-slate-300 bg-white p-2"
                />
                <button
                  disabled={busy !== null || noteContent.trim().length < 3}
                  onClick={async () => {
                    const res = await apiAction(
                      "add-note",
                      `/api/cases/${careCase.id}/notes`,
                      "POST",
                      { category: noteCategory, content: noteContent.trim() },
                      "Case note saved and audited."
                    );
                    if (res) setNoteContent("");
                  }}
                  className="w-full rounded-md bg-teal-700 px-3 py-1.5 font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
                >
                  Add Case Note
                </button>
              </div>
            )}

            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
              {(careCase.caseNotes ?? []).map((note: any) => (
                <div key={note.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold text-teal-800">{note.category}</span>
                    <span>{new Date(note.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-slate-800">{note.content}</p>
                  <div className="mt-1 text-[10px] text-slate-400">
                    {note.author?.name ?? "Care Team"} ({note.author?.role ?? "SYSTEM"})
                  </div>
                </div>
              ))}
              {(!careCase.caseNotes || careCase.caseNotes.length === 0) && (
                <p className="text-xs text-slate-500">No case notes added yet.</p>
              )}
            </div>
          </div>

          {/* Workflow Timeline */}
          <div id="timeline" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-teal-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Case Workflow Timeline ({careCase.workflowEvents.length})
              </h2>
            </div>
            <div className="mt-3 space-y-2.5 max-h-80 overflow-y-auto">
              {careCase.workflowEvents.map((ev: any) => (
                <div key={ev.id} className="border-l-2 border-teal-600 pl-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800">
                      {ev.fromStatus ? `${ev.fromStatus} → ` : ""}
                      {ev.toStatus}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                      {ev.eventType}
                    </span>
                  </div>
                  <div className="text-slate-600">{ev.reason}</div>
                  <div className="text-[11px] text-slate-400">
                    {ev.actorRole ?? "SYSTEM"} • {new Date(ev.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Approvals */}
          <div id="pending-approvals" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900">
              Pending Approvals ({(careCase.approvalRequests ?? []).filter((a: any) => a.status === "PENDING").length})
            </h2>
            <div className="mt-3 space-y-2">
              {(careCase.approvalRequests ?? [])
                .filter((a: any) => a.status === "PENDING")
                .map((req: any) => (
                  <div key={req.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs space-y-2">
                    <div className="font-semibold text-amber-900">{req.actionType ?? req.title}</div>
                    <div className="text-amber-800">{req.reason}</div>
                    {canApproveIntervention && (
                      <div className="flex gap-2">
                        <button
                          disabled={busy !== null}
                          onClick={async () => {
                            await apiAction(
                              `approve-req-${req.id}`,
                              `/api/approvals/${req.id}/decide`,
                              "POST",
                              { decision: "APPROVE", decisionNote: "Approved in Care Manager Workbench" },
                              "Approval granted."
                            );
                            await apiAction(
                              `resume-req-${req.id}`,
                              `/api/approvals/${req.id}/resume`,
                              "POST",
                              {},
                              "Agent execution resumed after approval."
                            );
                          }}
                          className="rounded bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600"
                        >
                          Approve & Resume
                        </button>
                        <button
                          disabled={busy !== null}
                          onClick={() =>
                            apiAction(
                              `reject-req-${req.id}`,
                              `/api/approvals/${req.id}/decide`,
                              "POST",
                              { decision: "REJECT", decisionNote: "Rejected in Care Manager Workbench" },
                              "Approval request rejected."
                            )
                          }
                          className="rounded border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              {(careCase.approvalRequests ?? []).filter((a: any) => a.status === "PENDING").length === 0 && (
                <p className="text-xs text-slate-500">No pending approvals.</p>
              )}
            </div>
          </div>

          {/* Agent Recommendation & Next Best Action (with Human Override) */}
          <div id="next-best-action" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Agent Recommendation & Next Best Action
            </h2>
            {careCase.aiDecisionTraces?.[0] ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
                <div className="font-semibold text-slate-900">
                  Next Best Action: {careCase.aiDecisionTraces[0].selectedTool ?? careCase.aiDecisionTraces[0].decisionType}
                </div>
                <div className="text-slate-600">{careCase.aiDecisionTraces[0].rationale}</div>
                <div className="text-[11px] text-slate-500">
                  Confidence: {Math.round((careCase.aiDecisionTraces[0].confidence ?? 0) * 100)}%
                </div>
              </div>
            ) : careCase.aiRecommendations?.[0] ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
                <div className="font-semibold text-slate-900">
                  {careCase.aiRecommendations[0].operation} ({careCase.aiRecommendations[0].status})
                </div>
                <div className="text-slate-600">
                  {careCase.aiRecommendations[0].resultingAction ?? "Review recommended next action"}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">No agent recommendation recorded yet.</p>
            )}
            {canEditCase && (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="font-semibold text-slate-800">Human Override</div>
                <input
                  type="text"
                  value={overrideAction}
                  onChange={(e) => setOverrideAction(e.target.value)}
                  placeholder="Override action (e.g., Manual coordinator phone outreach)"
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={overrideRationale}
                  onChange={(e) => setOverrideRationale(e.target.value)}
                  placeholder="Override rationale (required for audit)"
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <button
                  disabled={busy !== null || overrideAction.trim().length < 2 || overrideRationale.trim().length < 3}
                  onClick={async () => {
                    await apiAction(
                      "override-rec",
                      `/api/cases/${careCase.id}/override`,
                      "POST",
                      {
                        recommendationId: careCase.aiRecommendations?.[0]?.id,
                        overrideAction: overrideAction.trim(),
                        rationale: overrideRationale.trim(),
                      },
                      "Human override recorded and audited."
                    );
                    setOverrideAction("");
                    setOverrideRationale("");
                  }}
                  className="rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  Record Override
                </button>
              </div>
            )}
          </div>

          {/* Evidence & Add Evidence */}
          <div id="evidence-panel" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Evidence ({careCase.evidences?.length ?? 0})
            </h2>
            {canEditCase && (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <select
                  value={evidenceSourceType}
                  onChange={(e) => setEvidenceSourceType(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="CARE_MANAGER_ATTESTATION">Care Manager Attestation</option>
                  <option value="PROVIDER_RECORD">Provider Record</option>
                  <option value="MEMBER_REPORTED">Member Reported</option>
                  <option value="CLAIM_DOCUMENT">Claim Document</option>
                </select>
                <input
                  type="text"
                  value={evidenceSummary}
                  onChange={(e) => setEvidenceSummary(e.target.value)}
                  placeholder="Evidence summary..."
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <button
                  disabled={busy !== null || evidenceSummary.trim().length < 3}
                  onClick={async () => {
                    await apiAction(
                      "add-evidence",
                      `/api/cases/${careCase.id}/evidence`,
                      "POST",
                      {
                        sourceType: evidenceSourceType,
                        summary: evidenceSummary.trim(),
                      },
                      "Evidence added and audited."
                    );
                    setEvidenceSummary("");
                  }}
                  className="rounded bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
                >
                  Add Evidence
                </button>
              </div>
            )}
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {(careCase.evidences ?? []).map((ev: any) => (
                <div key={ev.id} className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                  <div className="font-semibold text-slate-900">{ev.sourceType}</div>
                  <div className="text-slate-700">{ev.summary}</div>
                  <div className="text-[10px] text-slate-400">
                    {ev.capturedBy} • {new Date(ev.capturedAt).toLocaleString()}
                  </div>
                </div>
              ))}
              {(!careCase.evidences || careCase.evidences.length === 0) && (
                <p className="text-xs text-slate-500">No structured evidence items recorded yet.</p>
              )}
            </div>
          </div>

          {/* Execution History */}
          <div id="execution-history" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Execution History ({careCase.agentRuns?.length ?? 0} Runs • {careCase.executionJournalEvents?.length ?? 0} Events)
            </h2>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {(careCase.agentRuns ?? []).map((run: any) => (
                <div key={run.id} className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{run.agent}</span>
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-800">
                      {run.status}
                    </span>
                  </div>
                  <div className="text-slate-600">Step: {run.currentStep}</div>
                  <div className="text-[10px] text-slate-400">
                    Started {new Date(run.startedAt).toLocaleString()}
                  </div>
                </div>
              ))}
              {(!careCase.agentRuns || careCase.agentRuns.length === 0) && (
                <p className="text-xs text-slate-500">No agent execution runs recorded yet.</p>
              )}
            </div>
          </div>

          {/* Case Audit History */}
          <div id="audit-history" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Audit History ({careCase.auditEvents?.length ?? 0})
              </h2>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Immutable tenant-isolated audit log across case transitions, barriers, interventions,
              outreach, appointments, notes, and verifications.
            </p>
            <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
              {(careCase.auditEvents ?? []).map((ae: any) => (
                <div key={ae.id} className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-slate-900">
                      {ae.action}
                    </span>
                    <span className="text-[10px] text-slate-500">{ae.entityType}</span>
                  </div>
                  <div className="mt-0.5 text-slate-700">{ae.summary}</div>
                  <div className="mt-0.5 text-[10px] text-slate-400">
                    {ae.actorEmail ?? "SYSTEM"} ({ae.actorRole ?? "SYSTEM"}) •{" "}
                    {new Date(ae.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
              {(!careCase.auditEvents || careCase.auditEvents.length === 0) && (
                <p className="text-xs text-slate-500">No audit entries logged yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmState !== null}
        title={
          confirmState?.kind === "REJECT_INTERVENTION"
            ? `Reject Intervention (${confirmState.label})?`
            : confirmState?.kind === "APPT_NO_SHOW"
              ? `Mark Appointment NO_SHOW (${confirmState.label})?`
              : confirmState?.kind === "APPT_CANCEL"
                ? `Cancel Appointment (${confirmState.label})?`
                : "Escalate Case to Human Care Manager?"
        }
        description={
          confirmState?.kind === "REJECT_INTERVENTION"
            ? "Rejecting sets this AI-assisted intervention to REJECTED and records your rationale in the case audit log."
            : confirmState?.kind === "APPT_NO_SHOW"
              ? "Marking NO_SHOW flags the case for human review and triggers re-engagement workflow tracking."
              : confirmState?.kind === "APPT_CANCEL"
                ? "Cancelling voids this scheduled slot. Specify the cancellation reason for the care team log."
                : "Escalating moves this case into ESCALATED exception handling and dispatches a supervisor alert."
        }
        confirmLabel={
          confirmState?.kind === "REJECT_INTERVENTION"
            ? "Confirm Reject"
            : confirmState?.kind === "APPT_NO_SHOW"
              ? "Confirm No-Show"
              : confirmState?.kind === "APPT_CANCEL"
                ? "Confirm Cancellation"
                : "Escalate Case"
        }
        tone={confirmState?.kind === "APPT_NO_SHOW" ? "warning" : "danger"}
        requireNote={
          confirmState?.kind === "REJECT_INTERVENTION" ||
          confirmState?.kind === "APPT_CANCEL" ||
          confirmState?.kind === "ESCALATE_CASE"
        }
        initialNote={
          confirmState?.kind === "ESCALATE_CASE"
            ? escalationDetail.trim() ||
              "Complex barrier / member risk requires senior Care Manager review."
            : ""
        }
        busy={busy !== null}
        onCancel={() => setConfirmState(null)}
        onConfirm={async (note) => {
          const target = confirmState;
          if (!target) return;
          if (target.kind === "REJECT_INTERVENTION") {
            await apiAction(
              `reject-${target.id}`,
              `/api/interventions/${target.id}/review`,
              "POST",
              { decision: "REJECT", notes: note },
              "Intervention rejected and logged."
            );
          } else if (target.kind === "APPT_NO_SHOW") {
            await apiAction(
              `noshow-${target.id}`,
              `/api/appointments/${target.id}`,
              "PATCH",
              { action: "NO_SHOW", note: note || undefined },
              "Appointment marked NO_SHOW and flagged for re-engagement."
            );
          } else if (target.kind === "APPT_CANCEL") {
            await apiAction(
              `cancel-${target.id}`,
              `/api/appointments/${target.id}`,
              "PATCH",
              { action: "CANCEL", note },
              "Appointment cancelled."
            );
          } else if (target.kind === "ESCALATE_CASE") {
            await apiAction(
              "escalate",
              `/api/cases/${careCase.id}/transition`,
              "POST",
              {
                toStatus: "ESCALATED",
                reason: note,
                escalationReason: note,
              },
              "Case escalated to Human Care Manager review."
            );
            setEscalationDetail("");
          }
          setConfirmState(null);
        }}
      />
    </div>
  );
}
