import React from "react";
import { AlertCircle, RefreshCw, ShieldAlert } from "lucide-react";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  errorCode?: string;
  onRetry?: () => void;
  action?: React.ReactNode;
  policyBreach?: boolean;
}

export function ErrorState({
  title = "Operational Execution Interrupted",
  description = "A system safeguard or boundary condition prevented completion of this step.",
  errorCode,
  onRetry,
  action,
  policyBreach = false,
}: ErrorStateProps) {
  const Icon = policyBreach ? ShieldAlert : AlertCircle;
  const borderColor = policyBreach ? "border-rose-300 bg-rose-50/50" : "border-slate-200 bg-white";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex flex-col items-center justify-center rounded-xl border p-8 text-center ${borderColor}`}
    >
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-full ${
          policyBreach ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-rose-600"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-600">{description}</p>

      {errorCode && (
        <span className="mt-2 font-mono text-[11px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
          Safeguard Code: {errorCode}
        </span>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 focus:ring-2 focus:ring-teal-500"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
            <span>Retry Operation</span>
          </button>
        )}
        {action}
      </div>
    </div>
  );
}
