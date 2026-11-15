"use client";

import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, X } from "lucide-react";

export function FeedbackBanner({
  type,
  text,
  onDismiss,
}: {
  type: "success" | "error" | "warning";
  text: string;
  onDismiss?: () => void;
}) {
  const styles =
    type === "success"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : type === "warning"
        ? "border-amber-300 bg-amber-50 text-amber-950"
        : "border-rose-300 bg-rose-50 text-rose-950";

  const Icon =
    type === "success" ? CheckCircle2 : type === "warning" ? AlertTriangle : AlertCircle;

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
      className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-xs font-medium shadow-2xs ${styles}`}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="leading-relaxed">{text}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="rounded p-0.5 opacity-75 hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
