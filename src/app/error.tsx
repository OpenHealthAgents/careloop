"use client";

import React from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              Unable to load CareLoop workspace
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              An unexpected error interrupted this request. You can retry safely or return to the
              Referral Worklist.
            </p>
            {error.digest && (
              <p className="mt-2 font-mono text-[11px] text-slate-400">Ref: {error.digest}</p>
            )}
          </div>
        </div>
        <div className="mt-5 flex items-center gap-2.5">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-600"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
          <Link
            href="/worklist"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Open Referral Worklist
          </Link>
        </div>
      </div>
    </div>
  );
}
