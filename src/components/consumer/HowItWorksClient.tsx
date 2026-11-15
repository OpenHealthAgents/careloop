"use client";

import React, { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  MessageSquare,
  Search,
  FileText,
  Clock,
  ShieldCheck,
  Check,
  AlertCircle,
  Bell,
  RefreshCw,
  Car,
  Pill,
} from "lucide-react";
import { Navigation } from "@/components/design-system/Navigation";
import { Footer } from "@/components/design-system/Footer";
import {
  Badge,
  Button,
  Card,
  H1,
  H2,
  Lead,
  CtaSection,
} from "@/components/design-system";

const USER_INTAKE_EXAMPLES = [
  {
    id: "derma",
    quote: "I need to find a dermatologist.",
    context: "Primary care doctor flagged an irregular skin spot and suggested a specialist.",
    parsedGoal: "Assess skin lesion with in-network dermatologist within 14 days",
    extractedPriorities: ["In-Network (Tier 1 Preferred)", "Within 25 min drive", "Evening appointment preferred"],
    firstAction: "Scanning 4 in-network dermatology clinics for open intake slots",
  },
  {
    id: "discharge",
    quote: "My mom was recently discharged.",
    context: "Discharged on Tuesday after hip surgery with 3 pages of clinical instructions.",
    parsedGoal: "Coordinate post-acute physical therapy, walker delivery, and surgeon checkup",
    extractedPriorities: ["Wheelchair van transit", "Pre-authorization with Medicare Advantage", "Pain medication refill"],
    firstAction: "Care Guide contacting orthopedic rehab clinic to lock in Home Health intake",
  },
  {
    id: "screening",
    quote: "I need to schedule my annual screening.",
    context: "Overdue for routine mammogram and cholesterol panel, but work schedule is packed.",
    parsedGoal: "Bundle annual preventive screenings into a single Saturday morning block",
    extractedPriorities: ["Preventive coverage (100% covered under ACA)", "Saturday intake availability"],
    firstAction: "Locating accredited imaging center with Saturday morning openings",
  },
  {
    id: "confused",
    quote: "I don't understand what happens next.",
    context: "Left the hospital with a lab slip and an unreadable handwritten prescription note.",
    parsedGoal: "Translate hospital discharge papers into an organized step-by-step checklist",
    extractedPriorities: ["Clarify blood panel fasting instructions", "Confirm prescription transfer"],
    firstAction: "Translating clinical notes into 3 clear action tasks for tomorrow morning",
  },
];

