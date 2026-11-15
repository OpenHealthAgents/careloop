"use client";

import React from "react";
import { CareLoopCaseOrchestrator } from "@/ai/orchestrator";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  History,
  UserCheck,
  UserRound,
} from "lucide-react";
import {
  AvailabilitySourceBadge,
  CaseStatusBadge,
  EpistemicBadge,
  RiskTierBadge,
} from "./StatusBadges";
import { WhatHappensNextCard } from "./ui/WhatHappensNextCard";

function buildCareManagerBriefData(careCase: any) {
  const latestRisk = careCase.riskAssessments?.[0] ?? null;
  const primaryBarrier = careCase.barriers?.[0] ?? null;
  const interventions: any[] = careCase.interventions ?? [];
  const appointments: any[] = careCase.appointments ?? [];
  const communications: any[] = careCase.communications ?? [];
  const verifications: any[] = careCase.verifications ?? [];

  const pendingInterventions = interventions.filter((i) => i.status === "RECOMMENDED");
  const activeInterventions = interventions.filter(
    (i) => i.status === "APPROVED" || i.status === "MODIFIED" || i.status === "IN_PROGRESS"
  );
  const completedInterventions = interventions.filter((i) => i.status === "COMPLETED");
  const failedInterventions = interventions.filter(
    (i) => i.status === "FAILED" || i.status === "REJECTED"
  );

  const rawSignals = Array.isArray(latestRisk?.evidenceSignals) ? latestRisk.evidenceSignals : [];
  const barrierSignals = Array.isArray(primaryBarrier?.evidenceSignals)
    ? primaryBarrier.evidenceSignals
    : [];

  const combinedEvidence: string[] = [];
  for (const sig of [...rawSignals, ...barrierSignals]) {
    const label = typeof sig === "string" ? sig : sig?.signal ? `${sig.signal} (+${sig.points})` : null;
    if (label && !combinedEvidence.includes(label)) combinedEvidence.push(label);
  }

  const latestAppt = appointments[0] ?? null;
  const noShowAppts = appointments.filter((a) => a.status === "NO_SHOW");
  const completedAppts = appointments.filter((a) => a.status === "COMPLETED");

  // Determine Question 7 (What does the human need to do?) & Question 10 (What happens next?)
  let humanTaskTitle = "Continue standard coordination";
  let humanTaskDetail = "Monitor scheduled milestones and await member check-in.";
  let humanTaskHref = "#outcome";
  let humanTaskTone: "urgent" | "action" | "clear" = "clear";

  if (careCase.status === "ESCALATED") {
    humanTaskTitle = "Resolve Escalated Case";
    humanTaskDetail =
      careCase.escalationReason ??
      "Senior Care Manager review required to unblock referral or confirm unresolved closure.";
    humanTaskHref = "#escalation";
    humanTaskTone = "urgent";
  } else if (pendingInterventions.length > 0) {
    humanTaskTitle = `Review ${pendingInterventions.length} Pending Intervention${
      pendingInterventions.length > 1 ? "s" : ""
    }`;
    humanTaskDetail = `Approve, modify, or reject '${pendingInterventions[0].type.replaceAll(
      "_",
      " "
    )}' (${pendingInterventions[0].executionMode.replaceAll("_", " ")}).`;
    humanTaskHref = "#interventions";
    humanTaskTone = "action";
  } else if (primaryBarrier && primaryBarrier.epistemicStatus !== "FACT") {
    humanTaskTitle = "Confirm or Override Inferred Barrier";
    humanTaskDetail = `Verify '${primaryBarrier.subBarrier}' directly with the member before locking outreach strategy.`;
    humanTaskHref = "#barriers";
    humanTaskTone = "action";
  } else if (noShowAppts.length > 0 && completedAppts.length === 0 && careCase.status !== "CLOSED") {
    humanTaskTitle = "Re-engage Member After No-Show";
    humanTaskDetail = "Contact member with supportive tone and reschedule via verified slot or telehealth.";
    humanTaskHref = "#appointments";
    humanTaskTone = "urgent";
  } else if (completedAppts.length > 0 && !careCase.firstCompletedVisitAt) {
    humanTaskTitle = "Record Visit Completion Verification";
    humanTaskDetail = "Log provider/member/claim confirmation signal to formally verify care initiation.";
    humanTaskHref = "#outcome";
    humanTaskTone = "action";
  } else if (appointments.length === 0 && careCase.status !== "CLOSED" && careCase.status !== "LOST_TO_FOLLOW_UP") {
    humanTaskTitle = "Match & Schedule First Visit";
    humanTaskDetail = "Select an in-network provider with verified availability or verify clinic slot.";
    humanTaskHref = "#appointments";
    humanTaskTone = "action";
  } else if (careCase.status === "VERIFIED") {
    humanTaskTitle = "Close Verified Case";
    humanTaskDetail = "First behavioral-health visit verified; review summary notes and close case.";
    humanTaskHref = "#escalation";
    humanTaskTone = "clear";
  } else if (careCase.status === "CLOSED") {
    humanTaskTitle = "Case Completed & Closed";
    humanTaskDetail = "All care execution gates verified and closed cleanly.";
    humanTaskHref = "#audit-history";
    humanTaskTone = "clear";
  } else if (careCase.status === "LOST_TO_FOLLOW_UP" || careCase.status === "BLOCKED") {
    humanTaskTitle = "Unblock or Document Unreachable Closure";
    humanTaskDetail = "Verify updated contact details or document unsuccessful outreach outcome.";
    humanTaskHref = "#escalation";
    humanTaskTone = "urgent";
  }

  let whatHappensNext = "Awaiting next workflow transition.";
  if (careCase.status === "CLOSED") {
    whatHappensNext = "No further coordination actions pending; episode recorded in outcomes.";
  } else if (careCase.status === "VERIFIED") {
    whatHappensNext = "Finalize closure note and transition status from VERIFIED to CLOSED.";
  } else if (careCase.firstCompletedVisitAt) {
    whatHappensNext = "Verify remaining claims/member signals if desired, then close case.";
  } else if (latestAppt && (latestAppt.status === "SCHEDULED" || latestAppt.status === "CONFIRMED")) {
    whatHappensNext = "Send reminder before visit, confirm attendance, and record completion signal after visit.";
  } else if (careCase.status === "ESCALATED") {
    whatHappensNext = "Care Manager resolves blocker, documents decision, and resumes workflow or closes unresolved.";
  } else {
    whatHappensNext = "Complete active intervention, lock in-network provider appointment, and confirm date.";
  }

  return {
    latestRisk,
    primaryBarrier,
    combinedEvidence,
    pendingInterventions,
    activeInterventions,
    completedInterventions,
    failedInterventions,
    communications,
    appointments,
    noShowAppts,
    completedAppts,
    latestAppt,
    verifications,
    humanTaskTitle,
    humanTaskDetail,
    humanTaskHref,
    humanTaskTone,
    whatHappensNext,
    orchestratorDecision: CareLoopCaseOrchestrator.decideFromCase(careCase),
  };
}

