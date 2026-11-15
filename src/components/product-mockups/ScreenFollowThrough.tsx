"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Bell,
  ThumbsUp,
  MessageCircle,
} from "lucide-react";

export interface ScreenFollowThroughProps {
  className?: string;
  onTakeNextAction?: () => void;
}

export function ScreenFollowThrough({
  className = "",
  onTakeNextAction,
}: ScreenFollowThroughProps) {
  const [feedbackGiven, setFeedbackGiven] = useState<string | null>("great");

  return (
    <div className={`space-y-6 bg-[#FAF8F5] p-4 sm:p-6 text-[#191716] ${className}`}>
      {/* Top Banner: "How did it go?" */}
      <div className="rounded-2xl border-2 border-[#0E6156] bg-white p-5 sm:p-6 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EBF5F3] px-3 py-0.5 text-xs font-bold text-[#0E6156]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Care Loop Closing
              </span>
              <span className="text-xs text-[#8A8279]">Completed Nov 19</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#191716] mt-1.5 tracking-tight">
              &ldquo;How did it go?&rdquo;
            </h2>
            <p className="text-xs sm:text-sm text-[#5C5650] mt-0.5">
              Let&apos;s capture what your doctor recommended so your care plan stays on track.
            </p>
          </div>

          {/* Quick Reaction Pills */}
          <div className="flex items-center gap-2">
            {[
              { id: "great", label: "Visit went well", icon: ThumbsUp },
              { id: "questions", label: "Have follow-up questions", icon: MessageCircle },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFeedbackGiven(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  feedbackGiven === item.id
                    ? "bg-[#0E6156] text-white shadow-xs"
                    : "bg-[#FAF8F5] text-[#5C5650] border border-[#E2DDD5] hover:bg-white"
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* SECTION 1: APPOINTMENT COMPLETED */}
        <div className="lg:col-span-12 rounded-2xl border border-[#E2DDD5] bg-white p-5 shadow-soft space-y-3">
          <div className="flex items-center justify-between border-b border-[#E2DDD5]/70 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 text-[#0E6156]">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <h3 className="text-base font-bold text-[#191716]">Appointment Completed</h3>
            </div>
            <span className="text-xs font-semibold text-[#0E6156] bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
              Verified by Clinic
            </span>
          </div>

          <div className="rounded-xl bg-[#FAF8F5] p-4 border border-[#E2DDD5]/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="font-bold text-sm text-[#191716]">
                Consultation with Dr. Sarah Lin, MD (Cardiology)
              </div>
              <p className="text-xs text-[#5C5650] mt-0.5">
                Bay Area Cardiovascular • Thursday, Nov 19, 2026 at 10:15 AM
              </p>
              <div className="mt-2 text-xs text-[#191716] space-y-1">
                <span className="font-semibold text-[#0E6156] block">Summary of Visit Takeaways:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-[#5C5650]">
                  <li>In-office 12-lead ECG showed regular sinus rhythm with benign premature ventricular beats.</li>
                  <li>Doctor ordered a 30-day wireless Holter ambulatory monitor patch to track sleep vitals.</li>
                  <li>Schedule 6-week follow-up consultation once monitor report is delivered.</li>
                </ul>
              </div>
            </div>

            <div className="shrink-0 self-start sm:self-auto">
              <span className="text-[11px] font-semibold text-[#0E6156] bg-white px-3 py-1.5 rounded-lg border border-[#E2DDD5] shadow-2xs block text-center">
                Clinical summary filed
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: NEXT RECOMMENDED ACTION */}
        <div className="lg:col-span-7 rounded-2xl border-2 border-[#0E6156] bg-white p-5 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#EBF5F3] px-2.5 py-0.5 text-xs font-bold text-[#0E6156] uppercase tracking-wider">
                <Sparkles className="h-3 w-3" />
                Next Recommended Action
              </span>
              <span className="text-[11px] text-[#8A8279]">Priority Task</span>
            </div>

            <h4 className="text-lg font-bold text-[#191716]">
              Activate 30-Day Wireless Holter Monitor
            </h4>
            <p className="text-xs sm:text-sm text-[#5C5650] mt-1 leading-relaxed">
              Dr. Lin&apos;s clinic dispatched your monitor patch via FedEx (Arriving Friday by 12:00 PM). CareLoop will send a setup walkthrough once delivered.
            </p>

            <div className="mt-4 rounded-xl bg-[#FAF8F5] p-3.5 border border-[#E2DDD5]/70 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#5C5650]">Device:</span>
                <span className="font-semibold text-[#191716]">BioTel Heart Wireless Sensor</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5C5650]">Tracking Number:</span>
                <span className="font-mono text-[#0E6156] font-semibold">FDX-99482104</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5C5650]">Prior Auth:</span>
                <span className="text-[#0E6156] font-semibold">Pre-approved by UnitedHealthcare</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-[#E2DDD5]/70 flex items-center justify-between">
            <span className="text-xs text-[#5C5650]">Zero paperwork needed</span>
            <button
              type="button"
              onClick={onTakeNextAction}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0E6156] px-4 py-2 text-xs font-bold text-white shadow-soft hover:bg-[#09473F] transition-all"
            >
              <span>View Setup Checklist</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* SECTION 3: FOLLOW-UP REMINDER */}
        <div className="lg:col-span-5 rounded-2xl border border-[#E2DDD5] bg-white p-5 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-[#C87D2A] uppercase tracking-wider">
                <Bell className="h-3 w-3" />
                Follow-up Reminder
              </span>
              <span className="text-[11px] font-bold text-amber-900 bg-amber-100/60 px-2 py-0.5 rounded-full">
                Dec 22
              </span>
            </div>

            <h4 className="text-base font-bold text-[#191716]">
              6-Week Review: Monitor Results
            </h4>
            <p className="text-xs text-[#5C5650] mt-1 leading-relaxed">
              Dr. Lin will review your 30-day rhythm telemetry and finalize your personalized lifestyle guidance.
            </p>

            <div className="mt-4 rounded-xl bg-amber-50/70 p-3.5 border border-amber-200/60 text-xs space-y-1.5 text-amber-950">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Scheduled:</span>
                <span>Tuesday, Dec 22 at 2:00 PM</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Format:</span>
                <span>Telehealth Video Consultation</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Calendar Sync:</span>
                <span className="text-[#0E6156] font-bold">Synced with Google / Apple</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-[#E2DDD5]/70 flex items-center justify-between text-xs">
            <span className="text-[#8A8279]">CareLoop Reminder: -48h &amp; -2h</span>
            <span className="font-semibold text-[#0E6156] hover:underline cursor-pointer">
              Modify Reminder →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
