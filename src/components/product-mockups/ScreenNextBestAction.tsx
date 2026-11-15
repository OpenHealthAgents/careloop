"use client";

import React, { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Calendar,
  CheckCircle2,
  Star,
  MapPin,
} from "lucide-react";

export interface ScreenNextBestActionProps {
  className?: string;
  onContinue?: () => void;
}

const PROVIDERS = [
  {
    id: "dr-lin",
    name: "Dr. Sarah Lin, MD",
    title: "Cardiovascular Disease & Arrhythmia",
    clinic: "Bay Area Cardiovascular Specialists",
    rating: "4.9",
    reviewsCount: 142,
    distance: "1.8 miles away",
    address: "450 Sutter St, Suite 800",
    earliestSlot: "This Thursday at 10:15 AM",
    copay: "$35.00 (In-network Tier 1)",
    selected: true,
  },
  {
    id: "dr-patel",
    name: "Dr. Robert Patel, MD",
    title: "General & Preventive Cardiology",
    clinic: "Sutter Health Specialty Center",
    rating: "4.8",
    reviewsCount: 98,
    distance: "3.2 miles away",
    address: "1100 Van Ness Ave, 5th Floor",
    earliestSlot: "Next Monday at 2:00 PM",
    copay: "$35.00 (In-network Tier 1)",
    selected: false,
  },
];

export function ScreenNextBestAction({
  className = "",
  onContinue,
}: ScreenNextBestActionProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>("dr-lin");

  return (
    <div className={`space-y-6 bg-[#FAF8F5] p-4 sm:p-6 text-[#191716] ${className}`}>
      {/* Top Header Card */}
      <div className="rounded-2xl border-2 border-[#0E6156] bg-white p-5 sm:p-6 shadow-soft">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[#EBF5F3] px-2.5 py-0.5 text-xs font-bold text-[#0E6156] uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0E6156]" />
            Your Next Step
          </span>
          <span className="text-xs font-semibold text-[#8A8279]">Takes ~2 minutes</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#191716] tracking-tight">
          Schedule your cardiology appointment.
        </h2>
        <p className="text-xs sm:text-sm text-[#5C5650] mt-1 max-w-2xl leading-relaxed">
          CareLoop has verified your insurance coverage and pre-cleared intake requirements. Review the details below and select your preferred slot.
        </p>

        {/* 3 Core Explanation Cards: Why this matters, What to expect, What you'll need */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-[#E2DDD5]/70 pt-6">
          {/* 1. Why this matters */}
          <div className="rounded-xl bg-[#FAF8F5] p-4 border border-[#E2DDD5]/80 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0E6156] block">
              Why this matters
            </span>
            <p className="text-xs text-[#5C5650] leading-relaxed">
              Your primary care physician noted changes in your resting heart rate. Seeing a specialist within 30 days helps confirm baseline rhythm and prevent symptoms from escalating.
            </p>
          </div>

          {/* 2. What to expect */}
          <div className="rounded-xl bg-[#FAF8F5] p-4 border border-[#E2DDD5]/80 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1E6091] block">
              What to expect
            </span>
            <p className="text-xs text-[#5C5650] leading-relaxed">
              A 45-minute comprehensive consultation, including an in-office 12-lead ECG, review of your medication history, and discussion of physical activity goals.
            </p>
          </div>

          {/* 3. What you'll need */}
          <div className="rounded-xl bg-[#FAF8F5] p-4 border border-[#E2DDD5]/80 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#C87D2A] block">
              What you&apos;ll need
            </span>
            <ul className="text-xs text-[#5C5650] space-y-1 list-disc pl-4 leading-relaxed">
              <li>Photo ID &amp; Insurance Card</li>
              <li>Recent blood panel results (Pre-staged)</li>
              <li>Daily medication log</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Potential Providers Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#191716]">Potential Providers</h3>
            <p className="text-xs text-[#5C5650]">
              Matched based on your referral, network tier, and immediate availability.
            </p>
          </div>
          <span className="text-xs font-semibold text-[#0E6156] bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
            2 In-Network Matches
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PROVIDERS.map((doc) => {
            const isSelected = selectedProvider === doc.id;
            return (
              <div
                key={doc.id}
                onClick={() => setSelectedProvider(doc.id)}
                className={`cursor-pointer rounded-2xl p-4 sm:p-5 transition-all flex flex-col justify-between ${
                  isSelected
                    ? "bg-white border-2 border-[#0E6156] shadow-card ring-1 ring-[#0E6156]"
                    : "bg-white border border-[#E2DDD5] hover:border-[#8A8279] shadow-soft"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="text-base font-bold text-[#191716]">{doc.name}</h4>
                      <p className="text-xs text-[#5C5650]">{doc.title}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-[#191716] bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                      <span>{doc.rating}</span>
                      <span className="text-[#8A8279] text-[10px]">({doc.reviewsCount})</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-[#5C5650] mt-3">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-[#8A8279] shrink-0" />
                      <span>{doc.clinic} • {doc.distance}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-[#0E6156] shrink-0" />
                      <span className="font-semibold text-[#191716]">Earliest: {doc.earliestSlot}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#0E6156] font-semibold">
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                      <span>{doc.copay}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E2DDD5]/70 flex items-center justify-between text-xs">
                  <span className={`font-semibold ${isSelected ? "text-[#0E6156]" : "text-[#8A8279]"}`}>
                    {isSelected ? "Selected Provider" : "Click to select"}
                  </span>
                  <div className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                    isSelected ? "border-[#0E6156] bg-[#0E6156] text-white" : "border-[#E2DDD5]"
                  }`}>
                    {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dominant Next Action Banner with "Continue" CTA */}
      <div className="rounded-2xl border border-[#E2DDD5] bg-white p-5 shadow-soft flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EBF5F3] text-[#0E6156]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#191716]">
              Ready to lock in your appointment with {selectedProvider === "dr-lin" ? "Dr. Sarah Lin" : "Dr. Robert Patel"}?
            </div>
            <div className="text-xs text-[#5C5650] mt-0.5">
              CareLoop will book your slot, sync your calendar, and prepare your pre-visit question briefing.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#0E6156] px-6 py-3 text-xs font-bold text-white shadow-soft hover:bg-[#09473F] transition-all shrink-0"
        >
          <span>Continue</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
