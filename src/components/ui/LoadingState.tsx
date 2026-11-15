import React from "react";
import { Loader2 } from "lucide-react";

export interface LoadingStateProps {
  label?: string;
  description?: string;
  progressStep?: string;
  className?: string;
}

export function LoadingState({
  label = "Processing operational request...",
  description = "Verifying policy boundaries and state consistency.",
  progressStep,
  className = "",
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white/80 p-8 text-center backdrop-blur-xs ${className}`}
    >
      <div className="relative flex h-10 w-10 items-center justify-center">
        <div className="absolute h-10 w-10 animate-ping rounded-full bg-teal-100 opacity-75" />
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-900">{label}</h3>
      <p className="mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">{description}</p>
      {progressStep && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 font-mono text-[11px] text-slate-700">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-600 animate-pulse" />
          <span>{progressStep}</span>
        </div>
      )}
    </div>
  );
}

export function TableLoadingSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse space-y-2.5 p-4">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <div
              key={cIdx}
              className="h-4 bg-slate-200 rounded"
              style={{ width: `${Math.max(15, 100 / cols - 5)}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