export function HowItWorksClient() {
  const [selectedExample, setSelectedExample] = useState(USER_INTAKE_EXAMPLES[0].id);
  const currentExample = USER_INTAKE_EXAMPLES.find((e) => e.id === selectedExample) || USER_INTAKE_EXAMPLES[0];

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF8F5] text-[#191716] selection:bg-[#EBF5F3] selection:text-[#0E6156]">
      <Navigation />

      <main id="main-content" className="flex-1">
        {/* ========================================================================= */}
        {/* HERO SECTION                                                              */}
        {/* ========================================================================= */}
        <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 border-b border-[#E2DDD5]/60 bg-gradient-to-b from-[#FAF8F5] to-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0E6156]/20 bg-[#EBF5F3] px-3.5 py-1 text-xs font-semibold text-[#0E6156]">
                <span>The 4-Step Journey</span>
                <span className="text-[#0E6156]/40">•</span>
                <span className="font-normal text-[#5C5650]">From uncertainty to completed care</span>
              </div>

              <H1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold tracking-[-0.03em] text-[#191716] leading-[1.12]">
                From &ldquo;What do I do?&rdquo;
                <span className="block text-[#5C5650] font-normal mt-1">
                  to &ldquo;It&apos;s done.&rdquo;
                </span>
              </H1>

              <Lead className="text-base sm:text-lg text-[#5C5650] leading-relaxed max-w-2xl mx-auto font-normal">
                CareLoop breaks healthcare down into four calm, manageable phases. No phone tag loops. No guessing what comes next.
              </Lead>

              {/* Progress Flow Ribbon */}
              <div className="pt-2 pb-2">
                <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3 rounded-full border border-[#E2DDD5] bg-white p-2 sm:px-6 sm:py-2.5 shadow-xs text-xs font-semibold text-[#191716]">
                  <span className="flex items-center gap-1.5 text-[#0E6156]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0E6156] text-[10px] text-white font-bold">1</span>
                    UNDERSTAND
                  </span>
                  <ArrowRight className="h-3 w-3 text-[#8A8279]" />
                  <span className="flex items-center gap-1.5 text-[#0E6156]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0E6156] text-[10px] text-white font-bold">2</span>
                    PLAN
                  </span>
                  <ArrowRight className="h-3 w-3 text-[#8A8279]" />
                  <span className="flex items-center gap-1.5 text-[#0E6156]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0E6156] text-[10px] text-white font-bold">3</span>
                    ACT
                  </span>
                  <ArrowRight className="h-3 w-3 text-[#8A8279]" />
                  <span className="flex items-center gap-1.5 text-[#0E6156]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0E6156] text-[10px] text-white font-bold">4</span>
                    FOLLOW THROUGH
                  </span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <Button size="lg" variant="primary" href="/join" rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Join the CareLoop
                </Button>
                <Button size="lg" variant="secondary" href="#step-1">
                  See how it works
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* STEP 1: UNDERSTAND                                                        */}
        {/* ========================================================================= */}
        <section id="step-1" className="py-20 bg-white border-y border-[#E2DDD5]/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left Column: Narrative */}
              <div className="lg:col-span-5 space-y-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0E6156] text-white font-bold text-sm shadow-xs">
                    01
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0E6156]">
                    Step 1: Intake &amp; Context
                  </span>
                </div>

                <H2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#191716]">
                  Understand
                </H2>

                <p className="text-sm sm:text-base text-[#5C5650] leading-relaxed">
                  Healthcare always starts with uncertainty. You receive an intimidating referral, an unexplained test order, or a loved one is discharged with piles of instructions.
                </p>

                <p className="text-sm sm:text-base text-[#5C5650] leading-relaxed">
                  Tell CareLoop what you&apos;re dealing with in simple, everyday language. CareLoop translates medical shorthand, diagnosis codes, and disjointed recommendations into an organized healthcare journey.
                </p>

                {/* Example selection pills */}
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold text-[#191716] uppercase tracking-wider">
                    Try real-world user examples:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {USER_INTAKE_EXAMPLES.map((ex) => (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => setSelectedExample(ex.id)}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                          selectedExample === ex.id
                            ? "bg-[#0E6156] text-white shadow-soft"
                            : "bg-[#FAF8F5] text-[#5C5650] border border-[#E2DDD5] hover:bg-white hover:text-[#191716]"
                        }`}
                      >
                        &ldquo;{ex.quote}&rdquo;
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Visual Product Transformation */}
              <div className="lg:col-span-7">
                <Card variant="elevated" padding="lg" className="border-[#0E6156]/20 bg-[#FAF8F5] shadow-elevated">
                  {/* Top Bar: Simulated User Prompt */}
                  <div className="rounded-2xl border border-[#E2DDD5] bg-white p-4 shadow-2xs space-y-2 mb-6">
                    <div className="flex items-center justify-between text-[11px] text-[#8A8279]">
                      <span className="font-semibold text-[#0E6156] flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        User Input
                      </span>
                      <span>Spoken or typed in seconds</span>
                    </div>
                    <p className="text-base sm:text-lg font-bold text-[#191716]">
                      &ldquo;{currentExample.quote}&rdquo;
                    </p>
                    <p className="text-xs text-[#5C5650] italic">
                      Context: {currentExample.context}
                    </p>
                  </div>

                  {/* Transformation Arrow */}
                  <div className="flex items-center justify-center my-3 text-xs text-[#0E6156] font-semibold gap-2">
                    <Sparkles className="h-4 w-4" />
                    <span>CareLoop translates into an actionable journey</span>
                  </div>

                  {/* Parsed Journey Card */}
                  <div className="rounded-2xl border-2 border-[#0E6156] bg-white p-5 shadow-soft space-y-4">
                    <div className="flex items-center justify-between border-b border-[#E2DDD5]/70 pb-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#0E6156]">
                        Parsed Journey Objective
                      </span>
                      <Badge variant="brand" size="sm">Active Loop</Badge>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-[#191716]">Primary Goal</h4>
                      <p className="text-xs sm:text-sm text-[#0E6156] font-medium mt-0.5">
                        {currentExample.parsedGoal}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-[#5C5650] uppercase tracking-wide">
                        Extracted Priorities
                      </h4>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {currentExample.extractedPriorities.map((pri, pIdx) => (
                          <span
                            key={pIdx}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#C8E4DE] bg-[#EBF5F3] px-2.5 py-1 text-xs font-medium text-[#0E6156]"
                          >
                            <Check className="h-3 w-3 text-[#0E6156]" />
                            {pri}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-[#FFFDF9] p-3 text-xs text-[#191716] flex items-start gap-2.5">
                      <Clock className="h-4 w-4 text-[#C87D2A] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[#C87D2A]">Immediate Next Action: </span>
                        <span>{currentExample.firstAction}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* STEP 2: PLAN                                                              */}
        {/* ========================================================================= */}
        <section id="step-2" className="py-20 bg-[#FAF8F5]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left Column: Rich Product Visualization */}
              <div className="lg:col-span-7 order-2 lg:order-1">
                <Card variant="elevated" padding="xl" className="border-[#E2DDD5] bg-white shadow-elevated">
                  <div className="flex items-center justify-between pb-4 border-b border-[#E2DDD5]/70 mb-5">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#0E6156]">
                        Personalized Plan
                      </span>
                      <h3 className="text-lg font-bold text-[#191716]">Dermatology Evaluation Plan</h3>
                    </div>
                    <Badge variant="accent" size="sm">Timeline: 14 Days</Badge>
                  </div>

                  {/* 6 Plan Components Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {/* 1. Goals */}
                    <div className="rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] p-3.5 space-y-1">
                      <span className="font-bold text-[#0E6156] uppercase text-[10px] tracking-wider">01. Goals</span>
                      <p className="font-bold text-[#191716]">Rule out melanoma &amp; biopsy</p>
                      <p className="text-[#5C5650] text-[11px]">Comprehensive dermatoscope check of flagged lesion</p>
                    </div>

                    {/* 2. Priorities */}
                    <div className="rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] p-3.5 space-y-1">
                      <span className="font-bold text-[#0E6156] uppercase text-[10px] tracking-wider">02. Priorities</span>
                      <p className="font-bold text-[#191716]">100% In-Network Coverage</p>
                      <p className="text-[#5C5650] text-[11px]">Cross-checked with Blue Cross PPO Tier 1 directory</p>
                    </div>

                    {/* 3. Next Steps */}
                    <div className="rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] p-3.5 space-y-1">
                      <span className="font-bold text-[#0E6156] uppercase text-[10px] tracking-wider">03. Next Steps</span>
                      <p className="font-bold text-[#191716]">Match top 3 providers</p>
                      <p className="text-[#5C5650] text-[11px]">Compare drive times, ratings, and open schedule slots</p>
                    </div>

                    {/* 4. Questions */}
                    <div className="rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] p-3.5 space-y-1">
                      <span className="font-bold text-[#0E6156] uppercase text-[10px] tracking-wider">04. Questions</span>
                      <p className="font-bold text-[#191716]">3 visit briefing questions</p>
                      <p className="text-[#5C5650] text-[11px]">Generated questions to ask specialist regarding margins</p>
                    </div>

                    {/* 5. Appointments */}
                    <div className="rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] p-3.5 space-y-1">
                      <span className="font-bold text-[#0E6156] uppercase text-[10px] tracking-wider">05. Appointments</span>
                      <p className="font-bold text-[#191716]">Hold Thursday 10:30 AM</p>
                      <p className="text-[#5C5650] text-[11px]">Preliminary intake hold aligned with your personal calendar</p>
                    </div>

                    {/* 6. Tasks */}
                    <div className="rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] p-3.5 space-y-1">
                      <span className="font-bold text-[#0E6156] uppercase text-[10px] tracking-wider">06. Tasks</span>
                      <p className="font-bold text-[#191716]">Upload past biopsy record</p>
                      <p className="text-[#5C5650] text-[11px]">Ensure clinic receives records prior to your arrival</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Right Column: Narrative */}
              <div className="lg:col-span-5 order-1 lg:order-2 space-y-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0E6156] text-white font-bold text-sm shadow-xs">
                    02
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0E6156]">
                    Step 2: Architecture
                  </span>
                </div>

                <H2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#191716]">
                  Plan
                </H2>

                <p className="text-sm sm:text-base text-[#5C5650] leading-relaxed">
                  CareLoop analyzes your insurance network, calendar constraints, and care instructions to generate a customized roadmap.
                </p>

                <p className="text-sm sm:text-base text-[#5C5650] leading-relaxed">
                  Instead of staring at a blank calendar wondering who to call, you receive a transparent breakdown of:
                </p>

                <ul className="space-y-2.5 text-xs sm:text-sm text-[#191716]">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#0E6156]" />
                    <span><strong>Goals:</strong> What does completed care look like?</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#0E6156]" />
                    <span><strong>Priorities:</strong> Minimizing out-of-pocket costs and travel distances.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#0E6156]" />
                    <span><strong>Next steps:</strong> Ordered logically so no prerequisites are missed.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#0E6156]" />
                    <span><strong>Questions:</strong> Exact talking points for your doctor.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#0E6156]" />
                    <span><strong>Appointments &amp; Tasks:</strong> Hard dates, confirmations, and checklists.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* STEP 3: ACT                                                               */}
        {/* ========================================================================= */}
        <section id="step-3" className="py-20 bg-white border-y border-[#E2DDD5]/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left Column: Narrative */}
              <div className="lg:col-span-5 space-y-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0E6156] text-white font-bold text-sm shadow-xs">
                    03
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0E6156]">
                    Step 3: Real Execution
                  </span>
                </div>

                <H2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#191716]">
                  Act
                </H2>

                <p className="text-sm sm:text-base text-[#5C5650] leading-relaxed">
                  This is where CareLoop fundamentally separates from generic advice sites and chatbots. We don&apos;t leave you holding the phone.
                </p>

                <p className="text-sm sm:text-base text-[#5C5650] leading-relaxed">
                  CareLoop provides practical, hands-on execution across every operational detail:
                </p>

                <div className="space-y-3 text-xs sm:text-sm text-[#191716]">
                  <div className="flex items-start gap-3 rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] p-3">
                    <Search className="h-4 w-4 text-[#0E6156] shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-[#191716]">Finding Providers</strong>
                      <span className="text-[#5C5650]">Verifies live insurance network tiers and open patient slots.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] p-3">
                    <FileText className="h-4 w-4 text-[#0E6156] shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-[#191716]">Preparing for Appointments</strong>
                      <span className="text-[#5C5650]">Generates your tailored pre-visit briefing with questions to ask.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] p-3">
                    <ShieldCheck className="h-4 w-4 text-[#0E6156] shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-[#191716]">Organizing Information</strong>
                      <span className="text-[#5C5650]">Centralizes referrals, insurance cards, and past records in one place.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] p-3">
                    <CheckCircle2 className="h-4 w-4 text-[#0E6156] shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-[#191716]">Tracking Tasks &amp; Logistics</strong>
                      <span className="text-[#5C5650]">Syncs confirmed times to your calendar and arranges transport if needed.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Execution in Flight Visual */}
              <div className="lg:col-span-7">
                <div className="rounded-3xl border border-[#E2DDD5] bg-[#FAF8F5] p-6 sm:p-8 shadow-elevated space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#E2DDD5]/70 text-xs">
                    <span className="font-bold text-[#0E6156] uppercase tracking-wider">Live Execution In Flight</span>
                    <Badge variant="brand" size="sm">Coordinating</Badge>
                  </div>

                  {/* Task 1: Appointment Booked */}
                  <div className="rounded-2xl border border-[#C8E4DE] bg-white p-4 space-y-2 text-xs shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-[#0E6156]" />
                        <span className="font-bold text-[#191716]">Appointment Confirmed</span>
                      </div>
                      <span className="text-[11px] font-semibold text-[#0E6156]">Thursday, 10:30 AM</span>
                    </div>
                    <p className="text-[#5C5650]">Dr. Marcus Vance, MD • Advanced Dermatology Associates</p>
                    <div className="flex items-center gap-3 text-[11px] text-[#8A8279] pt-1 border-t border-[#E2DDD5]/60">
                      <span>✓ In-Network verified</span>
                      <span>✓ Calendar synced</span>
                      <span>✓ Pre-auth approved</span>
                    </div>
                  </div>

                  {/* Task 2: Briefing Prepared */}
                  <div className="rounded-2xl border border-[#E2DDD5] bg-white p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#0E6156]" />
                        <span className="font-bold text-[#191716]">Pre-Visit Briefing Generated</span>
                      </div>
                      <Badge variant="accent" size="sm">Ready</Badge>
                    </div>
                    <p className="text-[#5C5650]">3 curated clinical questions prepared for your consultation.</p>
                  </div>

                  {/* Task 3: Transit Logistics Coordinated */}
                  <div className="rounded-2xl border border-[#E2DDD5] bg-white p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-[#0E6156]" />
                        <span className="font-bold text-[#191716]">Logistics &amp; Parking</span>
                      </div>
                      <span className="text-[11px] text-[#5C5650]">Directions verified</span>
                    </div>
                    <p className="text-[#5C5650]">Garage validated parking info &amp; transit reminder scheduled for 9:45 AM.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* STEP 4: FOLLOW THROUGH                                                    */}
        {/* ========================================================================= */}
        <section id="step-4" className="py-20 bg-[#FAF8F5]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left Column: Closed Loop Visual */}
              <div className="lg:col-span-7 order-2 lg:order-1">
                <Card variant="elevated" padding="xl" className="border-[#E2DDD5] bg-white shadow-elevated space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-[#E2DDD5]/70">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#C87D2A]">
                        Closed-Loop Tracking
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-[#191716]">Post-Visit Follow-Through</h3>
                    </div>
                    <Badge variant="success" size="sm">Care Completed</Badge>
                  </div>

                  <div className="space-y-3 text-xs">
                    {/* Item 1: Reminder */}
                    <div className="flex items-start gap-3 rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] p-3.5">
                      <Bell className="h-4 w-4 text-[#0E6156] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[#191716]">Reminders &amp; Prep Briefing Delivered</span>
                        <p className="text-[#5C5650] mt-0.5">Patient attended visit on time with prepared questions.</p>
                      </div>
                    </div>

                    {/* Item 2: Post-Visit Follow-up */}
                    <div className="flex items-start gap-3 rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] p-3.5">
                      <FileText className="h-4 w-4 text-[#0E6156] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[#191716]">Doctor Visit Summary Translated</span>
                        <p className="text-[#5C5650] mt-0.5">Biopsy was performed. Pathology results expected in 5 business days.</p>
                      </div>
                    </div>

                    {/* Item 3: Missed Appointment Fallback */}
                    <div className="flex items-start gap-3 rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] p-3.5">
                      <RefreshCw className="h-4 w-4 text-[#0E6156] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[#191716]">Reschedule Protection</span>
                        <p className="text-[#5C5650] mt-0.5">If a clinic cancels or reschedules, CareLoop automatically finds the next open slot.</p>
                      </div>
                    </div>

                    {/* Item 4: Outstanding Tasks */}
                    <div className="flex items-start gap-3 rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] p-3.5">
                      <Pill className="h-4 w-4 text-[#C87D2A] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[#191716]">Medication &amp; Next Action Scheduled</span>
                        <p className="text-[#5C5650] mt-0.5">Topical ointment sent to pharmacy; 6-month annual follow-up saved to timeline.</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#E2DDD5]/70 flex items-center justify-between text-xs text-[#0E6156] font-bold">
                    <span>Care Loop Status: 100% Completed</span>
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </Card>
              </div>

              {/* Right Column: Narrative */}
              <div className="lg:col-span-5 order-1 lg:order-2 space-y-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#C87D2A] text-white font-bold text-sm shadow-xs">
                    04
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#C87D2A]">
                    Step 4: Accountability
                  </span>
                </div>

                <H2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#191716]">
                  Follow through
                </H2>

                <p className="text-sm sm:text-base text-[#5C5650] leading-relaxed">
                  Most healthcare interactions break down after the appointment. People forget to schedule follow-up labs, forget to pick up prescriptions, or clinic notes sit unread.
                </p>

                <p className="text-sm sm:text-base text-[#5C5650] leading-relaxed">
                  CareLoop stays with you until the task is actually finished:
                </p>

                <ul className="space-y-2.5 text-xs sm:text-sm text-[#191716]">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#C87D2A]" />
                    <span><strong>Reminders:</strong> Timely nudges before your appointment.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#C87D2A]" />
                    <span><strong>Follow-ups:</strong> Translating visit notes into immediate next steps.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#C87D2A]" />
                    <span><strong>Missed appointments:</strong> Swift rebooking if an appointment is interrupted.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#C87D2A]" />
                    <span><strong>Outstanding tasks:</strong> Ensuring blood tests and refills are completed.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#C87D2A]" />
                    <span><strong>Progress tracking:</strong> Closing the loop on your health record.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* DIFFERENTIATOR SECTION                                                    */}
        {/* ========================================================================= */}
        <section className="py-24 bg-white border-y border-[#E2DDD5]/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl text-center space-y-6 mb-16">
              <Badge variant="accent" className="mb-2">
                Why CareLoop Is Different
              </Badge>
              <H2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#191716] leading-tight">
                Most healthcare tools stop at information.<br />
                <span className="text-[#0E6156]">CareLoop stays with you through action.</span>
              </H2>
            </div>

            {/* Large Visual Comparison Block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Information Column */}
              <div className="rounded-3xl border border-rose-200 bg-[#FFFBFB] p-8 sm:p-10 shadow-soft space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Information Without Action</span>
                </div>

                <div className="rounded-2xl border border-rose-200 bg-white p-5 text-base sm:text-lg font-bold text-[#191716] italic">
                  &ldquo;Here&apos;s what you should do.&rdquo;
                </div>

                <ul className="space-y-4 text-xs sm:text-sm text-[#5C5650]">
                  <li className="flex items-start gap-3">
                    <span className="font-bold text-rose-600 mt-0.5">✕</span>
                    <span>Hands you an article or a directory list of 40 doctor names.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="font-bold text-rose-600 mt-0.5">✕</span>
                    <span>Leaves you to call every clinic to ask if they take your insurance.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="font-bold text-rose-600 mt-0.5">✕</span>
                    <span>No pre-visit preparation or customized questions for your doctor.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="font-bold text-rose-600 mt-0.5">✕</span>
                    <span>Disappears the moment you leave the search page.</span>
                  </li>
                </ul>
              </div>

              {/* CareLoop Column */}
              <div className="rounded-3xl border-2 border-[#0E6156] bg-white p-8 sm:p-10 shadow-elevated space-y-6 relative">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#EBF5F3] px-3 py-1 text-xs font-bold text-[#0E6156]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>The CareLoop Execution Partner</span>
                </div>

                <div className="rounded-2xl border border-[#C8E4DE] bg-[#EBF5F3]/50 p-5 text-base sm:text-lg font-bold text-[#0E6156]">
                  &ldquo;Here&apos;s what to do next — and we&apos;ll help you follow through.&rdquo;
                </div>

                <ul className="space-y-4 text-xs sm:text-sm text-[#191716]">
                  <li className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-[#0E6156] shrink-0 mt-0.5" />
                    <span>Cross-references live insurance network directories to guarantee in-network status.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-[#0E6156] shrink-0 mt-0.5" />
                    <span>Coordinates appointment scheduling to match your work and family calendar.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-[#0E6156] shrink-0 mt-0.5" />
                    <span>Generates tailored pre-visit briefing checklists so you arrive prepared.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-[#0E6156] shrink-0 mt-0.5" />
                    <span>Follows through until lab results, prescriptions, and follow-ups are finished.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* END CTA                                                                   */}
        {/* ========================================================================= */}
        <CtaSection
          variant="brandDark"
          badge="Start Your Journey"
          title="Ready for a clearer healthcare journey?"
          description="Join CareLoop today. Tell us what care you need, and we will guide you from 'What do I do?' to 'It's done.'"
          primaryCtaText="Join the CareLoop"
          primaryCtaHref="/join"
          secondaryCtaText="Explore For Families"
          secondaryCtaHref="/for-families"
        />
      </main>

      <Footer />
    </div>
  );
}
