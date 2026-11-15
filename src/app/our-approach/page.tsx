import React from "react";
import type { Metadata } from "next";
import {
  Heart,
  ShieldCheck,
  Eye,
  Lock,
  ArrowUpRight,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Layers,
  Compass,
  FileText,
  Bell,
  RefreshCw,
} from "lucide-react";
import { Navigation } from "@/components/design-system/Navigation";
import { Footer } from "@/components/design-system/Footer";
import {
  Badge,
  Button,
  Card,
  H1,
  H2,
  H3,
  Lead,
  Body,
  SectionHeader,
  CtaSection,
} from "@/components/design-system";

import { SITE_CONFIG } from "@/lib/seo/config";

export const metadata: Metadata = {
  title: "Trust & Our Approach: Responsible Healthcare AI & Navigation",
  description:
    "CareLoop is built to help you navigate healthcare — not replace your healthcare team. Learn our responsible product philosophy, AI boundaries, and privacy standards.",
  keywords: [
    "responsible healthcare AI",
    "healthcare navigation boundaries",
    "patient privacy",
    "non-diagnostic healthcare support",
    "care coordination ethics",
  ],
  alternates: {
    canonical: `${SITE_CONFIG.url}/our-approach`,
  },
  openGraph: {
    title: "Our Approach & Responsible Healthcare Navigation — CareLoop",
    description:
      "Built to help you navigate healthcare — not replace your healthcare team. Responsible AI, strict non-diagnostic boundaries, and human dignity.",
    url: `${SITE_CONFIG.url}/our-approach`,
    type: "website",
  },
};

const FIVE_PRINCIPLES = [
  {
    title: "Human-centered",
    tagline: "Clarity, dignity, and human judgment at the center",
    description:
      "Healthcare is deeply personal. It involves our bodies, our families, and our most vulnerable moments. CareLoop is built to reduce anxiety, respect personal agency, and always keep human needs ahead of software convenience.",
    icon: Heart,
    color: "bg-teal-50 text-[#0E6156] border-teal-200",
  },
  {
    title: "AI with boundaries",
    tagline: "Intelligent assistance without pretending to be a doctor",
    description:
      "Artificial intelligence is wonderful at organizing complex logistics, parsing provider directories, and identifying logical next steps. But CareLoop will never pretend to be a doctor, offer clinical diagnoses, or substitute for physician judgment.",
    icon: Sparkles,
    color: "bg-amber-50 text-[#C87D2A] border-amber-200",
  },
  {
    title: "Transparency",
    tagline: "Understand what CareLoop is doing and why",
    description:
      "We believe you deserve to understand the logic behind every recommendation. We clearly explain why a doctor fits your network, why a pre-visit task is recommended, and what costs to expect. No hidden algorithms or obscure fees.",
    icon: Eye,
    color: "bg-sky-50 text-[#1E6091] border-sky-200",
  },
  {
    title: "Privacy",
    tagline: "Healthcare information is deeply personal",
    description:
      "Your health details belong exclusively to you. We maintain a strict zero-ad monetization model: we never sell, rent, or trade your medical searches, profile, or family history to advertisers, data brokers, or prospective employers.",
    icon: Lock,
    color: "bg-emerald-50 text-[#1E7E55] border-emerald-200",
  },
  {
    title: "Escalation",
    tagline: "Directing users toward appropriate professional care",
    description:
      "When a situation requires licensed medical judgment or hands-on clinical evaluation, CareLoop directs you toward appropriate doctors rather than pretending technology can replace them.",
    icon: ArrowUpRight,
    color: "bg-rose-50 text-[#B91C1C] border-rose-200",
  },
];

const RESPONSIBLE_AI_PILLARS = [
  {
    title: "Organization",
    desc: "Structuring scattered referrals, lab slips, discharge papers, and timelines into one calm checklist.",
    icon: Layers,
  },
  {
    title: "Navigation",
    desc: "Cross-referencing live provider directories to verify in-network coverage and open intake slots.",
    icon: Compass,
  },
  {
    title: "Preparation",
    desc: "Generating tailored pre-visit briefing checklists so you know what questions to ask your doctor.",
    icon: FileText,
  },
  {
    title: "Reminders",
    desc: "Delivering proactive nudges for fasting instructions, parking logistics, and confirmed appointment times.",
    icon: Bell,
  },
  {
    title: "Follow-through",
    desc: "Closing the loop on post-visit doctor instructions, diagnostic lab results, and pharmacy renewals.",
    icon: RefreshCw,
  },
  {
    title: "Information Synthesis",
    desc: "Translating confusing medical billing codes, deductibles, and clinical jargon into plain, conversational English.",
    icon: HelpCircle,
  },
];

