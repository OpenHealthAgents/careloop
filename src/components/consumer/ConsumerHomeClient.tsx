"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Calendar,
  Check,
  Shield,
  Users,
  Clock,
  Sparkles,
  ChevronRight,
  Stethoscope,
  Heart,
  FileText,
} from "lucide-react";
import { Navigation } from "@/components/design-system/Navigation";
import { Footer } from "@/components/design-system/Footer";
import { Button, MobileStickyCta } from "@/components/design-system";
import { CareAssessmentModal } from "./CareAssessmentModal";
import { ProductMockupViewer } from "@/components/product-mockups/ProductMockupViewer";

export function ConsumerHomeClient() {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialAudience, setInitialAudience] = useState("SELF");

  function handleOpenModal(audience: string = "SELF") {
    setInitialAudience(audience);
    setModalOpen(true);
  }

  function handleCloseModal() {
    setModalOpen(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF8F5] text-[#191716] antialiased selection:bg-[#EBF5F3] selection:text-[#0E6156]">
      {/* Primary Navigation */}
      <Navigation
        primaryCtaText="Join the CareLoop"
        primaryCtaHref="/join"
        onPrimaryCtaClick={() => handleOpenModal("SELF")}
      />

      <main id="main-content" className="flex-1">
        {/* ========================================================================= */}
        {/* 1. HERO SECTION: EDITORIAL, CONFIDENT, IMMEDIATE                          */}
        {/* ========================================================================= */}
        <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 lg:pt-28 lg:pb-32 border-b border-[#E2DDD5]/60 bg-gradient-to-b from-[#FAF8F5] via-[#FAF8F5] to-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              {/* Left Column: Positioning & Clear Promise */}
              <div className="lg:col-span-6 space-y-6 text-left">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#0E6156]/20 bg-[#EBF5F3] px-3.5 py-1 text-xs font-semibold text-[#0E6156]">
                  <span>Healthcare Follow-Through</span>
                  <span className="text-[#0E6156]/40">•</span>
                  <span className="font-normal text-[#5C5650]">From referral to completed visit</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold tracking-[-0.03em] text-[#191716] leading-[1.1]">
                  Healthcare has too many steps.
                  <span className="block font-normal text-[#5C5650] mt-1.5">
                    We make sure the next one actually happens.
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-[#5C5650] leading-relaxed max-w-xl font-normal">
                  When a doctor gives you a referral, an order, or a new care plan, the hardest part is everything in between. CareLoop handles the calls, finds verified in-network doctors, prepares your questions, and stays with you until care is finished.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                  <Button
                    size="lg"
                    variant="primary"
                    onClick={() => handleOpenModal("SELF")}
                    rightIcon={<ArrowRight className="h-4 w-4" />}
                    className="w-full sm:w-auto font-medium text-sm px-7 py-3.5 shadow-sm hover:shadow"
                  >
                    Join the CareLoop
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    href="/how-it-works"
                    className="w-full sm:w-auto text-sm px-6 py-3.5 border border-[#E2DDD5]"
                  >
                    See how it works
                  </Button>
                </div>

                {/* Grounded, factual reassurances */}
                <div className="pt-4 border-t border-[#E2DDD5]/50 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-[#5C5650]">
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-[#0E6156]" />
                    In-network verified before you book
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-[#0E6156]" />
                    Always non-diagnostic
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-[#0E6156]" />
                    Your health data is never sold
                  </span>
                </div>
              </div>

              {/* Right Column: Hero Product Visual — Real Care Journey in Motion */}
              <div className="lg:col-span-6">
                <div className="rounded-3xl border border-[#E2DDD5] bg-white p-6 sm:p-7 shadow-elevated">
                  {/* Card Header: Real Patient Loop */}
                  <div className="flex items-center justify-between pb-5 border-b border-[#E2DDD5]/70">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EBF5F3] text-[#0E6156] font-bold text-xs">
                        CL
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#0E6156]">
                          Active Care Journey
                        </div>
                        <div className="text-base font-bold text-[#191716]">
                          Cardiology Specialist Referral
                        </div>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#EBF5F3] px-3 py-1 text-xs font-semibold text-[#0E6156]">
                      Step 3 of 5
                    </span>
                  </div>

                  {/* 5-Step Progress Bar */}
                  <div className="pt-4 pb-2">
                    <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-semibold text-[#8A8279]">
                      <div className="border-b-2 border-[#0E6156] pb-1 text-[#0E6156]">1. Understand ✓</div>
                      <div className="border-b-2 border-[#0E6156] pb-1 text-[#0E6156]">2. Choose ✓</div>
                      <div className="border-b-2 border-[#0E6156] pb-1 text-[#0E6156]">3. Schedule ●</div>
                      <div className="border-b-2 border-[#E2DDD5] pb-1">4. Prepare</div>
                      <div className="border-b-2 border-[#E2DDD5] pb-1">5. Follow-up</div>
                    </div>
                  </div>

                  {/* Primary Focus Card: The Next Step */}
                  <div className="mt-4 rounded-2xl border-2 border-[#0E6156] bg-[#FAF8F5] p-4.5 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold uppercase tracking-wider text-[#0E6156]">
                        Action Confirmed
                      </span>
                      <span className="text-[#5C5650]">Copay: $35 verified</span>
                    </div>

                    <div>
                      <div className="text-sm font-bold text-[#191716]">
                        Dr. Sarah Lin, MD • Bay Area Cardiovascular
                      </div>
                      <p className="text-xs text-[#5C5650] mt-0.5">
                        In-network with Blue Cross PPO • 15 minutes from home
                      </p>
                    </div>

                    <div className="rounded-xl bg-white border border-[#E2DDD5] p-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-[#191716] font-medium">
                        <Calendar className="h-4 w-4 text-[#0E6156]" />
                        <span>Thursday, Nov 19 at 10:15 AM</span>
                      </div>
                      <span className="text-[11px] font-semibold text-[#0E6156]">Added to Calendar</span>
                    </div>
                  </div>

                  {/* Upcoming: Question Preparation */}
                  <div className="mt-3 rounded-xl border border-[#E2DDD5]/70 bg-white p-3.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-4 w-4 text-[#8A8279]" />
                      <div>
                        <p className="font-semibold text-[#191716]">Next: 3 Questions for Dr. Lin</p>
                        <p className="text-[11px] text-[#8A8279]">Review your personalized visit checklist</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-[#8A8279]">Ready for visit</span>
                  </div>

                  {/* Human Navigator Annotation */}
                  <div className="mt-4 pt-3 border-t border-[#E2DDD5]/60 flex items-center justify-between text-[11px] text-[#5C5650]">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#0E6156]" />
                      <span>Care Guide Elena R. verified clinic intake &amp; confirmed appointment</span>
                    </div>
                    <span className="font-semibold text-[#0E6156]">Complete</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 2. THE FUNDAMENTAL OBSERVATION: ADVICE VS. ACTION                         */}
        {/* ========================================================================= */}
        <section className="py-20 sm:py-28 bg-white border-b border-[#E2DDD5]/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#0E6156]">
                The Gap in Healthcare
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold tracking-[-0.02em] text-[#191716] leading-tight">
                Knowing what care you need isn&apos;t the problem.
                <span className="block text-[#5C5650] font-normal mt-1">
                  Getting from the recommendation to the visit is.
                </span>
              </h2>
              <p className="text-base text-[#5C5650] leading-relaxed">
                Healthcare produces endless instructions, portal messages, and paper slips. But the moment you leave the clinic, execution is left entirely to you.
              </p>
            </div>

            {/* Side-by-Side: Without CareLoop vs. With CareLoop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Card 1: What happens today */}
              <div className="rounded-3xl border border-[#E2DDD5] bg-[#FAF8F5] p-8 sm:p-10 space-y-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8A8279]">
                    Without CareLoop
                  </span>
                  <h3 className="text-xl font-bold text-[#191716] mt-1">
                    The referral that disappears
                  </h3>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E2DDD5] text-sm text-[#5C5650] italic">
                  &ldquo;Your doctor says: &lsquo;Someone from the specialist clinic will call you to schedule.&rsquo;&rdquo;
                </div>

                <ul className="space-y-3.5 text-sm text-[#5C5650]">
                  <li className="flex items-start gap-3">
                    <span className="text-rose-500 font-bold shrink-0 mt-0.5">✕</span>
                    <span>Two weeks pass. Nobody calls. You wonder if the referral was even sent.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-rose-500 font-bold shrink-0 mt-0.5">✕</span>
                    <span>You try calling during work hours. You wait on hold for 25 minutes or hit voicemail.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-rose-500 font-bold shrink-0 mt-0.5">✕</span>
                    <span>You don&apos;t know if they take your specific insurance tier or if prior authorization is needed.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-rose-500 font-bold shrink-0 mt-0.5">✕</span>
                    <span>Over 40% of referrals are abandoned simply because navigating the phone tag is exhausting.</span>
                  </li>
                </ul>
              </div>

              {/* Card 2: With CareLoop */}
              <div className="rounded-3xl border-2 border-[#0E6156] bg-white p-8 sm:p-10 space-y-6 shadow-sm">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0E6156]">
                    With CareLoop
                  </span>
                  <h3 className="text-xl font-bold text-[#191716] mt-1">
                    Continuous follow-through
                  </h3>
                </div>

                <div className="p-4 rounded-2xl bg-[#EBF5F3] border border-[#0E6156]/20 text-sm font-medium text-[#0E6156]">
                  &ldquo;Here is your verified specialist. Your visit is scheduled for Thursday at 10:15 AM. Here is how to prepare.&rdquo;
                </div>

                <ul className="space-y-3.5 text-sm text-[#191716]">
                  <li className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-[#0E6156] shrink-0 mt-1" />
                    <span>We confirm receipt of your referral with the specialist office.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-[#0E6156] shrink-0 mt-1" />
                    <span>We verify in-network coverage with your exact health plan before you book.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-[#0E6156] shrink-0 mt-1" />
                    <span>We coordinate an appointment that fits your calendar and location.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-[#0E6156] shrink-0 mt-1" />
                    <span>We generate specific questions for your doctor and follow up afterward to close the loop.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. INTERACTIVE PRODUCT EXPERIENCE: SEE WHAT IT ACTUALLY LOOKS LIKE         */}
        {/* ========================================================================= */}
        <section className="py-20 sm:py-28 bg-[#FAF8F5] border-b border-[#E2DDD5]/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-12">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#0E6156]">
                The Platform
              </span>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-[#191716]">
                Designed for clarity. Not clinical clutter.
              </h2>
              <p className="text-base text-[#5C5650] leading-relaxed">
                Most healthcare portals are built for billing systems. CareLoop is built for you: clear next steps, clean timelines, and zero medical bureaucracy.
              </p>
            </div>

            {/* The 5 Product Screens Interactive Showcase */}
            <div className="max-w-5xl mx-auto">
              <ProductMockupViewer initialScreen="today" />
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. REAL HEALTHCARE SCENARIOS (FOR YOU & YOUR FAMILY)                       */}
        {/* ========================================================================= */}
        <section className="py-20 sm:py-28 bg-white border-b border-[#E2DDD5]/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#0E6156]">
                Common Situations
              </span>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-[#191716]">
                Start with whatever is on your mind today.
              </h2>
              <p className="text-base text-[#5C5650] leading-relaxed">
                Whether you have a specific task in front of you or are juggling care for someone you love, CareLoop organizes the next step.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Scenario 1 */}
              <div className="rounded-3xl border border-[#E2DDD5] bg-[#FAF8F5] p-8 space-y-4 hover:border-[#0E6156]/40 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white border border-[#E2DDD5] text-[#0E6156]">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-[#191716]">
                  &ldquo;I need a doctor.&rdquo;
                </h3>
                <p className="text-sm text-[#5C5650] leading-relaxed">
                  Finding a primary care physician who takes your insurance and has openings sooner than three months away is hard. We verify network tiers, confirm active intake, and schedule your visit.
                </p>
                <div className="pt-2">
                  <Link
                    href="/for-you#need-doctor"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E6156] hover:underline"
                  >
                    <span>How we help you find care</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {/* Scenario 2 */}
              <div className="rounded-3xl border border-[#E2DDD5] bg-[#FAF8F5] p-8 space-y-4 hover:border-[#0E6156]/40 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white border border-[#E2DDD5] text-[#0E6156]">
                  <Calendar className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-[#191716]">
                  &ldquo;I was referred to a specialist.&rdquo;
                </h3>
                <p className="text-sm text-[#5C5650] leading-relaxed">
                  Avoid the black hole between primary care and specialty clinics. We confirm the clinic received your orders, track any prior authorizations, and book your consultation.
                </p>
                <div className="pt-2">
                  <Link
                    href="/for-you#specialist-referral"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E6156] hover:underline"
                  >
                    <span>How referrals are managed</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {/* Scenario 3 */}
              <div className="rounded-3xl border border-[#E2DDD5] bg-[#FAF8F5] p-8 space-y-4 hover:border-[#0E6156]/40 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white border border-[#E2DDD5] text-[#0E6156]">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-[#191716]">
                  &ldquo;I&apos;m caring for an aging parent.&rdquo;
                </h3>
                <p className="text-sm text-[#5C5650] leading-relaxed">
                  Being a caregiver shouldn&apos;t turn you into an unpaid healthcare coordinator. Manage their appointments, medications, and specialist checkups while keeping other family members informed.
                </p>
                <div className="pt-2">
                  <Link
                    href="/for-families"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E6156] hover:underline"
                  >
                    <span>CareLoop for Families</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {/* Scenario 4 */}
              <div className="rounded-3xl border border-[#E2DDD5] bg-[#FAF8F5] p-8 space-y-4 hover:border-[#0E6156]/40 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white border border-[#E2DDD5] text-[#0E6156]">
                  <Heart className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-[#191716]">
                  &ldquo;I have an ongoing condition with too many details.&rdquo;
                </h3>
                <p className="text-sm text-[#5C5650] leading-relaxed">
                  Turn a complicated regimen of regular lab tests, specialist visits, and prescription refills into a calm, predictable checklist so nothing falls through the cracks.
                </p>
                <div className="pt-2">
                  <Link
                    href="/for-you#ongoing-condition"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E6156] hover:underline"
                  >
                    <span>Managing chronic care</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 5. HUMAN + TECHNOLOGY: HONEST, GROUNDED PHILOSOPHY                       */}
        {/* ========================================================================= */}
        <section className="py-20 sm:py-28 bg-[#FAF8F5] border-b border-[#E2DDD5]/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#0E6156]">
                Our Philosophy
              </span>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-[#191716]">
                Software for speed. Humans for when healthcare gets hard.
              </h2>
              <p className="text-base text-[#5C5650] leading-relaxed">
                Technology is great at organizing information and verifying directories. But real healthcare often involves busy clinic phones, missing records, and stressful decisions. CareLoop provides both.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="rounded-3xl border border-[#E2DDD5] bg-white p-8 space-y-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EBF5F3] text-[#0E6156]">
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#191716]">
                  Intelligent Organization
                </h3>
                <p className="text-sm text-[#5C5650] leading-relaxed">
                  Always-on tools that verify insurance coverage, organize doctor visits into clear timelines, draft personalized questions for your appointments, and keep follow-up reminders current.
                </p>
              </div>

              <div className="rounded-3xl border border-[#E2DDD5] bg-white p-8 space-y-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FAF8F5] border border-[#E2DDD5] text-[#0E6156]">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#191716]">
                  Dedicated Human Navigators
                </h3>
                <p className="text-sm text-[#5C5650] leading-relaxed">
                  Real healthcare coordinators who step in when clinic phones go to voicemail, paperwork is missing, or you simply need an empathetic partner to help sort through complex options.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 6. TRUST & PRINCIPLES: CLEAR, DIGNIFIED BOUNDARIES                        */}
        {/* ========================================================================= */}
        <section className="py-20 sm:py-24 bg-white border-b border-[#E2DDD5]/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-14">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#0E6156]">
                Trust &amp; Boundaries
              </span>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-[#191716]">
                Built to help you navigate care — not replace your doctor.
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto text-left">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-sm font-bold text-[#191716]">
                  <Shield className="h-4 w-4 text-[#0E6156]" />
                  <span>Strictly Non-Diagnostic</span>
                </div>
                <p className="text-xs text-[#5C5650] leading-relaxed">
                  CareLoop does not diagnose illnesses or prescribe medication. We help you navigate and complete the care recommended by licensed healthcare professionals.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-sm font-bold text-[#191716]">
                  <CheckCircle2 className="h-4 w-4 text-[#0E6156]" />
                  <span>Your Data Stays Yours</span>
                </div>
                <p className="text-xs text-[#5C5650] leading-relaxed">
                  We never sell, rent, or monetize your health information to advertisers, data brokers, or employers. Your privacy is treated with institutional dignity.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-sm font-bold text-[#191716]">
                  <Sparkles className="h-4 w-4 text-[#0E6156]" />
                  <span>Clear Emergency Protocol</span>
                </div>
                <p className="text-xs text-[#5C5650] leading-relaxed">
                  CareLoop is not for medical emergencies. If you are experiencing urgent symptoms, please contact emergency medical services or visit your nearest emergency room.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 7. FINAL CALL TO ACTION: CLEAR, CONFIDENT                                 */}
        {/* ========================================================================= */}
        <section className="py-20 sm:py-28 bg-[#0E6156] text-white">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.02em] leading-tight">
              Turn your healthcare into completed care.
            </h2>
            <p className="text-base sm:text-lg text-white/80 max-w-xl mx-auto font-normal leading-relaxed">
              Tell us what healthcare situation you&apos;re facing today. We&apos;ll help you take the next clear step.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
              <Button
                size="lg"
                variant="secondary"
                onClick={() => handleOpenModal("SELF")}
                rightIcon={<ArrowRight className="h-4 w-4" />}
                className="w-full sm:w-auto bg-white text-[#0E6156] hover:bg-stone-100 font-bold px-8 py-3.5 shadow-sm"
              >
                Join the CareLoop
              </Button>
              <Button
                size="lg"
                variant="outline"
                href="/how-it-works"
                className="w-full sm:w-auto border-white/40 text-white hover:bg-white/10 px-7 py-3.5"
              >
                See how it works
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Global Footer */}
      <Footer />

      {/* Mobile Sticky Action Bar */}
      <MobileStickyCta onPrimaryCtaClick={() => handleOpenModal("SELF")} />

      {/* Interactive Care Assessment & Join Modal */}
      <CareAssessmentModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        initialAudience={initialAudience}
      />
    </div>
  );
}
