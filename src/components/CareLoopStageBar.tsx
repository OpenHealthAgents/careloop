"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

export type CareLoopStageKey =
  | "IDENTIFY"
  | "UNDERSTAND"
  | "DECIDE"
  | "EXECUTE"
  | "VERIFY"
  | "LEARN";

interface StageConfig {
  key: CareLoopStageKey;
  label: string;
  caption: string;
  href: string;
}

function getStagesForContext(opts: {
  caseId?: string;
}): StageConfig[] {
  const caseBase = opts.caseId ? `/cases/${opts.caseId}` : "/worklist";
  return [
    {
      key: "IDENTIFY",
      label: "1. IDENTIFY",
      caption: "At-risk referral",
      href: "/worklist?riskTier=HIGH",
    },
    {
      key: "UNDERSTAND",
      label: "2. UNDERSTAND",
      caption: "Barrier & evidence",
      href: opts.caseId ? `${caseBase}#barriers` : "/worklist",
    },
    {
      key: "DECIDE",
      label: "3. DECIDE",
      caption: "Human approval",
      href: opts.caseId ? `${caseBase}#interventions` : "/interventions",
    },
    {
      key: "EXECUTE",
      label: "4. EXECUTE",
      caption: "Match & schedule",
      href: opts.caseId ? `${caseBase}#appointments` : "/appointments",
    },
    {
      key: "VERIFY",
      label: "5. VERIFY",
      caption: "Visit & audit trail",
      href: opts.caseId ? `${caseBase}#outcome` : "/appointments",
    },
    {
      key: "LEARN",
      label: "6. LEARN",
      caption: "Outcomes & equity",
      href: "/health-equity",
    },
  ];
}

function resolveStageStatesForCase(careCase: any): Record<CareLoopStageKey, "done" | "current" | "pending"> {
  const hasBarrier = (careCase.barriers?.length ?? 0) > 0;
  const barrierConfirmed = Boolean(careCase.barriers?.some((b: any) => b.confirmedByHuman));
  const pendingInv = Boolean(careCase.interventions?.some((i: any) => i.status === "RECOMMENDED"));
  const approvedInv = Boolean(
    careCase.interventions?.some(
      (i: any) => i.status === "APPROVED" || i.status === "MODIFIED" || i.status === "IN_PROGRESS" || i.status === "COMPLETED"
    )
  );
  const hasAppt = (careCase.appointments?.length ?? 0) > 0;
  const hasCompletedAppt = Boolean(careCase.appointments?.some((a: any) => a.status === "COMPLETED"));
  const hasVerifiedVisit = Boolean(careCase.firstCompletedVisitAt);
  const isClosedOrVerified = careCase.status === "VERIFIED" || careCase.status === "CLOSED";

  const states: Record<CareLoopStageKey, "done" | "current" | "pending"> = {
    IDENTIFY: "done",
    UNDERSTAND: "pending",
    DECIDE: "pending",
    EXECUTE: "pending",
    VERIFY: "pending",
    LEARN: isClosedOrVerified ? "current" : "pending",
  };

  if (!hasBarrier) {
    states.UNDERSTAND = "current";
  } else if (!barrierConfirmed && pendingInv) {
    states.UNDERSTAND = "done";
    states.DECIDE = "current";
  } else if (pendingInv && !approvedInv) {
    states.UNDERSTAND = "done";
    states.DECIDE = "current";
  } else if (!hasAppt || (!hasCompletedAppt && !hasVerifiedVisit)) {
    states.UNDERSTAND = "done";
    states.DECIDE = approvedInv ? "done" : "current";
    states.EXECUTE = approvedInv ? "current" : "pending";
  } else if (!hasVerifiedVisit) {
    states.UNDERSTAND = "done";
    states.DECIDE = "done";
    states.EXECUTE = "done";
    states.VERIFY = "current";
  } else {
    states.UNDERSTAND = "done";
    states.DECIDE = "done";
    states.EXECUTE = "done";
    states.VERIFY = "done";
    states.LEARN = "current";
  }

  return states;
}

export function CareLoopStageBar({
  activeStage,
  careCase,
}: {
  activeStage?: CareLoopStageKey;
  careCase?: any;
}) {
  const stages = getStagesForContext({ caseId: careCase?.id });
  const caseStates = careCase ? resolveStageStatesForCase(careCase) : null;

  return (
    <nav
      aria-label="CareLoop Execution Loop"
      className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs"
    >
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {stages.map((stage, idx) => {
          const state: "done" | "current" | "pending" = caseStates
            ? caseStates[stage.key]
            : activeStage === stage.key
              ? "current"
              : stages.findIndex((s) => s.key === activeStage) > idx
                ? "done"
                : "pending";

          const cardClass =
            state === "current"
              ? "border-teal-600 bg-teal-700 text-white shadow-xs"
              : state === "done"
                ? "border-emerald-200 bg-emerald-50/80 text-emerald-950 hover:border-emerald-300"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white";

          return (
            <Link
              key={stage.key}
              href={stage.href}
              className={`group flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition ${cardClass}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide">
                  {state === "done" && <Check className="h-3 w-3 shrink-0 text-emerald-700" />}
                  <span className="truncate">{stage.label}</span>
                </div>
                <div
                  className={`truncate text-[11px] ${
                    state === "current"
                      ? "text-teal-100"
                      : state === "done"
                        ? "text-emerald-800"
                        : "text-slate-500"
                  }`}
                >
                  {stage.caption}
                </div>
              </div>
              {idx < stages.length - 1 && (
                <ArrowRight
                  className={`hidden h-3.5 w-3.5 shrink-0 lg:block ${
                    state === "current" ? "text-teal-200" : "text-slate-400"
                  }`}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
