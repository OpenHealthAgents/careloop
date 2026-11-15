"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Users,
  Heart,
  Baby,
  Clock,
  FileText,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  Check,
  Sparkles,
  Lock,
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
  SectionHeader,
  CtaSection,
} from "@/components/design-system";

// 4 Family Member Journeys for the Product Visual Showcase
const FAMILY_MEMBERS = [
  {
    id: "mom",
    name: "Mom (Eleanor)",
    relationship: "Parent • Age 74",
    avatarBg: "bg-teal-100 text-[#0E6156]",
    activeJourney: "Cardiology follow-up",
    nextEvent: "Thursday at 10:15 AM",
    provider: "Dr. Sarah Lin, MD • Bay Area Cardiovascular",
    statusBadge: "Confirmed",
    badgeVariant: "brand" as const,
    keyTasks: [
      "Referral received & in-network copay ($35) verified",
      "Wheelchair-accessible van transit scheduled for 9:30 AM",
      "Past ECG and blood panel forwarded to specialist",
    ],
    careGuideNote: "Elena R. confirmed Dr. Lin's clinic received Eleanor's referral.",
  },
  {
    id: "dad",
    name: "Dad (Robert)",
    relationship: "Parent • Age 76",
    avatarBg: "bg-amber-100 text-[#C87D2A]",
    activeJourney: "Medication refill",
    nextEvent: "Ready for pickup at Walgreens",
    provider: "Main St. Pharmacy • Refill #49281",
    statusBadge: "Action Ready",
    badgeVariant: "accent" as const,
    keyTasks: [
      "Atorvastatin 20mg (90-day renewal) authorized",
      "Prior authorization renewed with Medicare Advantage",
      "Sibling notification: Sibling David marked as pickup owner",
    ],
    careGuideNote: "Prior authorization delay resolved directly with plan supervisor.",
  },
  {
    id: "child",
    name: "Child (Leo)",
    relationship: "Dependent • Age 9",
    avatarBg: "bg-sky-100 text-[#1E6091]",
    activeJourney: "Pediatric appointment",
    nextEvent: "Friday at 3:30 PM",
    provider: "Dr. Amanda Chen, MD • Sunset Pediatrics",
    statusBadge: "Upcoming",
    badgeVariant: "neutral" as const,
    keyTasks: [
      "Annual wellness exam & 4th grade booster immunizations",
      "Sports physical clearance form pre-filled and attached",
      "Calendar sync alert set for school pickup",
    ],
    careGuideNote: "School nurse form pre-filled and sent to Dr. Chen's office.",
  },
  {
    id: "me",
    name: "Me (You)",
    relationship: "Personal Profile",
    avatarBg: "bg-stone-100 text-[#191716]",
    activeJourney: "Annual screening",
    nextEvent: "Completed last month",
    provider: "Dr. Elena Rostova, MD • Internal Medicine",
    statusBadge: "Complete",
    badgeVariant: "success" as const,
    keyTasks: [
      "Annual physical and routine blood panel completed",
      "Dermatology skin check cleared",
      "Next routine preventive review scheduled for next year",
    ],
    careGuideNote: "All personal preventive care up to date for 2026.",
  },
];

