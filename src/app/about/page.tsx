import React from "react";
import type { Metadata } from "next";
import {
  ArrowRight,
  Compass,
  CheckCircle2,
  Sparkles,
  Clock,
  Layers,
} from "lucide-react";
import { Navigation } from "@/components/design-system/Navigation";
import { Footer } from "@/components/design-system/Footer";
import {
  Badge,
  Button,
  Card,
  CtaSection,
  H1,
  H2,
  Lead,
  SectionHeader,
} from "@/components/design-system";

import { SITE_CONFIG } from "@/lib/seo/config";

export const metadata: Metadata = {
  title: "About CareLoop: Mission, Origin Story, and Purpose",
  description:
    "CareLoop exists because navigating healthcare has become a job people never applied for. Learn our mission, origin story, and vision for closing the care gap.",
  keywords: [
    "about careloop",
    "healthcare navigation mission",
    "patient advocacy",
    "closing the care gap",
    "healthcare execution gap",
  ],
  alternates: {
    canonical: `${SITE_CONFIG.url}/about`,
  },
  openGraph: {
    title: "About CareLoop — Healthcare Should Work Better for People",
    description:
      "CareLoop exists because navigating healthcare has become a job people never applied for. Closing the gap between 'I need care' and 'I got care.'",
    url: `${SITE_CONFIG.url}/about`,
    type: "website",
  },
};

const PILLARS_OF_THE_GAP = [
  {
    title: "Information Overload",
    observation: "People have portals, apps, and clinical summaries, but no clarity on what to do next Monday morning.",
    icon: Layers,
  },
  {
    title: "Administrative Friction",
    observation: "Phone trees, outdated directories, scheduling runarounds, and pre-visit confusion eat up hours of personal time.",
    icon: Clock,
  },
  {
    title: "Lost Momentum",
    observation: "Between leaving the doctor's exam room and getting follow-up care, recommendations quietly stall and care goes incomplete.",
    icon: Compass,
  },
];

