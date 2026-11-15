import React from "react";

export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:pl-72" aria-busy="true" aria-label="Loading workspace">
      <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
        <div className="h-14 rounded-xl border border-slate-200 bg-white p-4" />
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="h-24 rounded-xl border border-slate-200 bg-white" />
          <div className="h-24 rounded-xl border border-slate-200 bg-white" />
          <div className="h-24 rounded-xl border border-slate-200 bg-white" />
          <div className="h-24 rounded-xl border border-slate-200 bg-white" />
        </div>
        <div className="h-72 rounded-xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}
