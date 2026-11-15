import React from "react";
import type { Metadata } from "next";
import {
  ArrowRight,
  CheckCircle2,
  Calendar,
  Compass,
  Heart,
  Sparkles,
  Stethoscope,
  AlertCircle,
  HelpCircle,
  Layers,
  AlertTriangle,
  UserCheck,
} from "lucide-react";
import { Navigation } from "@/components/design-system/Navigation";
import { Footer } from "@/components/design-system/Footer";
import {
  Badge,
  Button,
  H1,
  H2,
  Lead,
  CtaSection,
} from "@/components/design-system";
import { SITE_CONFIG } from "@/lib/seo/config";

export const metadata: Metadata = {
  title: "Personal Healthcare Navigation & Support: Whatever You're Navigating",
  description:
    "Find a doctor, manage specialist referrals, organize appointments, and coordinate chronic care. CareLoop makes your next healthcare step clear.",
  keywords: [
    "personal healthcare navigation",
    "find a doctor",
    "specialist referral help",
    "manage chronic condition",
    "healthcare appointments",
    "healthcare guidance",
  ],
  alternates: {
    canonical: `${SITE_CONFIG.url}/for-you`,
  },
  openGraph: {
    title: "Healthcare Navigation For You — CareLoop",
    description:
      "Whatever you're navigating, start here. Practical help finding providers, organizing care plans, and following through.",
    url: `${SITE_CONFIG.url}/for-you`,
    type: "website",
  },
};

