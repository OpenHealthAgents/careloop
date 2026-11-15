"use client";

import React, { useState } from "react";
import {
  FileText,
  Compass,
  CalendarCheck,
  BellRing,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface JourneyStep {
  number: string;
  name: string;
  tagline: string;
  emotionalShift: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  whatCareLoopDoes: string[];
  whatYouExperience: string;
  artifactTitle: string;
  artifactSnippet: {
    label: string;
    value: string;
    badge?: string;
  }[];
}

const JOURNEY_STEPS: JourneyStep[] = [
  {
    number: "01",
    name: "UNDERSTAND",
    tagline: "Decode doctor notes, referrals, and next steps into plain English.",
    emotionalShift: "Overwhelmed → Clear",
    icon: FileText,
    description:
      "When a doctor hands you a referral slip or discharges you with clinic notes, medical terminology can be cryptic and intimidating. CareLoop decodes what was ordered, why it was ordered, and what timeline is clinically recommended.",
    whatCareLoopDoes: [
      "Parses complex referral notes, ICD codes, and orders into conversational English",
      "Clarifies urgency (e.g. within 2 weeks vs. routine quarterly monitoring)",
      "Explains why the care matters for your long-term health and symptoms",
      "Confirms health plan coverage and baseline referral requirements",
    ],
    whatYouExperience:
      "No more frantically Googling medical acronyms or wondering what your doctor meant. You get a calm, clear 2-minute summary of exactly what care you need and why.",
    artifactTitle: "CareLoop Plain-Language Breakdown",
    artifactSnippet: [
      { label: "Order Decoded", value: "Neurology consultation for recurring migraine with aura" },
      { label: "Clinical Urgency", value: "Recommended within 14–21 days to prevent symptom flare", badge: "Priority" },
      { label: "Goal of Care", value: "Evaluate preventive therapy & verify cervical spine alignment" },
    ],
  },
  {
    number: "02",
    name: "DECIDE",
    tagline: "Evaluate verified in-network providers, availability, and costs.",
    emotionalShift: "Uncertain → Confident",
    icon: Compass,
    description:
      "Finding a doctor shouldn't mean scrolling through an outdated 200-page insurer PDF and dialing disconnected numbers. CareLoop compares real in-network providers, verifies their active patient intake status, and estimates out-of-pocket costs.",
    whatCareLoopDoes: [
      "Cross-references your specific insurance plan network tier",
      "Filters for sub-specialty expertise (e.g., adult headache medicine vs. general neurology)",
      "Verifies real-time calendar availability within your preferred radius",
      "Estimates copays or deductible impact so there are zero surprises",
    ],
    whatYouExperience:
      "You review a shortlist of 2–3 vetted doctors who actually have openings, take your insurance, and meet your schedule preferences.",
    artifactTitle: "Verified Provider Match Card",
    artifactSnippet: [
      { label: "Matched Provider", value: "Dr. Andrea Chen, MD, FAAN • 3.8 miles away" },
      { label: "Availability", value: "Earliest opening: Next Tuesday, Nov 18 • 10:30 AM", badge: "Verified Slot" },
      { label: "Cost Estimate", value: "$30 specialist copay (Tier 1 Preferred Network)" },
    ],
  },
  {
    number: "03",
    name: "ACT",
    tagline: "From plan to secured appointment without phone tag.",
    emotionalShift: "Stuck → Moving",
    icon: CalendarCheck,
    description:
      "Here is where the traditional system breaks down: making the appointment. CareLoop coordinates directly with clinic scheduling teams, handles prior authorizations, and resolves transit or intake form barriers.",
    whatCareLoopDoes: [
      "Coordinates appointment slots directly with provider front desks",
      "Tracks and accelerates insurance prior authorization approvals",
      "Sends digital pre-registration intake paperwork ahead of time",
      "Arranges accessible transit rides or translation services if needed",
    ],
    whatYouExperience:
      "Instead of waiting on hold during work, you receive a confirmed calendar booking, directions, and pre-completed intake slips.",
    artifactTitle: "Confirmed Care Booking",
    artifactSnippet: [
      { label: "Appointment Status", value: "Confirmed with Valley Medical Pavilion Desk", badge: "Active Booking" },
      { label: "Prior Auth Status", value: "Approved by Blue Shield • Ref #AUTH-90241" },
      { label: "Logistics", value: "Return rideshare voucher pre-loaded in CareLoop" },
    ],
  },
  {
    number: "04",
    name: "FOLLOW THROUGH",
    tagline: "Preparation, checklists, and personalized reminders.",
    emotionalShift: "Anxious → Prepared",
    icon: BellRing,
    description:
      "Up to 30% of specialist visits fail because patients arrive missing prior records, fasting requirements, or feel unprepared to talk to the doctor. CareLoop delivers proactive preparation so you make the most of every minute.",
    whatCareLoopDoes: [
      "Prepares a tailored 3–4 question prompt list to ask your doctor",
      "Reminds you of clinical prep requirements (e.g., fasting, bringing imaging scans)",
      "Sends timely calendar alerts and turn-by-turn clinic arrival directions",
      "Human navigator on call for last-minute rescheduling or questions",
    ],
    whatYouExperience:
      "You walk into the clinic feeling confident, organized, and equipped with the exact questions that matter to your care.",
    artifactTitle: "Personalized Visit Prep Checklist",
    artifactSnippet: [
      { label: "Records Check", value: "Previous cervical spine MRI disc verified on file" },
      { label: "Doctor Question #1", value: "'Are newer CGRP receptor antagonists suitable for me?'" },
      { label: "Check-in Alert", value: "Arrival reminder scheduled for 10:00 AM (30 min early)" },
    ],
  },
  {
    number: "05",
    name: "COMPLETE CARE",
    tagline: "Close the loop, track prescriptions, and advance your recovery.",
    emotionalShift: "Fragmented → Complete",
    icon: CheckCircle2,
    description:
      "The visit is not the finish line — it is the start of execution. CareLoop checks in after your appointment, captures the doctor's plan, tracks prescription fulfillment, and ensures follow-up physical therapy or diagnostic scans happen.",
    whatCareLoopDoes: [
      "Prompts for visit debrief: Did you see the doctor? What were next steps?",
      "Tracks electronic prescription fills and pharmacy availability",
      "Coordinates secondary referrals (e.g. physical therapy or follow-up bloodwork)",
      "Syncs completion back to your primary care team for continuity of care",
    ],
    whatYouExperience:
      "You feel fully supported from start to finish. Nothing slips through the cracks, and your health journey keeps moving forward.",
    artifactTitle: "Care Loop Completion Record",
    artifactSnippet: [
      { label: "Visit Verified", value: "Specialist consultation successfully completed", badge: "Closed Loop" },
      { label: "Prescription Sync", value: "Preventive medication filled at Walgreens • Ready for pickup" },
      { label: "Next Milestone", value: "Physical therapy intake scheduled for next Monday" },
    ],
  },
];

export function JourneySection() {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const activeStep = JOURNEY_STEPS[activeStepIndex];

  return (
    <section id="journey" className="relative bg-stone-50 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-900">
            The CareLoop Journey
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
            From Recommendation to Completed Care
          </h2>
          <p className="mt-4 text-base leading-relaxed text-stone-600 sm:text-lg">
            CareLoop guides you through five clear, supportive stages. We don&apos;t just tell
            you what needs to happen — we partner with you to make sure it gets completed.
          </p>

          {/* Stepper Pills on Desktop */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {JOURNEY_STEPS.map((step, idx) => {
              const isActive = activeStepIndex === idx;
              return (
                <button
                  key={step.number}
                  type="button"
                  onClick={() => setActiveStepIndex(idx)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-teal-800 text-white shadow-md ring-2 ring-teal-700/50"
                      : "bg-white text-stone-700 hover:bg-stone-100 border border-stone-200"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                      isActive ? "bg-teal-900 text-teal-200" : "bg-stone-200 text-stone-700"
                    }`}
                  >
                    {step.number}
                  </span>
                  <span>{step.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Stage Detailed Card */}
        <div className="mt-12 overflow-hidden rounded-3xl border border-stone-200/90 bg-white p-6 shadow-md sm:p-10">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left Column: Stage description & actions */}
            <div className="space-y-6 lg:col-span-7">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-teal-50 p-2.5 text-teal-800 ring-1 ring-teal-200">
                  {React.createElement(activeStep.icon, { className: "h-6 w-6" })}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
                      Step {activeStep.number} of 05
                    </span>
                    <span className="text-stone-300">•</span>
                    <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
                      {activeStep.emotionalShift}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-stone-900 sm:text-3xl">
                    {activeStep.name}
                  </h3>
                </div>
              </div>

              <p className="text-base font-medium text-stone-800 sm:text-lg">
                &ldquo;{activeStep.tagline}&rdquo;
              </p>

              <p className="text-sm leading-relaxed text-stone-600">
                {activeStep.description}
              </p>

              {/* What CareLoop does */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  What CareLoop coordinates for you
                </h4>
                <ul className="mt-3 space-y-2.5 text-xs text-stone-700">
                  {activeStep.whatCareLoopDoes.map((action, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* What You Experience */}
              <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4 text-xs text-stone-700">
                <span className="font-semibold text-teal-950">How this feels: </span>
                <span>{activeStep.whatYouExperience}</span>
              </div>
            </div>

            {/* Right Column: Live Artifact Mockup */}
            <div className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-stone-50/70 p-5 lg:col-span-5">
              <div>
                <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                    Live Care Artifact
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                    <Sparkles className="h-3 w-3" />
                    Automated &amp; Guarded
                  </span>
                </div>

                <h4 className="mt-4 text-base font-bold text-stone-900">
                  {activeStep.artifactTitle}
                </h4>

                <div className="mt-4 space-y-3">
                  {activeStep.artifactSnippet.map((row, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-stone-200/90 bg-white p-3 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-stone-500">
                          {row.label}
                        </span>
                        {row.badge && (
                          <span className="rounded-md bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800">
                            {row.badge}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-stone-900">
                        {row.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step Navigation Controls */}
              <div className="mt-6 flex items-center justify-between border-t border-stone-200 pt-4 text-xs">
                <button
                  type="button"
                  disabled={activeStepIndex === 0}
                  onClick={() => setActiveStepIndex((prev) => Math.max(0, prev - 1))}
                  className="rounded-lg px-3 py-1.5 font-medium text-stone-600 hover:bg-stone-200 disabled:opacity-40"
                >
                  ← Previous Step
                </button>

                <span className="text-stone-400">
                  {activeStepIndex + 1} of {JOURNEY_STEPS.length}
                </span>

                <button
                  type="button"
                  disabled={activeStepIndex === JOURNEY_STEPS.length - 1}
                  onClick={() =>
                    setActiveStepIndex((prev) => Math.min(JOURNEY_STEPS.length - 1, prev + 1))
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-teal-800 px-3 py-1.5 font-medium text-white hover:bg-teal-900 disabled:opacity-40"
                >
                  <span>Next Step</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