// 4 Use Cases Required by Brief
const USE_CASES = [
  {
    title: "Parents",
    tagline: "Keep up with appointments, medications, specialists, and follow-ups.",
    description:
      "When parents get older, managing their health often becomes a complex puzzle of multiple specialists, medication schedules, and mobility needs. CareLoop tracks every order, appointment, and doctor instruction so nothing slips through.",
    icon: Heart,
    color: "bg-teal-50 text-[#0E6156] border-teal-200",
    highlights: [
      "Medication schedules & refill tracking",
      "Coordination across cardiology, orthopedics, and neurology",
      "Wheelchair and transit logistics assistance",
    ],
  },
  {
    title: "Children",
    tagline: "Stay organized across pediatric visits, specialists, vaccinations, and more.",
    description:
      "From infant vaccinations and wellness milestones to pediatric dentists and developmental therapies, keeping track of children's records across busy work weeks is overwhelming. CareLoop puts all pediatric milestones in one clear timeline.",
    icon: Baby,
    color: "bg-sky-50 text-[#1E6091] border-sky-200",
    highlights: [
      "Immunization record tracking for school compliance",
      "Pediatric specialist referrals & speech/OT scheduling",
      "School sports clearance forms centralized",
    ],
  },
  {
    title: "Partners",
    tagline: "Coordinate care when life gets complicated.",
    description:
      "Whether your partner is recovering from unexpected surgery, managing a new chronic diagnosis, or going through physical therapy, you can share the administrative load without confusing each other's schedules.",
    icon: Users,
    color: "bg-amber-50 text-[#C87D2A] border-amber-200",
    highlights: [
      "Shared surgery recovery milestones & physical therapy checks",
      "Single place for pre-op instructions and post-op care notes",
      "Calendar sync for both partners so nobody misses a debrief",
    ],
  },
  {
    title: "Aging Loved Ones",
    tagline: "Help manage appointments, referrals, medications, and transitions in care.",
    description:
      "Supporting an elderly aunt, uncle, grandparent, or partner from across town or across the country. CareLoop bridges the distance with verified clinic updates and phone outreach by dedicated human Care Guides.",
    icon: Clock,
    color: "bg-rose-50 text-[#B91C1C] border-rose-200",
    highlights: [
      "Hospital-to-home post-discharge care coordination",
      "Proactive outreach to clinic staff when loved ones don't use smartphones",
      "Shared family visibility across siblings and legal guardians",
    ],
  },
];