export default function OurApproachPage() {
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
                <span>Responsible Product Philosophy</span>
                <span className="text-[#0E6156]/40">•</span>
                <span className="font-normal text-[#5C5650]">Human judgment at the center</span>
              </div>

              <H1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-semibold tracking-[-0.03em] text-[#191716] leading-[1.12]">
                Built to help you navigate healthcare — not replace your healthcare team.
              </H1>

              <Lead className="text-base sm:text-lg text-[#5C5650] leading-relaxed max-w-2xl mx-auto font-normal">
                CareLoop is designed to make healthcare easier to understand, organize, and act on while keeping people at the center.
              </Lead>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <Button size="lg" variant="primary" href="/join" rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Join the CareLoop
                </Button>
                <Button size="lg" variant="secondary" href="/how-it-works">
                  See how it works
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: THE FIVE PRINCIPLES                                            */}
        {/* ========================================================================= */}
        <section id="principles" className="py-20 bg-white border-y border-[#E2DDD5]/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeader
              badge="Guiding Principles"
              title="How we approach health, technology, and trust"
              description="Technology should reduce healthcare anxiety, not introduce confusion or false promises. These five commitments guide every feature we build."
              align="center"
              className="mb-16"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {FIVE_PRINCIPLES.map((principle, idx) => {
                const Icon = principle.icon;
                return (
                  <Card
                    key={idx}
                    variant="elevated"
                    padding="lg"
                    className="flex flex-col justify-between transition-all hover:shadow-card"
                  >
                    <div>
                      <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${principle.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <H3 className="text-lg font-bold text-[#191716] mb-1">{principle.title}</H3>
                      <p className="text-xs font-semibold text-[#0E6156] mb-3">{principle.tagline}</p>
                      <Body className="text-xs text-[#5C5650] leading-relaxed">
                        {principle.description}
                      </Body>
                    </div>

                    <div className="mt-6 pt-4 border-t border-[#E2DDD5]/60 flex items-center text-[11px] font-semibold text-[#0E6156]">
                      <span>Principle 0{idx + 1}</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: RESPONSIBLE AI (BOUNDARIES & WHAT IT SUPPORTS)                  */}
        {/* ========================================================================= */}
        <section className="py-20 bg-[#FAF8F5]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center mb-16">
              <Badge variant="accent" className="mb-3">
                Intelligent Boundaries
              </Badge>
              <H2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#191716] mb-4">
                What CareLoop AI does — and what it intentionally does not do.
              </H2>
              <Lead className="text-sm sm:text-base text-[#5C5650] leading-relaxed">
                We believe AI has immense value in administrative coordination, but strict ethical boundaries are essential.
              </Lead>
            </div>

            {/* Clear Non-Diagnostic Stance Box */}
            <div className="mx-auto max-w-4xl rounded-3xl border-2 border-[#0E6156] bg-white p-6 sm:p-10 shadow-elevated mb-12">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#E2DDD5]/70 mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EBF5F3] text-[#0E6156]">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#191716]">Our Non-Diagnostic Boundary</h3>
                    <p className="text-xs text-[#5C5650]">Clear distinction between logistics and clinical practice</p>
                  </div>
                </div>
                <Badge variant="brand" size="sm">Strict Policy</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm">
                <div className="space-y-3">
                  <span className="font-bold text-[#0E6156] uppercase text-xs tracking-wider block">
                    What CareLoop AI Is Intended to Support:
                  </span>
                  <ul className="space-y-2 text-[#191716]">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#0E6156] shrink-0" />
                      <span><strong>Organization:</strong> Consolidating scattered records and tasks.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#0E6156] shrink-0" />
                      <span><strong>Navigation:</strong> Locating in-network doctors and open slots.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#0E6156] shrink-0" />
                      <span><strong>Preparation:</strong> Drafting questions for your doctor visit.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#0E6156] shrink-0" />
                      <span><strong>Reminders &amp; Follow-through:</strong> Tracking refills and lab dates.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#0E6156] shrink-0" />
                      <span><strong>Information Synthesis:</strong> Translating medical shorthand into plain English.</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-3 bg-[#FAF8F5] p-5 rounded-2xl border border-[#E2DDD5]/70">
                  <span className="font-bold text-rose-800 uppercase text-xs tracking-wider block">
                    What CareLoop Intentionally Does NOT Do:
                  </span>
                  <ul className="space-y-2 text-[#5C5650]">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-rose-600">✕</span>
                      <span>It is <strong>not intended to independently diagnose</strong> medical conditions.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-rose-600">✕</span>
                      <span>It is <strong>not intended to prescribe</strong> or modify medical treatments.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-rose-600">✕</span>
                      <span>It does not replace your relationship with licensed healthcare professionals.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-rose-600">✕</span>
                      <span>It does not provide emergency triage or acute crisis care.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* The 6 Support Pillars Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {RESPONSIBLE_AI_PILLARS.map((pillar, pIdx) => {
                const Icon = pillar.icon;
                return (
                  <Card key={pIdx} variant="subtle" padding="md" className="border border-[#E2DDD5] bg-white">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EBF5F3] text-[#0E6156] mt-0.5">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#191716]">{pillar.title}</h4>
                        <p className="text-xs text-[#5C5650] mt-1 leading-relaxed">{pillar.desc}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 4: SAFETY & EMERGENCY LANGUAGE                                    */}
        {/* ========================================================================= */}
        <section className="py-16 bg-white border-y border-[#E2DDD5]/60">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-amber-200 bg-[#FFFDF9] p-6 sm:p-10 shadow-soft">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-[#C87D2A]">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div className="space-y-3">
                  <H2 className="text-xl sm:text-2xl font-bold text-[#191716]">
                    Immediate Medical Emergency Notice
                  </H2>
                  <p className="text-sm text-[#191716] font-semibold leading-relaxed">
                    &ldquo;If you believe you are experiencing a medical emergency, contact local emergency services or seek immediate medical attention.&rdquo;
                  </p>
                  <p className="text-xs sm:text-sm text-[#5C5650] leading-relaxed">
                    CareLoop is strictly a health navigation, organizational, and follow-through service. We do not evaluate acute, urgent, or life-threatening symptoms. In an emergency, please dial <strong>911</strong> or go immediately to the nearest hospital emergency room.
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
          badge="A Thoughtful Partner in Health"
          title="See how CareLoop works."
          description="Experience a healthcare navigation companion designed around human dignity, calm intelligence, and responsible boundaries."
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
