import React from "react";
import {
  Lock,
  Play,
  Shield,
  UserCheck,
} from "lucide-react";

export interface OperationalTimelineEvent {
  id: string;
  timestamp: string | Date;
  title: string;
  actor: {
    name: string;
    role: "AGENT" | "CARE_MANAGER" | "CLINICIAN" | "SYSTEM" | "MEMBER";
  };
  phase?: "OBSERVE" | "UNDERSTAND" | "PLAN" | "POLICY_CHECK" | "ACT" | "VERIFY" | "UPDATE_STATE";
  toolInvoked?: string;
  policyCheck?: {
    ruleId: string;
    verdict: "ALLOW" | "REQUIRE_HUMAN_APPROVAL" | "DENY";
  };
  evidenceSummary?: string;
  stateChange?: {
    before: string;
    after: string;
  };
  auditHash?: string;
  latencyMs?: number;
  tokensUsed?: number;
}

export function OperationalTimeline({
  events,
  emptyMessage = "No execution events recorded yet.",
}: {
  events: OperationalTimelineEvent[];
  emptyMessage?: string;
}) {
  if (!events || events.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-slate-500 font-mono">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
      {events.map((evt, idx) => {
        const isAgent = evt.actor.role === "AGENT";
        const isHuman = evt.actor.role === "CARE_MANAGER" || evt.actor.role === "CLINICIAN";
        const isApprovalBlocked = evt.policyCheck?.verdict === "REQUIRE_HUMAN_APPROVAL";

        const dotColor = isApprovalBlocked
          ? "bg-rose-500 ring-rose-100"
          : isHuman
            ? "bg-amber-500 ring-amber-100"
            : isAgent
              ? "bg-teal-600 ring-teal-100"
              : "bg-slate-400 ring-slate-100";

        return (
          <div key={evt.id || idx} className="relative group">
            {/* Timeline Dot */}
            <span
              className={`absolute -left-[27px] top-1.5 h-3.5 w-3.5 rounded-full ring-4 ${dotColor}`}
            />

            <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs transition-all hover:border-slate-300">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs sm:text-sm text-slate-900">
                    {evt.title}
                  </span>
                  {evt.phase && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600 uppercase">
                      {evt.phase}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-400">
                    {new Date(evt.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      isHuman
                        ? "bg-amber-50 text-amber-800 border border-amber-200"
                        : "bg-teal-50 text-teal-800 border border-teal-200"
                    }`}
                  >
                    {isHuman ? <UserCheck className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5" />}
                    {evt.actor.name}
                  </span>
                </div>
              </div>

              {/* Event Body */}
              <div className="mt-2 text-xs text-slate-700 space-y-1.5">
                {evt.evidenceSummary && (
                  <div className="flex items-start gap-1.5 text-slate-600">
                    <Lock className="h-3 w-3 mt-0.5 text-slate-400 shrink-0" />
                    <span>{evt.evidenceSummary}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                  {evt.toolInvoked && (
                    <span className="font-mono bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-700">
                      Tool: <strong>{evt.toolInvoked}</strong>
                    </span>
                  )}

                  {evt.policyCheck && (
                    <span
                      className={`inline-flex items-center gap-1 font-mono border px-2 py-0.5 rounded ${
                        evt.policyCheck.verdict === "REQUIRE_HUMAN_APPROVAL"
                          ? "bg-rose-50 text-rose-800 border-rose-300"
                          : "bg-emerald-50 text-emerald-800 border-emerald-300"
                      }`}
                    >
                      <Shield className="h-3 w-3" />
                      Policy: {evt.policyCheck.ruleId} ({evt.policyCheck.verdict})
                    </span>
                  )}

                  {evt.stateChange && (
                    <span className="font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-700">
                      State: {evt.stateChange.before} &rarr; {evt.stateChange.after}
                    </span>
                  )}

                  {evt.latencyMs !== undefined && (
                    <span className="font-mono text-slate-400">
                      {evt.latencyMs}ms
                    </span>
                  )}

                  {evt.auditHash && (
                    <span className="font-mono text-slate-400 ml-auto" title="Tamper-evident audit hash">
                      Hash: {evt.auditHash}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
