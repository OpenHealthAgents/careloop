"use client";

import React from "react";
import {
  Check,
  Calendar,
  MapPin,
  ShieldCheck,
  Phone,
  Sparkles,
  Info,
} from "lucide-react";

export interface ScreenCareJourneyProps {
  className?: string;
}

const JOURNEY_STEPS = [
  {
    name: "Understand",
    status: "completed" as const,
    symbol: "✓",
    desc: "Referral decoded & symptoms recorded",
    date: "Completed Nov 10",
  },
  {
    name: "Choose",
    status: "completed" as const,
    symbol: "✓",
    desc: "3 in-network specialists compared",
    date: "Completed Nov 14",
  },
  {
    name: "Schedule",
    status: "active" as const,
    symbol: "●",
    desc: "Confirmed for Thursday, Nov 19 at 10:15 AM",
    date: "Current Focus",
  },
  {
    name: "Prepare",
    status: "upcoming" as const,
    symbol: "○",
    desc: "Doctor questions & records checklist",
    date: "Unlocks Nov 18",
  },
  {
    name: "Follow up",
    status: "upcoming" as const,
    symbol: "○",
    desc: "Prescriptions & post-visit care plan",
    date: "Scheduled Nov 22",
  },
];

export function ScreenCareJourney({ className = "" }: ScreenCareJourneyProps) {
  return (
    <div className={`space-y-6 bg-[#FAF8F5] p-4 sm:p-6 text-[#191716] ${className}`}>
      {/* Header with Goal */}
      <div className="rounded-2xl border border-[#E2DDD5] bg-white p-5 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EBF5F3] px-3 py-0.5 text-xs font-bold text-[#0E6156]">
                <Sparkles className="h-3 w-3" />
                Active Care Journey
              </span>
              <span className="text-xs text-[#8A8279]">ID: CJ-CAR-2026</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#191716] mt-1.5 tracking-tight">
              Goal: Find a cardiologist
            </h2>
            <p className="text-xs sm:text-sm text-[#5C5650] mt-1">
              Referred by Dr. Michael Vance (Internal Medicine) for resting pulse evaluation.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="rounded-xl bg-[#FAF8F5] px-3 py-1.5 border border-[#E2DDD5] text-xs font-semibold text-[#191716]">
              Step 3 of 5
            </span>
          </div>
        </div>

        {/* 5-Step Visual Progress Stepper (Understand ✓, Choose ✓, Schedule ●, Prepare ○, Follow up ○) */}
        <div className="mt-8 pt-6 border-t border-[#E2DDD5]/70">
          <div className="relative">
            {/* Horizontal Line behind steps */}
            <div className="absolute top-4 left-6 right-6 h-0.5 bg-[#E2DDD5] -z-0 hidden md:block" />

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative z-10">
              {JOURNEY_STEPS.map((step, idx) => {
                const isCompleted = step.status === "completed";
                const isActive = step.status === "active";

                return (
                  <div
                    key={idx}
                    className={`rounded-2xl p-3.5 transition-all ${
                      isActive
                        ? "bg-[#EBF5F3] border-2 border-[#0E6156] shadow-soft"
                        : isCompleted
                        ? "bg-white border border-teal-200"
                        : "bg-white/60 border border-[#E2DDD5] opacity-75"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                          isCompleted
                            ? "bg-[#0E6156] text-white"
                            : isActive
                            ? "bg-[#0E6156] text-white ring-4 ring-teal-100"
                            : "bg-[#E2DDD5] text-[#8A8279]"
                        }`}
                      >
                        {isCompleted ? <Check className="h-4 w-4" /> : step.symbol}
                      </div>

                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isCompleted
                            ? "bg-teal-50 text-[#0E6156]"
                            : isActive
                            ? "bg-[#0E6156] text-white"
                            : "bg-stone-100 text-[#8A8279]"
                        }`}
                      >
                        {step.status}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-[#191716]">{step.name}</h4>
                    <p className="text-[11px] text-[#5C5650] mt-1 line-clamp-2 leading-relaxed">
                      {step.desc}
                    </p>
                    <div className="text-[10px] text-[#8A8279] mt-2 font-medium">
                      {step.date}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Active Step Deep Dive: Step 3 — Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Confirmed Appointment Details */}
        <div className="lg:col-span-8 rounded-2xl border border-[#E2DDD5] bg-white p-5 sm:p-6 shadow-soft space-y-5">
          <div className="flex items-center justify-between border-b border-[#E2DDD5]/70 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#0E6156]">
                Current Step in Action
              </span>
              <h3 className="text-lg font-bold text-[#191716] mt-0.5">
                Cardiology Consultation Confirmed
              </h3>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EBF5F3] px-3 py-1 text-xs font-bold text-[#0E6156] border border-teal-200">
              <Check className="h-3.5 w-3.5" />
              Slot Secured
            </span>
          </div>

          {/* Doctor & Clinic Card */}
          <div className="rounded-2xl bg-[#FAF8F5] p-4 sm:p-5 border border-[#E2DDD5] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0E6156] text-white font-bold text-base shadow-xs">
                SL
              </div>
              <div>
                <h4 className="text-base font-bold text-[#191716]">Dr. Sarah Lin, MD</h4>
                <p className="text-xs text-[#5C5650]">Cardiovascular Disease Specialist • Board Certified</p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-[#0E6156] font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>In-Network Verified (Tier 1 PPO)</span>
                </div>
              </div>
            </div>

            <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-[#E2DDD5] w-full sm:w-auto">
              <span className="text-[11px] text-[#8A8279] uppercase block font-semibold">Confirmed Copay</span>
              <span className="text-xl font-extrabold text-[#191716]">$35.00</span>
            </div>
          </div>

          {/* Date, Time & Location Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-[#E2DDD5] p-3.5 bg-white">
              <div className="flex items-center gap-2 text-[#8A8279] mb-1 font-semibold">
                <Calendar className="h-4 w-4 text-[#0E6156]" />
                <span>Date &amp; Time</span>
              </div>
              <div className="font-bold text-sm text-[#191716]">Thursday, Nov 19, 2026</div>
              <div className="text-[#5C5650] mt-0.5">10:15 AM PST (Arrive by 10:00 AM)</div>
            </div>

            <div className="rounded-xl border border-[#E2DDD5] p-3.5 bg-white">
              <div className="flex items-center gap-2 text-[#8A8279] mb-1 font-semibold">
                <MapPin className="h-4 w-4 text-[#0E6156]" />
                <span>Location</span>
              </div>
              <div className="font-bold text-sm text-[#191716]">Bay Area Cardiovascular</div>
              <div className="text-[#5C5650] mt-0.5">450 Sutter St, Suite 800, San Francisco</div>
            </div>
          </div>

          {/* Next Action in Stepper */}
          <div className="rounded-xl bg-amber-50/70 p-4 border border-amber-200/80 flex items-start gap-3 text-xs text-amber-950">
            <Info className="h-4 w-4 text-[#C87D2A] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">What happens next:</span> Once this appointment is completed, CareLoop unlocks Step 4 (Appointment Prep) notes and records your cardiologist&apos;s recommendations into your long-term follow-through tracker.
            </div>
          </div>
        </div>

        {/* Right Column: Pre-visit Checklist & Human Navigator Note */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-[#E2DDD5] bg-white p-5 shadow-soft space-y-3">
            <h4 className="text-sm font-bold text-[#191716]">Journey Milestones</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-[#0E6156]">
                <Check className="h-4 w-4 shrink-0" />
                <span>Referral notes verified</span>
              </div>
              <div className="flex items-center gap-2 text-[#0E6156]">
                <Check className="h-4 w-4 shrink-0" />
                <span>Prior authorization confirmed</span>
              </div>
              <div className="flex items-center gap-2 text-[#0E6156]">
                <Check className="h-4 w-4 shrink-0" />
                <span>Calendar alert synced</span>
              </div>
              <div className="flex items-center gap-2 text-[#5C5650]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C87D2A] mx-1" />
                <span>Pre-visit questions prepared</span>
              </div>
              <div className="flex items-center gap-2 text-[#8A8279]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#E2DDD5] mx-1" />
                <span>Post-visit care loop</span>
              </div>
            </div>
          </div>

          {/* Care Guide Note */}
          <div className="rounded-2xl border border-teal-200/80 bg-[#EBF5F3] p-4 text-xs text-[#0E6156] space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Phone className="h-4 w-4" />
              <span>Care Guide Assistance</span>
            </div>
            <p className="leading-relaxed text-[#191716]">
              Elena from CareLoop contacted Dr. Lin&apos;s office to confirm new patient intake forms were received. You are fully set for Thursday.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
