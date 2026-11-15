"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Calendar,
  Sparkles,
  MapPin,
  ShieldCheck,
  ArrowRight,
  UserCheck,
  Car,
  Check,
} from "lucide-react";

interface CaseScenario {
  id: string;
  patientName: string;
  relationship: string;
  careGoal: string;
  status: string;
  urgency: "Urgent" | "Standard" | "High Priority";
  stages: {
    title: string;
    description: string;
    actionDone: boolean;
    badge: string;
    time: string;
  }[];
  activeCard: {
    type: string;
    provider: string;
    specialty: string;
    distance: string;
    date: string;
    inNetwork: boolean;
    copayEstimate: string;
    prepItems: string[];
    logistics: string;
    assignedNavigator: string;
  };
}

const DEMO_CASES: CaseScenario[] = [
  {
    id: "case-1",
    patientName: "Elena R.",
    relationship: "Navigating for herself",
    careGoal: "Neurology Specialist Referral & Physical Therapy",
    status: "Appointment Secured • Prep Checklist Ready",
    urgency: "High Priority",
    stages: [
      {
        title: "1. Understand Doctor's Note",
        description: "Translated clinic summary: rules out tension triggers, starts targeted migraine protocol.",
        actionDone: true,
        badge: "Plain-English Decoded",
        time: "9:04 AM",
      },
      {
        title: "2. Verify In-Network Specialist",
        description: "Cross-referenced insurance network and verified live schedule openings within 10 days.",
        actionDone: true,
        badge: "In-Network Verified",
        time: "9:12 AM",
      },
      {
        title: "3. Direct Appointment Booking",
        description: "Confirmed appointment with Dr. Chen; patient intake forms transmitted digitally.",
        actionDone: true,
        badge: "Slot Confirmed",
        time: "9:28 AM",
      },
      {
        title: "4. Visit Preparation & Logistics",
        description: "Voucher for return transit reserved; custom 4-question doctor visit guide generated.",
        actionDone: true,
        badge: "Prep Complete",
        time: "10:15 AM",
      },
      {
        title: "5. Follow-Through & Loop Closure",
        description: "Automated post-visit check-in, prescription tracking, and physical therapy reminder scheduled.",
        actionDone: false,
        badge: "Queued for Post-Visit",
        time: "Next Step",
      },
    ],
    activeCard: {
      type: "Confirmed Specialist Visit",
      provider: "Dr. Andrea Chen, MD, FAAN",
      specialty: "Neurology & Headache Medicine",
      distance: "3.8 miles away • Valley Medical Pavilion",
      date: "Thursday, Nov 20 • 10:30 AM",
      inNetwork: true,
      copayEstimate: "$30 specialist copay (verified with plan)",
      prepItems: [
        "Migraine frequency log attached to intake",
        "Previous MRI disc confirmed at imaging center",
        "Questions to ask: 'Are preventive CGRP therapies covered?'",
      ],
      logistics: "Lyft return ride pre-scheduled • Intake paperwork complete",
      assignedNavigator: "Sarah K., RN (Care Navigator)",
    },
  },
  {
    id: "case-2",
    patientName: "Robert T. (Age 79)",
    relationship: "Managed by daughter Maya",
    careGoal: "Cardiology Follow-Up & Echocardiogram",
    status: "Prior Auth Cleared • Family Care Sync",
    urgency: "Urgent",
    stages: [
      {
        title: "1. Decode Referral & Urgency",
        description: "Echocardiogram required following hospital discharge; window is within 14 days.",
        actionDone: true,
        badge: "Urgency Clarified",
        time: "Yesterday",
      },
      {
        title: "2. Prior Authorization Cleared",
        description: "CareLoop fast-tracked clinical documentation to insurer to prevent out-of-pocket bills.",
        actionDone: true,
        badge: "Prior Auth Approved",
        time: "Today 8:30 AM",
      },
      {
        title: "3. Wheelchair-Accessible Slot",
        description: "Coordinated morning appointment with ground-floor accessible imaging suite.",
        actionDone: true,
        badge: "Accessibility Confirmed",
        time: "Today 11:00 AM",
      },
      {
        title: "4. Family Shared Calendar",
        description: "Maya notified with calendar invite, directions, and prep instructions for medication.",
        actionDone: true,
        badge: "Caregiver Synced",
        time: "Today 1:20 PM",
      },
      {
        title: "5. Close Care Loop",
        description: "Results retrieval and primary care doctor notification queued immediately after scan.",
        actionDone: false,
        badge: "Scheduled",
        time: "Pending Visit",
      },
    ],
    activeCard: {
      type: "Echocardiogram + Cardiologist Consultation",
      provider: "Dr. Marcus Vance, FACC",
      specialty: "Diagnostic Cardiology",
      distance: "5.2 miles • Accessible Ground Floor Suite",
      date: "Monday, Nov 24 • 9:15 AM",
      inNetwork: true,
      copayEstimate: "$0 preventive follow-up (covered by Medicare Advantage)",
      prepItems: [
        "Take regular morning medications with water",
        "Wear loose two-piece clothing for ultrasound sensor placement",
        "Maya confirmed as accompanying caregiver on file",
      ],
      logistics: "Wheelchair parking pass reserved in Section B",
      assignedNavigator: "David L., MSW (Senior Care Coordinator)",
    },
  },
];

