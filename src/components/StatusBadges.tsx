import React from "react";
import { CASE_STATUS_METADATA } from "@/domain/cases/state-machine";
import { CaseStatus } from "@prisma/client";

export function CaseStatusBadge({ status }: { status: CaseStatus | string }) {
  const meta = CASE_STATUS_METADATA[status as CaseStatus] ?? {
    label: status.replaceAll("_", " "),
    tone: "neutral",
  };
  const styles: Record<string, string> = {
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    info: "bg-sky-50 text-sky-800 border-sky-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-rose-50 text-rose-800 border-rose-200",
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[meta.tone]}`}
    >
      {meta.label}
    </span>
  );
}

export function RiskTierBadge({ riskTier, score }: { riskTier: string; score?: number }) {
  const styles: Record<string, string> = {
    HIGH: "bg-rose-50 text-rose-800 border-rose-200",
    MEDIUM: "bg-amber-50 text-amber-800 border-amber-200",
    LOW: "bg-emerald-50 text-emerald-800 border-emerald-200",
    UNKNOWN: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${
        styles[riskTier] ?? styles.UNKNOWN
      }`}
    >
      <span>{riskTier}</span>
      {score !== undefined && <span className="opacity-75">({score})</span>}
    </span>
  );
}

export function EpistemicBadge({
  status,
}: {
  status: "FACT" | "INFERENCE" | "RECOMMENDATION" | "UNKNOWN" | string;
}) {
  const styles: Record<string, string> = {
    FACT: "bg-emerald-50 text-emerald-900 border-emerald-300",
    INFERENCE: "bg-violet-50 text-violet-900 border-violet-300",
    RECOMMENDATION: "bg-amber-50 text-amber-900 border-amber-300",
    UNKNOWN: "bg-slate-100 text-slate-700 border-slate-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
        styles[status] ?? "bg-slate-100 text-slate-700 border-slate-300"
      }`}
    >
      {status}
    </span>
  );
}

export function AvailabilitySourceBadge({ source }: { source: string }) {
  if (source === "VERIFIED_AVAILABILITY" || source === "VERIFIED AVAILABILITY") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
        VERIFIED AVAILABILITY
      </span>
    );
  }
  if (source === "NOT_AVAILABLE" || source === "NOT AVAILABLE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
        NOT AVAILABLE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
      DIRECTORY DATA (UNVERIFIED)
    </span>
  );
}

export function ExecutionModeBadge({
  mode,
  isHighRisk,
}: {
  mode: "AUTOMATED" | "HUMAN_ASSISTED" | "HUMAN_ONLY" | string;
  isHighRisk?: boolean;
}) {
  const styles: Record<string, string> = {
    AUTOMATED: "bg-sky-50 text-sky-800 border-sky-200",
    HUMAN_ASSISTED: "bg-amber-50 text-amber-900 border-amber-200",
    HUMAN_ONLY: "bg-violet-50 text-violet-900 border-violet-200",
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
          styles[mode] ?? "bg-slate-100 text-slate-700 border-slate-200"
        }`}
      >
        {mode.replaceAll("_", " ")}
      </span>
      {isHighRisk && (
        <span className="inline-flex items-center rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-800">
          HIGH-RISK HUMAN GATE
        </span>
      )}
    </span>
  );
}