export function ForFamiliesClient() {
  const [activeMemberId, setActiveMemberId] = useState<string>("mom");
  const currentMember = FAMILY_MEMBERS.find((m) => m.id === activeMemberId) || FAMILY_MEMBERS[0];

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
                <span>CareLoop for Families</span>
                <span className="text-[#0E6156]/40">•</span>
                <span className="font-normal text-[#5C5650]">Multi-member care coordination</span>
              </div>

              <H1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold tracking-[-0.03em] text-[#191716] leading-[1.12]">
                Care for them.
                <span className="block text-[#5C5650] font-normal mt-1">
                  Without losing track of everything.
                </span>
              </H1>

              <Lead className="text-base sm:text-lg text-[#5C5650] leading-relaxed max-w-2xl mx-auto font-normal">
                CareLoop helps families coordinate the details that come with caring for someone you love.
              </Lead>

              {/* Core Positioning Quote */}
              <div className="pt-2">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-[#E2DDD5] bg-white px-4 py-2 text-xs sm:text-sm font-medium text-[#191716] shadow-2xs">
                  <span>&ldquo;Because sometimes you&apos;re managing healthcare for more than one person.&rdquo;</span>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <Button size="lg" variant="primary" href="/join" rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Join the CareLoop
                </Button>
                <Button size="lg" variant="secondary" href="#product-visual">
                  See how it works
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* EMOTIONAL MESSAGE CALLOUT                                                 */}
        {/* ========================================================================= */}
        <section className="py-16 bg-white border-y border-[#E2DDD5]/60">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-[#C8E4DE] bg-gradient-to-br from-[#EBF5F3]/60 via-[#FDF6ED]/40 to-white p-8 sm:p-12 text-center shadow-soft space-y-4">
              <span className="inline-block rounded-full bg-[#0E6156] px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                The Caregiver Reality
              </span>

              <H2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#191716] leading-snug max-w-3xl mx-auto">
                &ldquo;Being a caregiver shouldn&apos;t mean becoming a full-time healthcare coordinator.&rdquo;
              </H2>

              <p className="text-sm sm:text-base text-[#5C5650] leading-relaxed max-w-2xl mx-auto">
                You already hold down a job, manage your own life, and carry the emotional weight of caring for a loved one. You shouldn&apos;t also have to spend 6 hours every week playing phone tag with clinic front desks, deciphering Medicare statements, and answering frantic group texts.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* PRODUCT VISUAL: MULTIPLE FAMILY MEMBERS OVERVIEW                           */}
        {/* ========================================================================= */}
        <section id="product-visual" className="py-20 bg-[#FAF8F5]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center mb-12">
              <Badge variant="brand" className="mb-3">
                Family Command Center
              </Badge>
              <H2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#191716] mb-4">
                Separate care journeys. One simple overview.
              </H2>
              <Lead className="text-sm sm:text-base text-[#5C5650]">
                CareLoop gives each family member an independent, private care journey while giving you a calm, unified overview of what needs attention.
              </Lead>
            </div>

            {/* Product UI Showcase Box */}
            <div className="mx-auto max-w-5xl rounded-3xl border border-[#E2DDD5] bg-white p-6 sm:p-10 shadow-elevated">
              {/* Member Selection Tabs */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-[#E2DDD5]/70 gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0E6156]">
                    Active Family Circle (4 Profiles)
                  </span>
                  <h3 className="text-lg font-bold text-[#191716] mt-0.5">Select a loved one to view their journey</h3>
                </div>

                {/* Member Switcher Pills */}
                <div className="flex flex-wrap gap-2">
                  {FAMILY_MEMBERS.map((member) => {
                    const isSelected = activeMemberId === member.id;
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => setActiveMemberId(member.id)}
                        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                          isSelected
                            ? "bg-[#0E6156] text-white shadow-soft"
                            : "bg-[#FAF8F5] text-[#5C5650] border border-[#E2DDD5] hover:bg-[#F4F0EB] hover:text-[#191716]"
                        }`}
                      >
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${member.avatarBg}`}>
                          {member.name.slice(0, 1)}
                        </span>
                        <span>{member.name.split(" ")[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Member Journey Detail View */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8 items-start">
                {/* Left 5 Columns: Member Identity & Status Card */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="rounded-2xl border-2 border-[#0E6156] bg-[#EBF5F3]/30 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-base font-bold shadow-xs ${currentMember.avatarBg}`}>
                          {currentMember.name.slice(0, 2)}
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-[#191716]">{currentMember.name}</h4>
                          <p className="text-xs text-[#5C5650]">{currentMember.relationship}</p>
                        </div>
                      </div>
                      <Badge variant={currentMember.badgeVariant} size="sm">
                        {currentMember.statusBadge}
                      </Badge>
                    </div>

                    <div className="pt-2 border-t border-[#C8E4DE]/70 space-y-1">
                      <span className="text-[11px] font-bold text-[#0E6156] uppercase tracking-wide">
                        Active Health Journey
                      </span>
                      <p className="text-sm font-bold text-[#191716]">
                        {currentMember.activeJourney}
                      </p>
                      <p className="text-xs text-[#5C5650] font-medium">
                        {currentMember.nextEvent}
                      </p>
                      <p className="text-[11px] text-[#8A8279] pt-1">
                        {currentMember.provider}
                      </p>
                    </div>
                  </div>

                  {/* Concierge Care Guide Touch */}
                  <div className="rounded-2xl border border-[#C8E4DE] bg-white p-4 text-xs text-[#0E6156] flex items-start gap-3 shadow-2xs">
                    <ShieldCheck className="h-4 w-4 text-[#0E6156] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-[#191716]">Care Guide Elena R.</span>
                      <p className="text-[#5C5650] mt-0.5 leading-relaxed">&ldquo;{currentMember.careGuideNote}&rdquo;</p>
                    </div>
                  </div>
                </div>

                {/* Right 7 Columns: Completed & In-Flight Tasks */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="rounded-2xl border border-[#E2DDD5] bg-[#FAF8F5] p-5 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#191716] block">
                      CareLoop Checklist for {currentMember.name.split(" ")[0]}
                    </span>

                    <div className="space-y-2.5">
                      {currentMember.keyTasks.map((task, tIdx) => (
                        <div
                          key={tIdx}
                          className="flex items-start gap-3 rounded-xl border border-[#E2DDD5] bg-white p-3 text-xs text-[#191716]"
                        >
                          <CheckCircle2 className="h-4 w-4 text-[#0E6156] shrink-0 mt-0.5" />
                          <span className="leading-relaxed font-medium">{task}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 flex items-center justify-between text-xs text-[#5C5650]">
                      <span className="inline-flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-[#0E6156]" />
                        <span>Consent-based family care authorization</span>
                      </span>
                      <Button size="sm" variant="outline" href="/join">
                        Add to your family circle
                      </Button>
                    </div>
                  </div>

                  {/* Fast Overview of all 4 members */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                    {FAMILY_MEMBERS.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => setActiveMemberId(m.id)}
                        className={`cursor-pointer rounded-xl border p-2.5 text-center transition-all ${
                          activeMemberId === m.id
                            ? "border-[#0E6156] bg-[#EBF5F3]/50 shadow-2xs"
                            : "border-[#E2DDD5] bg-white hover:border-[#0E6156]/40"
                        }`}
                      >
                        <p className="text-[11px] font-bold text-[#191716] truncate">{m.name.split(" ")[0]}</p>
                        <p className="text-[10px] text-[#0E6156] truncate mt-0.5">{m.activeJourney}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* USE CASES SECTION: PARENTS, CHILDREN, PARTNERS, AGING LOVED ONES          */}
        {/* ========================================================================= */}
        <section className="py-20 bg-white border-y border-[#E2DDD5]/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeader
              badge="Every Family Role"
              title="Tailored support for whoever depends on you"
              description="Healthcare needs change drastically across generations. CareLoop adapts to the unique requirements of every family member."
              align="center"
              className="mb-16"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {USE_CASES.map((uc, idx) => {
                const Icon = uc.icon;
                return (
                  <Card
                    key={idx}
                    variant="elevated"
                    padding="lg"
                    className="flex flex-col justify-between transition-all hover:shadow-card"
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${uc.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <H3 className="text-lg font-bold text-[#191716]">{uc.title}</H3>
                          <p className="text-xs font-semibold text-[#0E6156]">{uc.tagline}</p>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-[#5C5650] leading-relaxed mb-5">
                        {uc.description}
                      </p>

                      <div className="space-y-2 pt-2 border-t border-[#E2DDD5]/60">
                        {uc.highlights.map((h, hIdx) => (
                          <div key={hIdx} className="flex items-center gap-2 text-xs text-[#191716]">
                            <Check className="h-3.5 w-3.5 text-[#0E6156] shrink-0" />
                            <span>{h}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-[#E2DDD5]/60">
                      <Link
                        href="/join"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0E6156] hover:underline"
                      >
                        <span>Start managing care for {uc.title.toLowerCase()}</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SHARED VISIBILITY: NO MORE GROUP CHAT CHAOS                                */}
        {/* ========================================================================= */}
        <section className="py-20 bg-[#FAF8F5]">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <Badge variant="brand">Collaborative Family Care</Badge>
                <H2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#191716]">
                  No more frantic group texts asking &ldquo;Did someone take Mom?&rdquo;
                </H2>
                <p className="text-xs sm:text-sm text-[#5C5650] leading-relaxed">
                  CareLoop allows siblings, partners, and adult children to share task visibility without invading private medical records. Everyone knows who is assigned to drive, who picked up the prescription, and what the specialist recommended.
                </p>
                <ul className="space-y-2 text-xs text-[#191716] pt-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#0E6156]" />
                    <span>Clear owner assignment for rides and pharmacy pickups</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#0E6156]" />
                    <span>Plain-English visit debriefs shared with family members</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#0E6156]" />
                    <span>Granular privacy permissions tailored to family consent</span>
                  </li>
                </ul>
              </div>

              {/* Collaborative Task Card Mockup */}
              <div className="rounded-3xl border border-[#E2DDD5] bg-white p-6 shadow-soft space-y-3 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-[#E2DDD5]">
                  <span className="font-bold text-[#191716]">Shared Family Task Board</span>
                  <span className="text-[11px] text-[#0E6156] font-semibold">Today&apos;s Sync</span>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#0E6156] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[#191716]">Dr. Lin Cardiology Appointment</span>
                    <p className="text-[11px] text-[#5C5650]">Driver: Brother David • Attended at 10:15 AM</p>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 flex items-start gap-2.5">
                  <Clock className="h-4 w-4 text-[#C87D2A] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[#191716]">Walgreens Prescription Refill</span>
                    <p className="text-[11px] text-[#5C5650]">Assigned to: You • Ready on counter ($12 copay)</p>
                  </div>
                </div>

                <div className="rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] p-3 flex items-start gap-2.5">
                  <FileText className="h-4 w-4 text-[#8A8279] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[#191716]">Visit Summary Shared with Siblings</span>
                    <p className="text-[11px] text-[#5C5650]">Doctor notes summarized into 3 actionable steps</p>
                  </div>
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
          badge="Bring Peace of Mind to Your Family"
          title="Make healthcare easier for your family."
          description="Because sometimes you're managing healthcare for more than one person. Join CareLoop today and bring order to family caregiving."
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