const SCENARIOS = [
  {
    id: "need-doctor",
    title: "I need a doctor.",
    tagline: "Find the right kind of care and prepare for the appointment.",
    problemStatement:
      "You know you need to see a physician—whether for an overdue annual physical, a lingering cough, or a routine checkup—but calling offices to check insurance tiers and intake openings feels like a chore.",
    careloopExecution: [
      {
        title: "Exact Network Verification",
        desc: "We verify provider in-network participation with your specific insurer plan tier before booking.",
      },
      {
        title: "Verified Open Intake",
        desc: "We confirm the clinic is actively accepting new patients and has open slots within your target timeframe.",
      },
      {
        title: "Pre-Visit Question Briefing",
        desc: "We draft tailored questions so you walk into the exam room feeling confident and prepared.",
      },
    ],
    uiPreview: {
      type: "Doctor Match",
      title: "Primary Care Physician Matched",
      details: "Dr. Elena Rostova, MD • Internal Medicine",
      meta: "In-Network (Tier 1) • Verified Copay: $25 • 3.2 miles away",
      status: "Confirmed: Tuesday at 9:00 AM",
      action: "Pre-visit paperwork completed & calendar synced",
    },
    icon: Stethoscope,
    badgeVariant: "brand" as const,
  },
  {
    id: "specialist-referral",
    title: "I was referred to a specialist.",
    tagline: "Understand what happens next and stay on top of the referral.",
    problemStatement:
      "Your primary doctor gave you a paper referral or told you 'someone will call you to schedule.' Two weeks pass, no one calls, and you have no idea whether your referral was faxed, received, or forgotten.",
    careloopExecution: [
      {
        title: "Referral Ingestion & Audit",
        desc: "We ingest your referral slip, clarify diagnosis codes, and verify that the specialist practice actually received the clinical order.",
      },
      {
        title: "Prior Authorization Tracking",
        desc: "We proactively monitor insurer approval status so your appointment isn't delayed by administrative red tape.",
      },
      {
        title: "Closed-Loop Scheduling",
        desc: "We match specialist availability to your schedule and ensure previous diagnostic imaging and lab records are transmitted ahead of your visit.",
      },
    ],
    uiPreview: {
      type: "Specialist Coordination",
      title: "Cardiology Referral Verified",
      details: "Dr. Sarah Lin, MD • Bay Area Cardiovascular",
      meta: "Prior Authorization #AUTH-8492 Approved • Records Forwarded",
      status: "Appointment Confirmed: Nov 19 at 10:15 AM",
      action: "Human Care Guide verified referral receipt with clinic front desk",
    },
    icon: Compass,
    badgeVariant: "accent" as const,
  },
  {
    id: "too-many-things",
    title: "I have too many things to keep track of.",
    tagline: "Organize appointments, tasks, questions, and follow-ups.",
    problemStatement:
      "Between multiple doctor visits, different patient portals, prescription refills, fasting instructions, and lab slips, your healthcare feels like a scattered pile of paper and forgotten deadlines.",
    careloopExecution: [
      {
        title: "Single Unified Health Timeline",
        desc: "Consolidate every appointment, lab order, and prescription renewal into one calm, chronological command center.",
      },
      {
        title: "Smart Calendar & SMS Sync",
        desc: "Automatic reminders deliver practical guidance: fasting rules, parking notes, and arrival checklists right when you need them.",
      },
      {
        title: "Action Item Organization",
        desc: "Every recommendation becomes a tangible task with a clear owner, deadline, and verification checkmark.",
      },
    ],
    uiPreview: {
      type: "Unified Timeline",
      title: "CareLoop Command Center",
      details: "3 Active Loops Synchronized (Cardiology, Labs, Pharmacy)",
      meta: "Zero scattered portal passwords • All records centralized",
      status: "Next Action: Quest Diagnostics fasting blood draw (8:00 AM)",
      action: "Calendar alert set • Fasting instructions delivered via SMS",
    },
    icon: Layers,
    badgeVariant: "brand" as const,
  },
  {
    id: "ongoing-condition",
    title: "I'm managing an ongoing condition.",
    tagline: "Turn a complicated care plan into manageable next steps.",
    problemStatement:
      "Living with hypertension, diabetes, thyroid disorders, or autoimmune conditions requires continuous vigilance. Staying ahead of recurring blood panels, medication refills, and quarterly reviews is exhausting.",
    careloopExecution: [
      {
        title: "Recurring Care Rhythm",
        desc: "We map out your 30-, 60-, and 90-day health milestones so routine maintenance never becomes an urgent crisis.",
      },
      {
        title: "Automated Refill Coordination",
        desc: "We coordinate prescription renewals with your pharmacy before you reach the bottom of your pill bottle.",
      },
      {
        title: "Dedicated Care Guide Backup",
        desc: "When lab orders expire or medication tiers change, a human Care Guide advocates on your behalf to get them renewed.",
      },
    ],
    uiPreview: {
      type: "Chronic Care Rhythm",
      title: "Quarterly Diabetes & Lipid Cadence",
      details: "Endocrinologist checkup & HbA1c panel",
      meta: "Rx Refill: Metformin 500mg (90-day supply ready at Walgreens)",
      status: "Upcoming Lab: Saturday, Oct 24 • Quest Diagnostics",
      action: "Timeline updated • Next routine review scheduled for Jan 2027",
    },
    icon: Heart,
    badgeVariant: "accent" as const,
  },
  {
    id: "dont-understand-options",
    title: "I don't understand my healthcare options.",
    tagline: "Get clear explanations and practical next steps.",
    problemStatement:
      "Deductibles, out-of-pocket maximums, facility fees, prior authorizations, in-network vs. out-of-network tiers. The healthcare system speaks a foreign language designed to confuse consumers.",
    careloopExecution: [
      {
        title: "Plain-English Translation",
        desc: "We translate complex medical orders, insurance letters, and clinical visit summaries into clear, plain language.",
      },
      {
        title: "Cost & Network Transparency",
        desc: "We explain estimated copays, verify facility fees, and help you avoid surprise out-of-network bills before you step into a clinic.",
      },
      {
        title: "Objective Action Pathways",
        desc: "When presented with multiple pathways (e.g., physical therapy vs. imaging), we outline the practical steps and costs for each.",
      },
    ],
    uiPreview: {
      type: "Benefits & Cost Clarity",
      title: "Imaging Order Demystified",
      details: "Lumbar Spine MRI • Clinical Order Translation",
      meta: "Facility A: Hospital Outpatient ($1,240 copay) vs Facility B: Standalone In-Network ($180 copay)",
      status: "Selected: Standalone Accredited Imaging Center",
      action: "Saved $1,060 out-of-pocket • Authorization verified",
    },
    icon: HelpCircle,
    badgeVariant: "brand" as const,
  },
  {
    id: "something-changed",
    title: "Something changed and I don't know what to do.",
    tagline: "Use CareLoop to organize the situation and determine the next appropriate action.",
    problemStatement:
      "A new symptom appeared, your employer changed health insurance plans, or a doctor gave you an unexpected test result. You feel uncertain, stressed, and don't know whether to call a doctor, wait, or visit urgent care.",
    careloopExecution: [
      {
        title: "Immediate Situation Triage",
        desc: "We help you organize what happened, gather your relevant health history, and determine the appropriate clinical setting (primary care, urgent care, or specialist).",
      },
      {
        title: "Transition Management",
        desc: "If your insurance plan changed, we audit your existing care team against your new benefits to protect doctor continuity.",
      },
      {
        title: "Calm Step-by-Step Guidance",
        desc: "We replace panic and symptom-checking doom-scrolling with an orderly, logical checklist of what to do next.",
      },
    ],
    uiPreview: {
      type: "Rapid Transition Care",
      title: "New Insurance Plan Transition",
      details: "Auditing 4 existing providers against new UnitedHealthcare network",
      meta: "3 of 4 doctors in-network • Finding substitute for out-of-network physical therapist",
      status: "In Progress: Records transfer requested from previous clinic",
      action: "Seamless care continuity established without billing gaps",
    },
    icon: AlertTriangle,
    badgeVariant: "accent" as const,
  },
];