export function CaseBriefPanel({ careCase }: { careCase: any }) {
  const b = buildCareManagerBriefData(careCase);

  const humanBannerStyles =
    b.humanTaskTone === "urgent"
      ? "border-rose-300 bg-rose-50/70 text-rose-950"
      : b.humanTaskTone === "action"
        ? "border-amber-300 bg-amber-50/70 text-amber-950"
        : "border-emerald-200 bg-emerald-50/60 text-emerald-950";

  return (
    <section
      aria-label="Care Manager Ten-Point Coordination Brief"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"
    >
      {/* 0. Primary Operational Directive: What Happens Next? (Hero Position) */}
      <WhatHappensNextCard
        status={careCase.status}
        nextStepTitle={b.humanTaskTitle}
        nextStepDescription={`${b.whatHappensNext} ${b.humanTaskDetail}`}
        actionLabel={b.humanTaskTitle}
        actionHref={b.humanTaskHref}
        actionTone={b.humanTaskTone === "urgent" ? "urgent" : b.humanTaskTone === "action" ? "warning" : "primary"}
        assignedAgentOrActor={b.orchestratorDecision.tool ? "CaseOrchestratorAgent" : "CareManager"}
        executionMode={
          careCase.status === "REQUIRES_HUMAN_REVIEW" || b.orchestratorDecision.requires_human
            ? "HUMAN_APPROVAL_REQUIRED"
            : careCase.status === "VERIFIED" || careCase.status === "CLOSED"
              ? "COMPLETE"
              : "AUTONOMOUS"
        }
        policyRuleCited={b.orchestratorDecision.policy_check_required ? "POLICY_SAFEGUARD_GATE" : undefined}
        policyVerdict={b.orchestratorDecision.requires_human ? "REQUIRE_HUMAN_APPROVAL" : "ALLOW"}
        evidenceCited={b.combinedEvidence}
        slaDueAt={careCase.slaDueAt}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Care Coordination Brief — At-a-Glance Clinical Operations Summary
          </h2>
          <p className="text-xs text-slate-500">
            Structured 10-point view answering member identity, barriers, evidence, attempted actions,
            appointment state, and immediate human next steps.
          </p>
        </div>
        <span className="font-mono text-xs text-slate-500">
          SLA Due:{" "}
          <strong className="text-slate-700 tabular-nums">
            {careCase.slaDueAt ? new Date(careCase.slaDueAt).toLocaleDateString() : "Standard"}
          </strong>
        </span>
      </div>

      {/* Row 1: Q1 Member + Q2 Recommended Care + Q7 Human Action Spotlight */}
      <div className="grid gap-3.5 lg:grid-cols-12">
        {/* Q1: Who is this member? */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 lg:col-span-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <UserRound className="h-3.5 w-3.5 text-teal-700" />
            1. Who Is This Member
          </div>
          <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-slate-900">
              {careCase.member.firstName} {careCase.member.lastName}
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              {careCase.member.externalMemberId}
            </span>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <div>
              <dt className="text-[11px] text-slate-500">Language</dt>
              <dd className="font-medium text-slate-800">{careCase.member.preferredLanguage}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-500">Geography</dt>
              <dd className="font-medium text-slate-800">
                {careCase.member.geography} ({careCase.member.urbanicity})
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-500">Coverage / Network</dt>
              <dd className="font-medium text-slate-800">
                {careCase.member.coverageType} • {careCase.referral.networkRequired}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-500">Access & Prior No-Shows</dt>
              <dd className="font-medium text-slate-800 tabular-nums">
                Transit: {careCase.member.transportationAccess} • {careCase.member.priorNoShowCount} prior no-show(s)
              </dd>
            </div>
          </dl>
        </div>

        {/* Q2: What care was recommended? */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 lg:col-span-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <ClipboardCheck className="h-3.5 w-3.5 text-teal-700" />
            2. Recommended Behavioral Care
          </div>
          <div className="mt-1.5 text-sm font-semibold text-slate-900">
            {careCase.referral.behavioralHealthNeed}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <span className="rounded bg-white px-2 py-0.5 font-medium text-slate-800 border border-slate-200">
              {careCase.referral.specialty}
            </span>
            <span className="rounded bg-white px-2 py-0.5 font-medium text-slate-700 border border-slate-200">
              Urgency: {careCase.referral.urgency}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-600">
            <div>
              Eligibility: <strong className="text-slate-800">{careCase.referral.eligibilityVerified}</strong> • Referred:{" "}
              <span className="tabular-nums">
                {new Date(careCase.referral.referralDate).toLocaleDateString()}
              </span>
            </div>
            {careCase.referral.operationalNotes && (
              <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                {careCase.referral.operationalNotes}
              </p>
            )}
          </div>
        </div>

        {/* Q7: What does the human need to do? */}
        <div className={`rounded-lg border p-3.5 lg:col-span-4 flex flex-col justify-between ${humanBannerStyles}`}>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide">
              <UserCheck className="h-3.5 w-3.5" />
              7. What The Human Needs To Do
            </div>
            <div className="mt-1.5 text-sm font-bold">{b.humanTaskTitle}</div>
            <p className="mt-1 text-xs leading-relaxed opacity-90">{b.humanTaskDetail}</p>
          </div>
          <div className="mt-3">
            <a
              href={b.humanTaskHref}
              className="inline-flex items-center gap-1 rounded-md border border-current/25 bg-white/80 px-2.5 py-1 text-xs font-semibold hover:bg-white"
            >
              Jump to Action
              <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Row 2: Q3 Why might it fail + Q4 Evidence + Q5 What should we do + Q6 Attempted */}
      <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-4">
        {/* Q3 */}
        <div className="rounded-lg border border-slate-200 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              3. Why It Might Fail
            </span>
            <RiskTierBadge riskTier={careCase.riskLevel} score={careCase.priorityScore} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-900">
              {careCase.primaryBarrierCategory ?? "UNKNOWN"} / {careCase.primaryBarrierCode ?? "Barrier unknown"}
            </span>
            {b.primaryBarrier && <EpistemicBadge status={b.primaryBarrier.epistemicStatus} />}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            {b.latestRisk?.explanation ?? careCase.riskExplanation ?? "Operational barriers require review."}
          </p>
        </div>

        {/* Q4 */}
        <div className="rounded-lg border border-slate-200 p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            4. Supporting Evidence
          </div>
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            {b.combinedEvidence.length > 0 ? (
              b.combinedEvidence.slice(0, 4).map((sig, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  <span>{sig}</span>
                </li>
              ))
            ) : (
              <li className="text-slate-500">
                Insufficient intake signals — barrier flagged UNKNOWN pending outreach.
              </li>
            )}
          </ul>
        </div>

        {/* Q5 */}
        <div className="rounded-lg border border-slate-200 p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            5. What We Should Do
          </div>
          {careCase.interventions?.[0] ? (
            <div className="mt-2 space-y-1 text-xs">
              <div className="font-semibold text-slate-900">
                {careCase.interventions[0].type.replaceAll("_", " ")}
              </div>
              <p className="text-slate-600 leading-relaxed">
                {careCase.interventions[0].recommendedAction}
              </p>
              {careCase.matchedProvider && (
                <p className="text-[11px] font-medium text-teal-800">
                  Matched Provider: {careCase.matchedProvider.name}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-600">
              Select a language- and network-compatible provider and initiate outreach.
            </p>
          )}
        </div>

        {/* Q6 */}
        <div className="rounded-lg border border-slate-200 p-3.5">
          <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <History className="h-3.5 w-3.5 text-slate-500" />
            6. Already Attempted
          </div>
          <dl className="mt-2 space-y-1 text-xs text-slate-700 tabular-nums">
            <div className="flex justify-between">
              <dt className="text-slate-500">Outreach Messages</dt>
              <dd className="font-medium">
                {b.communications.length}
                {b.communications[0] ? ` (${b.communications[0].deliveryStatus})` : ""}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Interventions Run</dt>
              <dd className="font-medium">
                {b.completedInterventions.length} completed • {b.failedInterventions.length} failed/rejected
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Prior Appointments</dt>
              <dd className="font-medium">
                {b.appointments.length} total ({b.noShowAppts.length} no-show)
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Care Manager Notes</dt>
              <dd className="font-medium">{careCase.caseNotes?.length ?? 0}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Row 3: Q8 Appointment Scheduled? + Q9 Completed? + Q10 What Happens Next? */}
      <div className="grid gap-3.5 md:grid-cols-3">
        {/* Q8 */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <CalendarCheck2 className="h-3.5 w-3.5 text-teal-700" />
            8. Appointment Scheduled?
          </div>
          {b.latestAppt ? (
            <div className="mt-1.5 space-y-1 text-xs">
              <div className="font-semibold text-slate-900">
                {b.latestAppt.status} • {b.latestAppt.modality}
              </div>
              <div className="text-slate-700 tabular-nums">
                {new Date(b.latestAppt.scheduledStartAt).toLocaleString()} — {b.latestAppt.provider.name}
              </div>
              <div className="pt-0.5">
                <AvailabilitySourceBadge source={b.latestAppt.availabilitySourceAtBooking} />
              </div>
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-slate-600">
              No appointment scheduled yet. Use Provider Matching & Assisted Scheduling below.
            </p>
          )}
        </div>

        {/* Q9 */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
            9. Visit Completed & Verified?
          </div>
          {careCase.firstCompletedVisitAt ? (
            <div className="mt-1.5 space-y-1 text-xs">
              <div className="font-semibold text-emerald-800">
                Yes — Completed {new Date(careCase.firstCompletedVisitAt).toLocaleDateString()}
              </div>
              <div className="text-slate-600 tabular-nums">
                Backed by {b.verifications.length} verification signal(s).
              </div>
            </div>
          ) : b.completedAppts.length > 0 ? (
            <div className="mt-1.5 text-xs font-medium text-amber-800">
              Appointment marked COMPLETED — awaiting formal CompletionVerification signal.
            </div>
          ) : (
            <div className="mt-1.5 text-xs text-slate-600">
              Not yet completed (scheduled appointments do not count as completed care).
            </div>
          )}
        </div>

        {/* Q10 */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              10. What Happens Next
            </span>
            <CaseStatusBadge status={careCase.status} />
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-700">{b.whatHappensNext}</p>
          <div className="mt-2 rounded border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-700 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-1 font-semibold text-slate-900">
              <span>Tool: <code className="text-teal-700">{b.orchestratorDecision.tool}</code></span>
              <span className="tabular-nums text-slate-500">
                {Math.round(b.orchestratorDecision.confidence * 100)}% • Policy Gate{" "}
                {b.orchestratorDecision.policy_check_required ? "ON" : "OFF"} •{" "}
                {b.orchestratorDecision.requires_human ? "Human Required" : "Guarded Auto"}
              </span>
            </div>
            <div className="text-slate-600">
              <strong>Expected:</strong> {b.orchestratorDecision.expected_outcome}
            </div>
            <div className="text-slate-500">
              <strong>Fallback:</strong> {b.orchestratorDecision.fallback_action}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
