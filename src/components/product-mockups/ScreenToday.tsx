"use client";

import React from "react";
import {
  Calendar,
  ArrowRight,
  CheckCircle2,
  FileQuestion,
  RefreshCw,
  Sparkles,
  MapPin,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

export interface ScreenTodayProps {
  userName?: string;
  className?: string;
}

export function ScreenToday({
  userName = "Elena",
  className = "",
}: ScreenTodayProps) {
  return (
    <div className={`space-y-5 bg-[#FAF8F5] p-4 sm:p-6 text-[#191716] ${className}`}>
      {/* Top Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E2DDD5]/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#0E6156]">
              Daily Care Briefing
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#0E6156]" />
            <span className="text-xs text-[#8A8279]">Thursday, Nov 19</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#191716] mt-0.5">
            Good morning, {userName}
          </h2>
          <p className="text-xs sm:text-sm text-[#5C5650] mt-0.5">
            Here&apos;s what matters today.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-[#EBF5F3] px-3 py-1 text-xs font-semibold text-[#0E6156] border border-teal-200/60">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Active loop: Cardiology</span>
        </div>
      </div>

      {/* Grid of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* CARD 1: NEXT STEP (Dominant Focus Card) */}
        <div className="md:col-span-7 rounded-2xl border-2 border-[#0E6156] bg-white p-4 sm:p-5 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#EBF5F3] px-2.5 py-0.5 text-[11px] font-bold text-[#0E6156] uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0E6156]" />
                Next Step
              </span>
              <span className="text-[11px] font-medium text-[#8A8279]">Estimated time: 2 mins</span>
            </div>

            <h3 className="text-lg font-bold text-[#191716]">
              Schedule your cardiology appointment
            </h3>
            <p className="text-xs sm:text-sm text-[#5C5650] mt-1 leading-relaxed">
              Dr. Sarah Lin, MD has two verified in-network slots available this Thursday and next Monday. Your referral records are already pre-forwarded.
            </p>

            <div className="mt-3.5 rounded-xl bg-[#FAF8F5] p-3 border border-[#E2DDD5]/70 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-[#EBF5F3] text-[#0E6156] flex items-center justify-center font-bold text-xs">
                  SL
                </div>
                <div>
                  <div className="font-semibold text-[#191716]">Dr. Sarah Lin, MD</div>
                  <div className="text-[11px] text-[#5C5650]">Bay Area Cardiovascular • In-network (Tier 1)</div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-[#0E6156] bg-teal-50 px-2 py-1 rounded-md border border-teal-200">
                Copay: $35
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E2DDD5]/60 flex items-center justify-between">
            <span className="text-xs text-[#5C5650]">Slot held for 24 hours</span>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0E6156] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#09473F] transition-all"
            >
              <span>Schedule Now</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* CARD 2: UPCOMING APPOINTMENT */}
        <div className="md:col-span-5 rounded-2xl border border-[#E2DDD5] bg-white p-4 sm:p-5 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-[#C87D2A] uppercase tracking-wider">
                <Calendar className="h-3 w-3" />
                Upcoming Appointment
              </span>
              <span className="text-[11px] font-bold text-amber-900 bg-amber-100/60 px-2 py-0.5 rounded-full">
                Today at 8:30 AM
              </span>
            </div>

            <h3 className="text-base font-bold text-[#191716]">
              Routine Metabolic Blood Panel
            </h3>
            <p className="text-xs text-[#5C5650] mt-1 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[#8A8279] shrink-0" />
              <span>Quest Diagnostics • 450 Sutter St, Suite 300</span>
            </p>

            <div className="mt-3 rounded-xl bg-amber-50/70 p-2.5 border border-amber-200/60 text-xs text-amber-950 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-[#C87D2A] shrink-0 mt-0.5" />
              <div className="leading-snug">
                <strong>Fasting Instruction:</strong> Water only after midnight. No breakfast until blood draw is complete.
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E2DDD5]/60 flex items-center justify-between text-xs">
            <span className="text-[#8A8279]">Confirmation #QD-9842</span>
            <span className="font-semibold text-[#0E6156] hover:underline cursor-pointer">
              Get Directions →
            </span>
          </div>
        </div>

        {/* CARD 3: QUESTION TO ASK */}
        <div className="md:col-span-4 rounded-2xl border border-[#E2DDD5] bg-white p-4 shadow-soft">
          <div className="flex items-center gap-1.5 mb-2">
            <FileQuestion className="h-4 w-4 text-[#0E6156]" />
            <span className="text-xs font-bold text-[#0E6156] uppercase tracking-wider">
              Question to Ask
            </span>
          </div>
          <h4 className="text-sm font-bold text-[#191716] mb-1">
            For your specialist consultation
          </h4>
          <p className="text-xs text-[#5C5650] mb-3">
            CareLoop generated 3 key questions based on your logged symptom history:
          </p>

          <div className="space-y-2 text-xs bg-[#FAF8F5] p-3 rounded-xl border border-[#E2DDD5]/60 text-[#191716]">
            <div className="flex items-start gap-2">
              <span className="font-bold text-[#0E6156]">1.</span>
              <span>&ldquo;How does my family history of arrhythmia affect my resting pulse target?&rdquo;</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-[#0E6156]">2.</span>
              <span>&ldquo;Should we adjust my dosage if I notice dizziness after morning workouts?&rdquo;</span>
            </div>
          </div>

          <div className="mt-3 text-right">
            <span className="text-[11px] font-semibold text-[#0E6156] cursor-pointer hover:underline">
              View all 3 prep questions →
            </span>
          </div>
        </div>

        {/* CARD 4: FOLLOW-UP */}
        <div className="md:col-span-4 rounded-2xl border border-[#E2DDD5] bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between gap-1.5 mb-2">
            <div className="flex items-center gap-1.5">
              <RefreshCw className="h-4 w-4 text-[#1E6091]" />
              <span className="text-xs font-bold text-[#1E6091] uppercase tracking-wider">
                Follow-up
              </span>
            </div>
            <span className="text-[10px] font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
              In Transit
            </span>
          </div>

          <h4 className="text-sm font-bold text-[#191716] mb-1">
            Prescription Renewal: Atorvastatin (20mg)
          </h4>
          <p className="text-xs text-[#5C5650] mb-3">
            90-day maintenance supply requested through Walgreens Downtown.
          </p>

          <div className="rounded-xl bg-[#FAF8F5] p-3 border border-[#E2DDD5]/60 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[#5C5650]">Prescribing Clinic:</span>
              <span className="font-semibold text-[#191716]">Dr. Vance Primary Care</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#5C5650]">Ready for Pickup:</span>
              <span className="font-bold text-[#0E6156]">Today after 2:00 PM</span>
            </div>
          </div>

          <div className="mt-3 text-right">
            <span className="text-[11px] font-semibold text-[#1E6091] cursor-pointer hover:underline">
              View pharmacy details →
            </span>
          </div>
        </div>

        {/* CARD 5: PROGRESS */}
        <div className="md:col-span-4 rounded-2xl border border-[#E2DDD5] bg-white p-4 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1.5 mb-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#0E6156]" />
                <span className="text-xs font-bold text-[#0E6156] uppercase tracking-wider">
                  Progress
                </span>
              </div>
              <span className="text-xs font-bold text-[#0E6156]">65% Complete</span>
            </div>

            <h4 className="text-sm font-bold text-[#191716] mb-1">
              Q4 Cardiovascular Health Plan
            </h4>
            <p className="text-xs text-[#5C5650] mb-3">
              4 of 6 care milestones completed this quarter.
            </p>

            {/* Progress Bar */}
            <div className="h-2 w-full rounded-full bg-[#E2DDD5] overflow-hidden">
              <div className="h-full bg-[#0E6156] rounded-full transition-all" style={{ width: "65%" }} />
            </div>

            <div className="mt-3 space-y-1 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#5C5650]">Completed milestones:</span>
                <span className="font-semibold text-[#191716]">Referral, Vitals review, Baseline labs</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#5C5650]">Remaining:</span>
                <span className="font-semibold text-[#C87D2A]">Specialist visit, Post-visit review</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2 border-t border-[#E2DDD5]/60 flex items-center justify-between text-xs">
            <span className="text-[#8A8279]">Care Journey #CJ-402</span>
            <span className="font-semibold text-[#0E6156] hover:underline cursor-pointer flex items-center gap-1">
              Open Timeline <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