export default function ForYouPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF8F5] text-[#191716] selection:bg-[#EBF5F3] selection:text-[#0E6156]">
      <Navigation />

      <main id="main-content" className="flex-1">
        {/* ========================================================================= */}
        {/* HERO SECTION                                                              */}
        {/* ========================================================================= */}
        <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 border-b border-[#E2DDD5]/60 bg-gradient-to-b from-[#FAF8F5] to-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0E6156]/20 bg-[#EBF5F3] px-3.5 py-1 text-xs font-semibold text-[#0E6156]">
                <span>Personal Healthcare Guidance</span>
                <span className="text-[#0E6156]/40">•</span>
                <span className="font-normal text-[#5C5650]">Clear next steps for every situation</span>
              </div>

              <H1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold tracking-[-0.03em] text-[#191716] leading-[1.12]">
                Whatever you&apos;re navigating, start here.
              </H1>

              <Lead className="text-base sm:text-lg text-[#5C5650] leading-relaxed max-w-2xl mx-auto font-normal">
                CareLoop helps make the next step clearer — whether you&apos;re booking an appointment, managing ongoing care, or figuring out what comes next.
              </Lead>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <Button size="lg" variant="primary" href="/join" rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Join the CareLoop
                </Button>
                <Button size="lg" variant="secondary" href="#scenarios">
                  See how it works
                </Button>
              </div>

              {/* Quick Jump Bar */}
              <div className="pt-8">
                <p className="text-xs font-bold text-[#8A8279] uppercase tracking-wider mb-3">
                  Jump to what matches your situation:
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-4xl mx-auto">
                  {SCENARIOS.map((sc) => (
                    <a
                      key={sc.id}
                      href={`#${sc.id}`}
                      className="rounded-full border border-[#E2DDD5] bg-white/90 px-3.5 py-1.5 text-xs font-medium text-[#5C5650] shadow-2xs transition-all hover:border-[#0E6156] hover:bg-[#EBF5F3] hover:text-[#0E6156]"
                    >
                      {sc.title}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SCENARIOS SECTION: 6 VISUALLY DISTINCT SITUATIONS                         */}
        {/* ========================================================================= */}
        <section id="scenarios" className="py-20 bg-white border-t border-[#E2DDD5]/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-24">
            {SCENARIOS.map((scenario, idx) => {
              const Icon = scenario.icon;
              const isEven = idx % 2 === 1;

              return (
                <div
                  key={scenario.id}
                  id={scenario.id}
                  className="scroll-mt-24 pt-6 border-t border-[#E2DDD5]/40 first:border-t-0 first:pt-0"
                >
                  <div className={`grid grid-cols-1 lg:grid-cols-12 gap-12 items-center ${isEven ? "lg:flex-row-reverse" : ""}`}>
                    {/* Narrative & Solution Column */}
                    <div className={`lg:col-span-6 space-y-6 ${isEven ? "lg:order-2" : "lg:order-1"}`}>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#EBF5F3] text-[#0E6156]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <Badge variant={scenario.badgeVariant} size="sm">
                          Situation 0{idx + 1}
                        </Badge>
                      </div>

                      <div>
                        <H2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#191716]">
                          &ldquo;{scenario.title}&rdquo;
                        </H2>
                        <p className="text-sm sm:text-base font-semibold text-[#0E6156] mt-1.5">
                          {scenario.tagline}
                        </p>
                      </div>

                      {/* The Friction Quote Callout */}
                      <div className="rounded-2xl border border-rose-200/80 bg-rose-50/40 p-4 text-xs sm:text-sm text-[#191716] leading-relaxed italic">
                        <span className="font-bold text-rose-800 not-italic block mb-1">The Everyday Problem:</span>
                        &ldquo;{scenario.problemStatement}&rdquo;
                      </div>

                      {/* How CareLoop Solves It */}
                      <div className="space-y-3 pt-2">
                        <span className="text-xs font-bold text-[#191716] uppercase tracking-wider block">
                          How CareLoop makes the next step clear:
                        </span>

                        <div className="space-y-3">
                          {scenario.careloopExecution.map((item, itemIdx) => (
                            <div key={itemIdx} className="flex items-start gap-3 text-xs sm:text-sm">
                              <CheckCircle2 className="h-4 w-4 text-[#0E6156] shrink-0 mt-0.5" />
                              <div>
                                <strong className="text-[#191716]">{item.title}: </strong>
                                <span className="text-[#5C5650]">{item.desc}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2">
                        <Button
                          size="sm"
                          variant="primary"
                          href="/join"
                          rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                        >
                          Resolve this with CareLoop
                        </Button>
                      </div>
                    </div>

                    {/* Product UI Visualization Column */}
                    <div className={`lg:col-span-6 ${isEven ? "lg:order-1" : "lg:order-2"}`}>
                      <div className="rounded-3xl border border-[#E2DDD5] bg-[#FAF8F5] p-6 sm:p-8 shadow-elevated transition-all hover:shadow-card">
                        <div className="flex items-center justify-between pb-4 border-b border-[#E2DDD5]/70 mb-5">
                          <div className="inline-flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-[#C87D2A]" />
                            <span className="text-xs font-bold uppercase tracking-wider text-[#5C5650]">
                              CareLoop Action Card
                            </span>
                          </div>
                          <Badge variant="neutral" size="sm">
                            {scenario.uiPreview.type}
                          </Badge>
                        </div>

                        <div className="space-y-4">
                          <div className="rounded-2xl border-2 border-[#0E6156] bg-white p-5 shadow-soft space-y-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0E6156]">
                              Verified Action
                            </span>
                            <h4 className="text-base font-bold text-[#191716]">
                              {scenario.uiPreview.title}
                            </h4>
                            <p className="text-xs text-[#5C5650]">
                              {scenario.uiPreview.details}
                            </p>
                            <p className="text-[11px] font-semibold text-[#0E6156] bg-[#EBF5F3] px-2.5 py-1 rounded-md inline-block mt-1">
                              {scenario.uiPreview.meta}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-[#E2DDD5] bg-white p-4 space-y-2 text-xs">
                            <div className="flex items-center justify-between text-[#191716]">
                              <span className="font-bold flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-[#0E6156]" />
                                {scenario.uiPreview.status}
                              </span>
                              <Badge variant="success" size="sm">Active</Badge>
                            </div>
                            <p className="text-[#5C5650] text-[11px] pt-1 border-t border-[#E2DDD5]/60">
                              ✓ {scenario.uiPreview.action}
                            </p>
                          </div>

                          <div className="rounded-xl border border-amber-200 bg-[#FFFDF9] p-3 text-[11px] text-[#191716] flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-[#C87D2A] shrink-0" />
                            <span>
                              <strong>Care Guide Elena R.:</strong> &ldquo;I&apos;ve verified that all network requirements and paperwork for this step are complete.&rdquo;
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* EMERGENCY SAFETY REMINDER                                                 */}
        {/* ========================================================================= */}
        <section className="py-12 bg-[#FAF8F5] border-t border-[#E2DDD5]/60">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-amber-200 bg-[#FFFDF9] p-5 text-xs text-[#191716]">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-[#C87D2A] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-[#191716]">
                    Important Care Boundary Notice
                  </p>
                  <p className="leading-relaxed text-[#5C5650]">
                    CareLoop is a navigation, organization, and follow-through tool. We do not provide clinical medical diagnosis or emergency services. If you are experiencing chest pain, severe shortness of breath, sudden weakness, or any life-threatening emergency, please dial <strong>911</strong> or visit the nearest emergency room immediately.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* FINAL CONVERSION CTA                                                      */}
        {/* ========================================================================= */}
        <CtaSection
          variant="brandDark"
          badge="Take the First Step"
          title="Start with what's on your mind."
          description="Tell CareLoop what healthcare situation you're facing today. We'll turn it into a clear, manageable next step."
          primaryCtaText="Join the CareLoop"
          primaryCtaHref="/join"
          secondaryCtaText="See how it works"
          secondaryCtaHref="/how-it-works"
        />
      </main>

      <Footer />
    </div>
  );
}
