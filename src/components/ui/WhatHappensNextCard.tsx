"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Lock,
  Play,
  Shield,
  ShieldAlert,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { CaseStatusBadge } from "../StatusBadges";
import { CaseStatus } from "@prisma/client";

export interface WhatHappensNextProps {
  status: CaseStatus | string;
  nextStepTitle: string;
  nextStepDescription: string;
  actionLabel?: string;
  actionHref?: string;
  onActionClick?: () => void;
  actionTone?: "primary" | "warning" | "urgent" | "success" | "neutral";
  assignedAgentOrActor?: string;
  executionMode?: "AUTONOMOUS" | "HUMAN_APPROVAL_REQUIRED" | "AWAITING_EXTERNAL_SIGNAL" | "COMPLETE";
  policyRuleCited?: string;
  policyVerdict?: "ALLOW" | "REQUIRE_HUMAN_APPROVAL" | "DENY";
  evidenceCited?: string[];
  slaDueAt?: string | null;
  compact?: boolean;
}

export function WhatHappensNextCard({
  status,
  nextStepTitle,
  nextStepDescription,
  actionLabel,
  actionHref,
  onActionClick,
  actionTone = "primary",
  assignedAgentOrActor = "CaseOrchestratorAgent",
  executionMode = "AUTONOMOUS",
  policyRuleCited,
  policyVerdict = "ALLOW",
  evidenceCited = [],
  slaDueAt,
  compact = false,
}: WhatHappensNextProps) {
  const isUrgent = actionTone === "urgent" || executionMode === "HUMAN_APPROVAL_REQUIRED";
  const isSuccess = status === "VERIFIED" || status === "CLOSED" || executionMode === "COMPLETE";

  // Visual container styles: trustworthy, operational, low cognitive load
  const borderStyles = isUrgent
    ? "border-rose-300 bg-linear-to-r from-rose-50/80 via-white to-amber-50/40"
    : isSuccess
      ? "border-emerald-300 bg-linear-to-r from-emerald-50/80 via-white to-teal-50/40"
      : "border-teal-300 bg-linear-to-r from-teal-50/80 via-white to-sky-50/40";

  const bannerIcon = isUrgent ? (
    <ShieldAlert className="h-5 w-5 text-rose-700 shrink-0" />
  ) : isSuccess ? (
    <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0" />
  ) : (
    <Play className="h-5 w-5 text-teal-700 shrink-0 fill-teal-700" />
  );

  return (
    <aside
      aria-label="What Happens Next - Operational Directive"
      className={`rounded-xl border shadow-sm transition-all duration-150 ${borderStyles} ${
        compact ? "p-3.5" : "p-4 sm:p-5"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
        <div className="flex items-center gap-2">
          {bannerIcon}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Primary Directive: What Happens Next?
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                  executionMode === "HUMAN_APPROVAL_REQUIRED"
                    ? "bg-rose-100 text-rose-900 border border-rose-300"
                    : executionMode === "AUTONOMOUS"
                      ? "bg-teal-100 text-teal-900 border border-teal-300"
                      : "bg-slate-100 text-slate-800 border border-slate-200"
                }`}
              >
                {executionMode === "HUMAN_APPROVAL_REQUIRED" && <UserCheck className="h-3 w-3" />}
                {executionMode === "AUTONOMOUS" && <Sparkles className="h-3 w-3" />}
                {executionMode === "AWAITING_EXTERNAL_SIGNAL" && <Clock className="h-3 w-3" />}
                {executionMode.replaceAll("_", " ")}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight mt-0.5">
              {nextStepTitle}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <CaseStatusBadge status={status} />
          {slaDueAt && (
            <span className="hidden md:inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 bg-white/80 border border-slate-200 px-2 py-0.5 rounded">
              <Clock className="h-3 w-3 text-slate-400" />
              SLA: {new Date(slaDueAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
            {nextStepDescription}
          </p>

          {(policyRuleCited || evidenceCited.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-600">
              {policyRuleCited && (
                <span className="inline-flex items-center gap-1 font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700">
                  <Shield className="h-3 w-3 text-teal-600" />
                  Policy: {policyRuleCited} ({policyVerdict})
                </span>
              )}
              {evidenceCited.slice(0, 2).map((ev, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 max-w-[240px] truncate"
                  title={ev}
                >
                  <Lock className="h-2.5 w-2.5 text-slate-400" />
                  {ev}
                </span>
              ))}
              <span className="text-[11px] text-slate-500 font-medium">
                Executor: <code className="text-slate-700 font-mono">{assignedAgentOrActor}</code>
              </span>
            </div>
          )}
        </div>

        {/* Primary Action Button */}
        {(actionLabel || actionHref) && (
          <div className="shrink-0 self-start md:self-center">
            {actionHref ? (
              <Link
                href={actionHref}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold shadow-xs transition-colors focus:ring-2 focus:ring-offset-1 ${
                  isUrgent
                    ? "bg-rose-700 text-white hover:bg-rose-800 focus:ring-rose-500"
                    : "bg-teal-700 text-white hover:bg-teal-800 focus:ring-teal-500"
                }`}
              >
                <span>{actionLabel ?? "Take Immediate Action"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : onActionClick ? (
              <button
                type="button"
                onClick={onActionClick}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold shadow-xs transition-colors focus:ring-2 focus:ring-offset-1 ${
                  isUrgent
                    ? "bg-rose-700 text-white hover:bg-rose-800 focus:ring-rose-500"
                    : "bg-teal-700 text-white hover:bg-teal-800 focus:ring-teal-500"
                }`}
              >
                <span>{actionLabel ?? "Execute Next Step"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
