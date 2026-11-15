"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Calendar,
  Sparkles,
  Clock,
} from "lucide-react";
import {
  Display,
  H1,
  H2,
  H3,
  Lead,
  Body,
  Small,
  Label,
  Button,
  Badge,
  Card,
  SectionHeader,
  StepIndicator,
  ComparisonBlock,
  StatisticCard,
  FeatureBlock,
  ProductScreenshot,
  TestimonialCard,
  FaqAccordion,
  CtaSection,
  Footer,
} from "@/components/design-system";
import { ProductMockupViewer } from "@/components/product-mockups";

export default function DesignSystemPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [btnLoading, setBtnLoading] = useState(false);

  const sampleSteps = [
    {
      id: "step-1",
      number: "1",
      name: "UNDERSTAND",
      tagline: "Translate clinical jargon into plain English.",
      description: "Decodes doctor notes, ICD codes, and referral instructions.",
    },
    {
      id: "step-2",
      number: "2",
      name: "DECIDE",
      tagline: "Match verified in-network specialists.",
      description: "Checks insurance network tier and live schedule availability.",
    },
    {
      id: "step-3",
      number: "3",
      name: "ACT",
      tagline: "Secure appointment and clear prior auth.",
      description: "Direct front-desk coordination and medical records forwarding.",
    },
    {
      id: "step-4",
      number: "4",
      name: "FOLLOW THROUGH",
      tagline: "Personalized prep checklists and reminders.",
      description: "Custom questions to ask your doctor and transit coordination.",
    },
    {
      id: "step-5",
      number: "5",
      name: "COMPLETE CARE",
      tagline: "Debrief visit and close the loop.",
      description: "Tracks prescription fulfillment and secondary therapy referrals.",
    },
  ];

  const sampleFaq = [
    {
      question: "Is CareLoop a healthcare provider or doctor?",
      answer:
        "No. CareLoop is an intelligent healthcare execution companion. We do not provide clinical diagnoses or replace physician judgment. Instead, we take the care plan, referrals, and recommendations from your licensed doctors and ensure they actually get completed.",
    },
    {
      question: "How does CareLoop differ from insurance directories?",
      answer:
        "Insurance directories provide static lists where up to 40% of numbers are disconnected or not accepting new patients. CareLoop actively executes: checking real-time slot openings, holding appointments, handling prior auth, scheduling rides, and following up after your visit.",
    },
    {
      question: "Can I coordinate care for an aging parent or loved one?",
      answer:
        "Yes. Family care coordination is one of our primary capabilities. CareLoop gives caregivers a shared timeline with multi-user permissions, transit coordination, and post-visit summaries.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#191716]">
      {/* Design System Header */}
      <header className="sticky top-0 z-50 border-b border-[#E2DDD5] bg-white/95 px-6 py-4 shadow-soft backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0E6156] text-white font-bold text-sm">
              CL
            </div>
            <div>
              <span className="font-bold text-sm text-[#191716]">
                CareLoop Design System
              </span>
              <span className="ml-2 rounded-full bg-[#EBF5F3] px-2 py-0.5 text-[10px] font-semibold text-[#0E6156]">
                v1.0 • Marketing Foundation
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-semibold text-[#5C5650] hover:text-[#191716]"
            >
              ← Back to Website
            </Link>
            <Button size="sm" variant="primary" href="/join">
              Experience CareLoop
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-20">
        {/* Section 1: Brand Feel & Philosophy */}
        <section className="space-y-4">
          <SectionHeader
            badge="Brand Feel &amp; Core Positioning"
            title="Calm intelligence for navigating healthcare."
            description="The CareLoop visual system feels more like a premium consumer technology company than a clinical hospital portal. Trusted + warm + intelligent + effortless."
            align="left"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-4">
            <Card variant="default" padding="md">
              <Label>Principle 01</Label>
              <H3 className="mt-2 text-lg">Large Whitespace</H3>
              <Body className="mt-1 text-xs">
                Generous breathing room de-escalates healthcare anxiety and gives clarity to decisions.
              </Body>
            </Card>

            <Card variant="default" padding="md">
              <Label>Principle 02</Label>
              <H3 className="mt-2 text-lg">Warmth &amp; Intelligence</H3>
              <Body className="mt-1 text-xs">
                Restrained eucalyptus pine teal paired with warm amber gold instead of clinical hospital blue.
              </Body>
            </Card>

            <Card variant="default" padding="md">
              <Label>Principle 03</Label>
              <H3 className="mt-2 text-lg">Action, Not Advice</H3>
              <Body className="mt-1 text-xs">
                Components visualize execution (held slots, verified in-network matches, transit confirmations).
              </Body>
            </Card>

            <Card variant="default" padding="md">
              <Label>Principle 04</Label>
              <H3 className="mt-2 text-lg">Accessible by Default</H3>
              <Body className="mt-1 text-xs">
                WCAG 2.1 AA compliant contrast ratios, visible focus outlines, and reduced-motion support.
              </Body>
            </Card>
          </div>
        </section>

        {/* Section 2: Color System */}
        <section className="space-y-6">
          <SectionHeader
            badge="Color Palette"
            title="A restrained, therapeutic healthcare palette."
            description="Warm neutral canvases, deep charcoal inks, signature eucalyptus pine teal, and human honey amber."
            align="left"
          />

          <div className="space-y-8">
            {/* 1. Warm Neutral Backgrounds */}
            <div>
              <Label className="text-[#5C5650]">1. Warm Neutral Surfaces</Label>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="rounded-2xl border border-[#E2DDD5] bg-[#FAF8F5] p-4 text-xs">
                  <div className="h-10 w-full rounded-lg bg-[#FAF8F5] border border-[#E2DDD5]" />
                  <div className="mt-2 font-bold text-[#191716]">Canvas BG</div>
                  <div className="font-mono text-[10px] text-[#8A8279]">#FAF8F5</div>
                </div>

                <div className="rounded-2xl border border-[#E2DDD5] bg-white p-4 text-xs">
                  <div className="h-10 w-full rounded-lg bg-white border border-[#E2DDD5]" />
                  <div className="mt-2 font-bold text-[#191716]">Surface Card</div>
                  <div className="font-mono text-[10px] text-[#8A8279]">#FFFFFF</div>
                </div>

                <div className="rounded-2xl border border-[#E2DDD5] bg-[#F4F0EB] p-4 text-xs">
                  <div className="h-10 w-full rounded-lg bg-[#F4F0EB] border border-[#E2DDD5]" />
                  <div className="mt-2 font-bold text-[#191716]">Surface Subtle</div>
                  <div className="font-mono text-[10px] text-[#8A8279]">#F4F0EB</div>
                </div>

                <div className="rounded-2xl border border-[#E2DDD5] bg-[#EAE5DE] p-4 text-xs">
                  <div className="h-10 w-full rounded-lg bg-[#EAE5DE] border border-[#C7C0B5]" />
                  <div className="mt-2 font-bold text-[#191716]">Surface Muted</div>
                  <div className="font-mono text-[10px] text-[#8A8279]">#EAE5DE</div>
                </div>

                <div className="rounded-2xl border border-[#E2DDD5] bg-white p-4 text-xs">
                  <div className="h-10 w-full rounded-lg bg-[#E2DDD5]" />
                  <div className="mt-2 font-bold text-[#191716]">Border Hairline</div>
                  <div className="font-mono text-[10px] text-[#8A8279]">#E2DDD5</div>
                </div>
              </div>
            </div>

            {/* 2. Signature Brand & Accent */}
            <div>
              <Label className="text-[#5C5650]">2. CareLoop Brand Teal &amp; Honey Amber</Label>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-[#C8E4DE] bg-[#0E6156] p-4 text-xs text-white">
                  <div className="h-10 w-full rounded-lg bg-[#0E6156] border border-white/20" />
                  <div className="mt-2 font-bold">Brand Primary</div>
                  <div className="font-mono text-[10px] text-[#C8E4DE]">#0E6156 (Pine Teal)</div>
                </div>

                <div className="rounded-2xl border border-[#C8E4DE] bg-[#EBF5F3] p-4 text-xs text-[#0E6156]">
                  <div className="h-10 w-full rounded-lg bg-[#EBF5F3] border border-[#C8E4DE]" />
                  <div className="mt-2 font-bold">Brand Light Tint</div>
                  <div className="font-mono text-[10px]">#EBF5F3</div>
                </div>

                <div className="rounded-2xl border border-[#F6DCB8] bg-[#C87D2A] p-4 text-xs text-white">
                  <div className="h-10 w-full rounded-lg bg-[#C87D2A] border border-white/20" />
                  <div className="mt-2 font-bold">Accent Primary</div>
                  <div className="font-mono text-[10px] text-[#FEF6EA]">#C87D2A (Honey Amber)</div>
                </div>

                <div className="rounded-2xl border border-[#F6DCB8] bg-[#FEF6EA] p-4 text-xs text-[#8F5012]">
                  <div className="h-10 w-full rounded-lg bg-[#FEF6EA] border border-[#F6DCB8]" />
                  <div className="mt-2 font-bold">Accent Light Tint</div>
                  <div className="font-mono text-[10px]">#FEF6EA</div>
                </div>
              </div>
            </div>

            {/* 3. Semantic States */}
            <div>
              <Label className="text-[#5C5650]">3. Subtle Semantic Status States</Label>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-[#C6E7D6] bg-[#EDF7F2] p-4 text-xs text-[#1E7E55]">
                  <div className="font-bold">Completed / Success</div>
                  <div className="mt-1 text-[11px]">#1E7E55 (Sage)</div>
                </div>

                <div className="rounded-2xl border border-[#FDE3C4] bg-[#FEF7ED] p-4 text-xs text-[#B45309]">
                  <div className="font-bold">Review / Warning</div>
                  <div className="mt-1 text-[11px]">#B45309 (Ochre)</div>
                </div>

                <div className="rounded-2xl border border-[#D0DEEB] bg-[#F0F4F8] p-4 text-xs text-[#335C7A]">
                  <div className="font-bold">Timeline / Info</div>
                  <div className="mt-1 text-[11px]">#335C7A (Slate Blue)</div>
                </div>

                <div className="rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-xs text-[#B91C1C]">
                  <div className="font-bold">Friction / Alert</div>
                  <div className="mt-1 text-[11px]">#B91C1C (Rose)</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Typography Scale */}
        <section className="space-y-6">
          <SectionHeader
            badge="Typography Hierarchy"
            title="Editorial sans-serif hierarchy."
            description="Creates clarity without relying excessively on extreme font weights."
            align="left"
          />

          <Card variant="default" padding="lg" className="space-y-8">
            <div className="border-b border-[#E2DDD5] pb-6">
              <Label className="text-[#8A8279]">Display Typography (64px / Leading 1.1 / Tight)</Label>
              <Display className="mt-2">Healthcare is complicated.</Display>
            </div>

            <div className="border-b border-[#E2DDD5] pb-6">
              <Label className="text-[#8A8279]">H1 Headline (48px / Leading 1.15)</Label>
              <H1 className="mt-2">Getting care shouldn&apos;t be.</H1>
            </div>

            <div className="border-b border-[#E2DDD5] pb-6">
              <Label className="text-[#8A8279]">H2 Section Headline (36px / Leading 1.25)</Label>
              <H2 className="mt-2">How CareLoop closes the execution gap.</H2>
            </div>

            <div className="border-b border-[#E2DDD5] pb-6">
              <Label className="text-[#8A8279]">H3 Sub-headline (24px / Leading 1.3)</Label>
              <H3 className="mt-2">Intelligent guidance paired with genuine human care.</H3>
            </div>

            <div className="border-b border-[#E2DDD5] pb-6">
              <Label className="text-[#8A8279]">Lead Text (20px / Relaxed)</Label>
              <Lead className="mt-2">
                Healthcare has gotten good at identifying what care people need. CareLoop exists to ensure recommendations become completed care.
              </Lead>
            </div>

            <div className="border-b border-[#E2DDD5] pb-6">
              <Label className="text-[#8A8279]">Body Copy (16px / Relaxed)</Label>
              <Body className="mt-2">
                We verify in-network coverage upfront, match you with doctors who have near-term openings, coordinate rideshare transit, and deliver customized question guides for your visit.
              </Body>
            </div>

            <div>
              <Label className="text-[#8A8279]">Small / Caption (13px)</Label>
              <Small className="mt-1">
                * CareLoop adheres to institutional healthcare confidentiality standards (AES-256 encryption, strict privacy safeguards).
              </Small>
            </div>
          </Card>
        </section>

        {/* Section 4: Buttons & Interactive Triggers */}
        <section className="space-y-6">
          <SectionHeader
            badge="Button Primitives"
            title="Buttons, sizes, and states."
            description="Engineered for high conversion, tactile responsiveness, and keyboard navigation."
            align="left"
          />

          <Card variant="default" padding="lg" className="space-y-6">
            <div>
              <Label className="text-[#8A8279]">1. Variants</Label>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button variant="primary" rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Primary Brand
                </Button>
                <Button variant="secondary">
                  Secondary Neutral
                </Button>
                <Button variant="outline">
                  Outline Button
                </Button>
                <Button variant="ghost">
                  Ghost Button
                </Button>
                <Button variant="accent" rightIcon={<Sparkles className="h-4 w-4" />}>
                  Warm Accent
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-[#8A8279]">2. Sizes</Label>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button size="sm" variant="primary">
                  Small (32px)
                </Button>
                <Button size="md" variant="primary">
                  Medium (40px)
                </Button>
                <Button size="lg" variant="primary">
                  Large (48px)
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-[#8A8279]">3. States &amp; Feedback</Label>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  loading={btnLoading}
                  onClick={() => {
                    setBtnLoading(true);
                    setTimeout(() => setBtnLoading(false), 2000);
                  }}
                >
                  {btnLoading ? "Processing..." : "Click for Loading State"}
                </Button>
                <Button variant="primary" disabled>
                  Disabled Button
                </Button>
              </div>
            </div>
          </Card>
        </section>

        {/* Section 5: Badges */}
        <section className="space-y-6">
          <SectionHeader
            badge="Badge Primitives"
            title="Contextual pills &amp; status indicators."
            description="Used for category tags, execution milestones, and live status pulses."
            align="left"
          />

          <Card variant="default" padding="lg">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="brand" pulseDot>
                Live Execution
              </Badge>
              <Badge variant="accent">
                Action Required
              </Badge>
              <Badge variant="neutral">
                Neutral Category
              </Badge>
              <Badge variant="success">
                In-Network Verified
              </Badge>
              <Badge variant="warning">
                Prior Auth Pending
              </Badge>
              <Badge variant="info">
                Within 14 Days
              </Badge>
              <Badge variant="outline">
                Outline Pill
              </Badge>
            </div>
          </Card>
        </section>

        {/* Section 6: Cards & Soft Depth */}
        <section className="space-y-6">
          <SectionHeader
            badge="Surfaces &amp; Soft Depth"
            title="Tactile card elevation without heavy borders."
            description="Soft multi-layered shadows and rounded 24px/32px geometry."
            align="left"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card variant="default" padding="md">
              <H3 className="text-base">Default Card</H3>
              <Body className="mt-2 text-xs">
                White surface with soft hairline border (#E2DDD5) and gentle shadow.
              </Body>
            </Card>

            <Card variant="interactive" padding="md">
              <H3 className="text-base">Interactive Card</H3>
              <Body className="mt-2 text-xs">
                Hover over this card to see smooth -translate-y-0.5 elevation and shadow expansion.
              </Body>
            </Card>

            <Card variant="highlight" padding="md">
              <H3 className="text-base text-[#0E6156]">Highlight Card</H3>
              <Body className="mt-2 text-xs text-[#09473F]">
                Subtle eucalyptus wash (#F2FAF8) for key milestones and featured care plans.
              </Body>
            </Card>
          </div>
        </section>

        {/* Section 7: Step Indicator Component */}
        <section className="space-y-6">
          <SectionHeader
            badge="The CareLoop Stepper"
            title="Step Indicator Component."
            description="Supports both horizontal pill mode and vertical chronological timeline."
            align="left"
          />

          <Card variant="default" padding="lg" className="space-y-8">
            <div>
              <Label className="text-[#8A8279]">1. Horizontal Pill Stepper (Interactive)</Label>
              <div className="mt-4">
                <StepIndicator
                  steps={sampleSteps}
                  currentStepIndex={activeStep}
                  onStepClick={(idx) => setActiveStep(idx)}
                />
              </div>
            </div>

            <div className="border-t border-[#E2DDD5] pt-8">
              <Label className="text-[#8A8279]">2. Vertical Timeline Mode</Label>
              <div className="mt-4 max-w-lg">
                <StepIndicator
                  steps={sampleSteps}
                  currentStepIndex={activeStep}
                  onStepClick={(idx) => setActiveStep(idx)}
                  variant="timeline"
                />
              </div>
            </div>
          </Card>
        </section>

        {/* Section 8: Comparison Block Component */}
        <section className="space-y-6">
          <SectionHeader
            badge="Friction vs. Resolution"
            title="Comparison Block Component."
            description="Contrasts the broken status quo with the CareLoop execution way."
            align="left"
          />

          <ComparisonBlock
            statusQuoItems={[
              {
                title: "Endless Phone Trees",
                description: "Calling 6 clinics only to find out they aren't taking new patients.",
              },
              {
                title: "4-Month Backlogs",
                description: "Accepting distant appointments because nobody monitors cancellations.",
              },
              {
                title: "Surprise Medical Bills",
                description: "Arriving at the clinic only to learn prior authorization was never filed.",
              },
            ]}
            careLoopItems={[
              {
                title: "Direct In-Network Booking",
                description: "Verified live slot openings held directly with practice front desks.",
              },
              {
                title: "Proactive Fast-Tracking",
                description: "Cancellation alerts to secure care weeks earlier.",
              },
              {
                title: "Prior Auth & Cost Transparency",
                description: "Benefits verified and prior authorizations tracked with your insurer.",
              },
            ]}
          />
        </section>

        {/* Section 9: Statistics Cards */}
        <section className="space-y-6">
          <SectionHeader
            badge="Impact Storytelling"
            title="Statistic Card Component."
            description="Quantified outcomes and operational milestones."
            align="left"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <StatisticCard
              value="8 Days"
              label="Specialist Visit Secured"
              subtext="Down from 14-week standard clinic backlog"
              badge="Wait Reduced"
              variant="brand"
              icon={<Calendar className="h-5 w-5" />}
            />
            <StatisticCard
              value="3.5 Hours"
              label="Phone Tag Avoided"
              subtext="Zero time spent on hold during work hours"
              badge="Time Saved"
              icon={<Clock className="h-5 w-5" />}
            />
            <StatisticCard
              value="100%"
              label="In-Network Verified"
              subtext="Zero unexpected out-of-network facility charges"
              badge="Cost Protected"
              icon={<ShieldCheck className="h-5 w-5" />}
            />
          </div>
        </section>

        {/* Section 10: Feature Block & Product Screenshot */}
        <section className="space-y-6">
          <SectionHeader
            badge="Product Storytelling"
            title="Feature Block &amp; Product Screenshot Frames."
            description="Editorial narrative paired with live product window chrome and floating annotations."
            align="left"
          />

          <Card variant="default" padding="lg">
            <FeatureBlock
              badge="Phase 03: ACT"
              title="From recommendation to secured visit without the phone tag."
              description="CareLoop coordinates directly with clinic scheduling desks, confirms intake paperwork, and arranges wheelchair-accessible rides if needed."
              bulletPoints={[
                "Verified in-network provider availability matched to your insurance",
                "Automated intake questionnaire transmission ahead of time",
                "Door-to-door transit assistance scheduled automatically",
              ]}
              cta={
                <Button variant="primary" rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Explore Execution
                </Button>
              }
              visual={
                <ProductScreenshot
                  title="CareLoop Companion • Active Plan"
                  badge="Verified Slot"
                  annotation={{
                    title: "Human Care Navigator",
                    description: "Sarah K., RN verified Dr. Chen's office received your prior MRI disc.",
                  }}
                >
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-[#E2DDD5] pb-2">
                      <span className="font-bold text-[#191716]">Dr. Andrea Chen, MD</span>
                      <span className="rounded-md bg-[#EBF5F3] px-2 py-0.5 font-semibold text-[#0E6156]">
                        Tuesday 10:30 AM
                      </span>
                    </div>
                    <div className="text-[#5C5650]">
                      Headache &amp; Migraine Medicine • 3.8 miles away
                    </div>
                    <div className="rounded-xl bg-[#FAF8F5] p-2.5 text-[#5C5650]">
                      Copay: $30 (Tier 1 Preferred In-Network)
                    </div>
                  </div>
                </ProductScreenshot>
              }
            />
          </Card>
        </section>

        {/* Section 11: Testimonial Story Cards */}
        <section className="space-y-6">
          <SectionHeader
            badge="Human Reassurance"
            title="Testimonial Card Component."
            description="Authentic consumer and caregiver lived experiences."
            align="left"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <TestimonialCard
              quote="I used to put off specialist visits for months because making the calls and figuring out insurance was exhausting. CareLoop had me booked in 10 minutes."
              author="Elena R."
              context="Navigating care for chronic migraines"
              careOutcome="Specialist Visit Completed"
              avatarInitials="ER"
            />
            <TestimonialCard
              quote="Living two hours away from my 79-year-old father used to cause constant anxiety after his hospital discharge. CareLoop kept our whole family synced and arranged his ride."
              author="Maya T."
              context="Family Caregiver for father Robert"
              careOutcome="Cardiology Care Coordinated"
              avatarInitials="MT"
            />
          </div>
        </section>

        {/* Section 12: FAQ Accordion */}
        <section className="space-y-6">
          <SectionHeader
            badge="Accessible Disclosure"
            title="FAQ Accordion Component."
            description="Clean ARIA region controls, smooth open/close, and high contrast."
            align="left"
          />

          <div className="max-w-3xl">
            <FaqAccordion items={sampleFaq} defaultOpenIndex={0} />
          </div>
        </section>

        {/* Section 13: Realistic Product UI Mockups */}
        <section className="space-y-6">
          <SectionHeader
            badge="Realistic Product UI Mockups"
            title="Interactive CareLoop Application Screens."
            description="Polished, consumer-friendly, calm UI mockups designed for healthcare navigation and follow-through. Reusable across marketing pages."
            align="left"
          />

          <ProductMockupViewer />
        </section>

        {/* Section 14: High-Conversion CTA Section */}
        <section className="space-y-6">
          <SectionHeader
            badge="Conversion Anchor"
            title="CTA Section Component."
            description="Both deep pine brand dark and warm canvas variants."
            align="left"
          />

          <CtaSection
            title="Ready to turn your care plan into completed care?"
            description="Experience the calm of knowing what to do, knowing what happens next, and having a companion that helps you get it done."
            primaryCtaText="Join the CareLoop"
            primaryCtaHref="/join"
            secondaryCtaText="See how CareLoop works"
            secondaryCtaHref="/how-it-works"
            variant="brandDark"
          />
        </section>
      </main>

      {/* Footer Component */}
      <Footer className="mt-24" />
    </div>
  );
}