const FOUNDING_BELIEFS = [
  {
    number: "01",
    title: "Navigation shouldn't be an unpaid job",
    body: "When you or someone you love is unwell, you shouldn't have to become a healthcare administrator, insurance detective, and project manager all at once.",
  },
  {
    number: "02",
    title: "Information without follow-through isn't enough",
    body: "Articles, search bars, and chatbot answers don't close the gap. Care is only delivered when the appointment happens, the prep is done, and the follow-up is complete.",
  },
  {
    number: "03",
    title: "Calm intelligence over clinical pretense",
    body: "We will never pretend to be a doctor. We apply thoughtful technology to handle the logistics, communications, and scheduling that exhaust human patience.",
  },
  {
    number: "04",
    title: "Dignity for patients and caregivers",
    body: "Healthcare is profoundly human. Every notification, prompt, and checklist is crafted to reduce anxiety and treat every person's time and vulnerability with care.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF8F5] text-[#191716] selection:bg-[#EBF5F3] selection:text-[#0E6156]">
      <Navigation />

      <main id="main-content" className="flex-1">
        {/* ========================================================================= */}
        {/* HERO SECTION                                                              */}
        {/* ========================================================================= */}
        <section className="relative pt-12 pb-16 md:pt-20 md:pb-28 border-b border-[#E2DDD5]/60 bg-gradient-to-b from-[#FAF8F5] to-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0E6156]/20 bg-[#EBF5F3] px-3.5 py-1 text-xs font-semibold text-[#0E6156]">
                <span>Our Purpose &amp; Story</span>
                <span className="text-[#0E6156]/40">•</span>
                <span className="font-normal text-[#5C5650]">Founded on human reality</span>
              </div>

              <H1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold tracking-[-0.03em] text-[#191716] leading-[1.12]">
                Healthcare should work better for people.
              </H1>

              <Lead className="text-base sm:text-lg lg:text-xl text-[#5C5650] max-w-2xl mx-auto leading-relaxed font-normal">
                CareLoop exists because navigating healthcare has become a job people never applied for.
              </Lead>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <Button
                  size="lg"
                  variant="primary"
                  href="/join"
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Join the CareLoop
                </Button>
                <Button size="lg" variant="outline" href="/how-it-works">
                  See how it works
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* THE CORE STORY & THE EXECUTION GAP                                        */}
        {/* ========================================================================= */}
        <section className="py-20 bg-[#FAF8F5]">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="space-y-12">
              {/* Founder-led statement */}
              <div className="rounded-3xl border border-[#E2DDD5] bg-white p-8 sm:p-12 shadow-soft">
                <Badge variant="accent" className="mb-4">
                  The Fundamental Observation
                </Badge>
                <H2 className="text-2xl sm:text-3xl font-bold text-[#191716] tracking-tight mb-6">
                  People are surrounded by healthcare information but still struggle to turn that information into action.
                </H2>

                <div className="space-y-5 text-sm sm:text-base text-[#5C5650] leading-relaxed">
                  <p>
                    Every year, modern medicine makes extraordinary breakthroughs. Doctors are more capable than ever at diagnosing conditions, developing care plans, and identifying exactly what tests, treatments, and specialists someone needs.
                  </p>
                  <p className="text-[#191716] font-medium text-base sm:text-lg">
                    The problem isn&apos;t always a lack of care.
                  </p>
                  <p>
                    Often, the problem is everything between:
                  </p>

                  {/* The Visual Journey Gap Graphic */}
                  <div className="my-8 rounded-2xl bg-[#FAF8F5] border border-[#E2DDD5] p-6 sm:p-8">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex-1 w-full text-center md:text-left p-4 rounded-xl bg-white border border-[#E2DDD5]/80 shadow-soft">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#0E6156] block mb-1">
                          Where You Start
                        </span>
                        <p className="text-xl sm:text-2xl font-bold text-[#191716]">
                          &ldquo;I need care.&rdquo;
                        </p>
                        <p className="text-xs text-[#5C5650] mt-1">
                          A referral, a discharge slip, a new symptom, or a screening order.
                        </p>
                      </div>

                      <div className="flex flex-col items-center justify-center shrink-0 px-2 py-1">
                        <span className="text-xs font-bold text-[#C87D2A] uppercase tracking-wider mb-1">
                          The Execution Gap
                        </span>
                        <div className="flex items-center gap-2 text-[#C87D2A]">
                          <span className="h-0.5 w-8 bg-[#C87D2A]/40 hidden md:block" />
                          <span className="text-xs font-semibold px-3 py-1 bg-amber-50 rounded-full border border-amber-200">
                            Logistics • Schedules • Follow-ups
                          </span>
                          <span className="h-0.5 w-8 bg-[#C87D2A]/40 hidden md:block" />
                        </div>
                      </div>

                      <div className="flex-1 w-full text-center md:text-right p-4 rounded-xl bg-[#EBF5F3] border border-teal-200 shadow-soft">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#0E6156] block mb-1">
                          Where You Need To Be
                        </span>
                        <p className="text-xl sm:text-2xl font-bold text-[#0E6156]">
                          &ldquo;I got care.&rdquo;
                        </p>
                        <p className="text-xs text-[#0E6156]/80 mt-1">
                          Prepared for the visit, attended, prescriptions in hand, and next steps complete.
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-base sm:text-lg font-semibold text-[#191716] pt-2">
                    CareLoop exists to close that gap.
                  </p>
                  <p>
                    Between those two points lies a maze of unanswered phone calls, confusing directories, fragmented portal logins, pre-visit fasting rules, and uncoordinated follow-ups. When people get overwhelmed, care stalls. CareLoop acts as your steady guide through every hurdle until the loop is closed.
                  </p>
                </div>
              </div>

              {/* 3 Pillars of Friction */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PILLARS_OF_THE_GAP.map((pillar, idx) => {
                  const Icon = pillar.icon;
                  return (
                    <Card key={idx} variant="subtle" padding="lg" className="bg-white border border-[#E2DDD5]">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EBF5F3] text-[#0E6156] mb-4">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-base font-bold text-[#191716] mb-2">{pillar.title}</h3>
                      <p className="text-xs sm:text-sm text-[#5C5650] leading-relaxed">
                        {pillar.observation}
                      </p>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* MISSION & VISION CALLOUT                                                  */}
        {/* ========================================================================= */}
        <section className="py-20 bg-white border-y border-[#E2DDD5]/60">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Mission Card */}
              <div className="rounded-3xl border-2 border-[#0E6156] bg-[#FAF8F5] p-8 sm:p-10 flex flex-col justify-between shadow-soft">
                <div>
                  <Badge variant="brand" className="mb-4">
                    Our Mission
                  </Badge>
                  <H2 className="text-2xl sm:text-3xl font-bold text-[#191716] tracking-tight leading-snug mb-4">
                    &ldquo;Make healthcare easier to navigate, easier to act on, and easier to complete.&rdquo;
                  </H2>
                  <p className="text-xs sm:text-sm text-[#5C5650] leading-relaxed">
                    We measure our work not by the volume of information we surface, but by the tangible friction we remove between knowing what care is needed and completing it.
                  </p>
                </div>
                <div className="mt-8 pt-4 border-t border-[#E2DDD5]/70 flex items-center gap-2 text-xs font-semibold text-[#0E6156]">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Focused on action and follow-through</span>
                </div>
              </div>

              {/* Vision Card */}
              <div className="rounded-3xl border-2 border-[#C87D2A] bg-[#FFFDF9] p-8 sm:p-10 flex flex-col justify-between shadow-soft">
                <div>
                  <Badge variant="accent" className="mb-4">
                    Our Vision
                  </Badge>
                  <H2 className="text-2xl sm:text-3xl font-bold text-[#191716] tracking-tight leading-snug mb-4">
                    &ldquo;A healthcare system where no one falls through the cracks simply because navigating it was too complicated.&rdquo;
                  </H2>
                  <p className="text-xs sm:text-sm text-[#5C5650] leading-relaxed">
                    We envision a future where having a health challenge doesn&apos;t require becoming an unpaid full-time healthcare coordinator just to get the care you are entitled to.
                  </p>
                </div>
                <div className="mt-8 pt-4 border-t border-amber-200/80 flex items-center gap-2 text-xs font-semibold text-[#C87D2A]">
                  <Sparkles className="h-4 w-4" />
                  <span>Dignity, clarity, and completion for everyone</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* HOW WE THINK: 4 FOUNDING BELIEFS                                          */}
        {/* ========================================================================= */}
        <section className="py-20 bg-[#FAF8F5]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeader
              badge="Our Philosophy"
              title="What we believe about healthcare"
              description="These core principles guide our engineering, design, and member advocacy every single day."
              align="center"
              className="mb-14"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {FOUNDING_BELIEFS.map((belief) => (
                <Card
                  key={belief.number}
                  variant="elevated"
                  padding="lg"
                  className="bg-white border border-[#E2DDD5] flex flex-col justify-between"
                >
                  <div>
                    <span className="text-xs font-bold text-[#0E6156] uppercase tracking-wider block mb-2">
                      Belief {belief.number}
                    </span>
                    <h3 className="text-lg font-bold text-[#191716] mb-2">{belief.title}</h3>
                    <p className="text-xs sm:text-sm text-[#5C5650] leading-relaxed">
                      {belief.body}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* FINAL CONVERSION CTA                                                      */}
        {/* ========================================================================= */}
        <CtaSection
          variant="brandDark"
          badge="Close the Execution Gap"
          title="Healthcare should work better for people."
          description="CareLoop exists to help you understand what to do, find your next step, and follow through until care is complete."
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