export function CareCompanionPreview() {
  const [selectedCaseIndex, setSelectedCaseIndex] = useState(0);
  const [slotConfirmed, setSlotConfirmed] = useState(false);

  const activeCase = DEMO_CASES[selectedCaseIndex];

  return (
    <div className="relative mx-auto w-full max-w-5xl rounded-3xl border border-stone-200/90 bg-white/95 p-4 shadow-xl backdrop-blur-md sm:p-6 lg:p-8">
      {/* Top Banner / Companion Header */}
      <div className="flex flex-col gap-4 border-b border-stone-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-800 ring-1 ring-teal-200">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-wide uppercase text-teal-800">
                Live Companion Preview
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Active Execution
              </span>
            </div>
            <h3 className="text-base font-semibold text-stone-900">
              From Referral Slip to Completed Visit
            </h3>
          </div>
        </div>

        {/* Case Switcher Pills */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-stone-100 p-1 text-xs">
          {DEMO_CASES.map((c, idx) => (
            <button
              key={c.id}
              onClick={() => {
                setSelectedCaseIndex(idx);
                setSlotConfirmed(false);
              }}
              className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
                selectedCaseIndex === idx
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {c.patientName} ({c.relationship})
            </button>
          ))}
        </div>
      </div>

      {/* Main Companion Body */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: The 5-Step Execution Roadmap */}
        <div className="flex flex-col justify-between rounded-2xl border border-stone-100 bg-stone-50/70 p-4 sm:p-5 lg:col-span-5">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Execution Journey
              </div>
              <span className="text-xs font-medium text-teal-800">
                {activeCase.careGoal}
              </span>
            </div>

            <ol className="relative space-y-4 border-l-2 border-teal-200 pl-4 text-xs">
              {activeCase.stages.map((stage, idx) => (
                <li key={idx} className="relative">
                  {/* Indicator Dot */}
                  <span
                    className={`absolute -left-[21px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-white ${
                      stage.actionDone
                        ? "bg-teal-700 ring-2 ring-white"
                        : "bg-stone-300 ring-2 ring-white"
                    }`}
                  >
                    {stage.actionDone ? (
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-stone-600" />
                    )}
                  </span>

                  <div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-semibold ${
                          stage.actionDone ? "text-stone-900" : "text-stone-500"
                        }`}
                      >
                        {stage.title}
                      </span>
                      <span className="text-[10px] text-stone-400">{stage.time}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">
                      {stage.description}
                    </p>
                    <span className="mt-1 inline-block rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
                      {stage.badge}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Assigned Human Navigator Badge */}
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-teal-100 bg-teal-50/80 p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-700 text-white">
              <UserCheck className="h-4 w-4" />
            </div>
            <div className="text-xs">
              <div className="font-semibold text-teal-950">
                {activeCase.activeCard.assignedNavigator}
              </div>
              <div className="text-[11px] text-teal-800">
                Available to chat, verify coverage, or step in via phone anytime.
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Active Care Plan Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm lg:col-span-7">
          <div>
            {/* Header info */}
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-800 ring-1 ring-teal-200">
                  <CheckCircle2 className="h-3 w-3 text-teal-700" />
                  {activeCase.activeCard.type}
                </span>
                <h4 className="mt-2 text-lg font-bold text-stone-900">
                  {activeCase.activeCard.provider}
                </h4>
                <p className="text-xs font-medium text-stone-600">
                  {activeCase.activeCard.specialty}
                </p>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900">
                  <ShieldCheck className="h-3 w-3 text-emerald-700" />
                  In-Network Verified
                </span>
                <div className="mt-1 text-[11px] font-semibold text-stone-700">
                  {activeCase.activeCard.copayEstimate}
                </div>
              </div>
            </div>

            {/* Time & Location details */}
            <div className="mt-4 grid grid-cols-1 gap-2.5 rounded-xl bg-stone-50 p-3 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-xs text-stone-700">
                <Calendar className="h-4 w-4 shrink-0 text-teal-700" />
                <span className="font-medium">{activeCase.activeCard.date}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-stone-700">
                <MapPin className="h-4 w-4 shrink-0 text-teal-700" />
                <span className="truncate">{activeCase.activeCard.distance}</span>
              </div>
            </div>

            {/* Logistics & Transit */}
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-teal-100 bg-teal-50/50 px-3 py-2 text-xs text-teal-900">
              <Car className="h-4 w-4 shrink-0 text-teal-700" />
              <span>{activeCase.activeCard.logistics}</span>
            </div>

            {/* Pre-Visit Action Checklist */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-800">
                <span>Personalized Visit Preparation</span>
                <span className="text-[11px] font-normal text-teal-700">Generated by CareLoop</span>
              </div>
              <ul className="mt-2 space-y-2 text-xs text-stone-600">
                {activeCase.activeCard.prepItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-stone-200 text-[10px] font-semibold text-stone-700">
                      {idx + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-6 border-t border-stone-100 pt-4">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-stone-500">
                {slotConfirmed ? (
                  <span className="font-semibold text-emerald-800">
                    Appointment confirmed! Calendar invite &amp; reminders sent.
                  </span>
                ) : (
                  <span>CareLoop holds this time slot and coordinates with the clinic.</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSlotConfirmed(!slotConfirmed)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                    slotConfirmed
                      ? "bg-emerald-700 text-white hover:bg-emerald-800"
                      : "bg-teal-800 text-white hover:bg-teal-900"
                  }`}
                >
                  {slotConfirmed ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Confirmed &amp; Synced</span>
                    </>
                  ) : (
                    <>
                      <span>Lock In This Care Plan</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reassurance Footer */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3 text-[11px] text-stone-500">
        <span className="font-medium text-stone-700">
          Key Differentiation:
        </span>
        <span className="italic text-stone-600">
          &ldquo;CareLoop doesn&apos;t just tell you what to do. It helps you get it done.&rdquo;
        </span>
        <span className="text-teal-800 font-semibold">
          No credit card required to explore
        </span>
      </div>
    </div>
  );
}
