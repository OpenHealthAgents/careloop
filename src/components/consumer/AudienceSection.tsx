"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  User,
  Users,
  Activity,
  HeartHandshake,
  ArrowRight,
} from "lucide-react";

interface AudiencePersona {
  id: string;
  badge: string;
  title: string;
  headline: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  keyChallenges: string[];
  careLoopBenefit: string;
  quote: string;
  linkText: string;
  linkHref: string;
}

const AUDIENCE_PERSONAS: AudiencePersona[] = [
  {
    id: "self",
    badge: "For Individuals",
    title: "Navigating for Yourself",
    headline: "Take control of your health without the endless hold music.",
    icon: User,
    description:
      "You were told you need to see a specialist, get an imaging scan, or start a new treatment plan. But between meetings, family, and daily life, who has 4 hours to sit on hold with clinic receptionists?",
    keyChallenges: [
      "No time to call during restrictive clinic business hours",
      "Uncertain which doctor is actually in your insurance network",
      "Dreading unexpected out-of-network bills and confusing paperwork",
    ],
    careLoopBenefit:
      "CareLoop acts as your proactive health execution partner: we research in-network specialists, verify live openings, hold your slot, and prepare you for the visit.",
    quote: "I used to put off specialist visits for months because making the calls was so exhausting. CareLoop had me booked in 10 minutes.",
    linkText: "Start navigating for yourself",
    linkHref: "/join",
  },
  {
    id: "family",
    badge: "For Caregivers & Families",
    title: "Caring for Parents or Loved Ones",
    headline: "Shared visibility and coordination for the people you love.",
    icon: Users,
    description:
      "Managing healthcare for an aging parent, spouse, or child is a second full-time job. You are coordinating across three clinics, chasing prescription refills, and worrying whether they have a ride to their appointment.",
    keyChallenges: [
      "Living in another city or managing complex schedules while working",
      "Tracking multiple doctors, discharge instructions, and follow-up tests",
      "Arranging wheelchair-accessible transportation and door-to-door escort",
    ],
    careLoopBenefit:
      "CareLoop provides a shared family care timeline. We coordinate appointments, dispatch transit rides, and notify family members the moment care is completed.",
    quote: "Living two hours away from my mom used to cause constant anxiety. CareLoop keeps our whole family on the same page.",
    linkText: "Explore family care coordination",
    linkHref: "/for-families",
  },
  {
    id: "chronic",
    badge: "For Ongoing Health",
    title: "Managing Chronic & Multi-Specialist Care",
    headline: "Keep complex care plans synchronized and moving forward.",
    icon: Activity,
    description:
      "When managing diabetes, cardiac recovery, autoimmune conditions, or behavioral health, you aren't just seeing one doctor — you are balancing endocrinologists, cardiologists, regular bloodwork, and physical therapists.",
    keyChallenges: [
      "Specialists failing to communicate or share records with one another",
      "Losing track of recurring lab orders and quarterly follow-up visits",
      "Complex medication schedules with frequent dosage adjustments",
    ],
    careLoopBenefit:
      "CareLoop connects the dots between care episodes: tracking physician recommendations across practices, scheduling ordered labs, and preventing dropped care plans.",
    quote: "When you have three specialists, care falls through the cracks constantly. CareLoop makes sure every test and visit actually happens.",
    linkText: "Learn about chronic care execution",
    linkHref: "/how-it-works",
  },
  {
    id: "barriers",
    badge: "Overcoming Roadblocks",
    title: "Access, Language & Cost Support",
    headline: "Healthcare navigation that meets you where you are.",
    icon: HeartHandshake,
    description:
      "Care fails most often when real-world roadblocks get in the way: unaffordable copays, lack of transportation, language translation barriers, or intimidating prior authorization forms.",
    keyChallenges: [
      "Spanish or multilingual language assistance needs",
      "Lack of reliable transportation to regional hospital campuses",
      "Fear of high deductible payments or sudden out-of-pocket costs",
    ],
    careLoopBenefit:
      "CareLoop identifies sliding scale programs, secures translation services, schedules transit vouchers, and clears insurance authorizations before your visit.",
    quote: "They made sure I understood everything in my primary language and arranged a ride so I didn't miss my cardiology visit.",
    linkText: "See how we resolve barriers",
    linkHref: "/why-careloop",
  },
];

export function AudienceSection() {
  const [activeTab, setActiveTab] = useState(0);
  const activePersona = AUDIENCE_PERSONAS[activeTab];

  return (
    <section className="relative bg-white py-16 sm:py-24 border-b border-stone-200/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-stone-100 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-stone-700">
            Tailored For Your Situation
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
            Who CareLoop is built for.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-stone-600 sm:text-lg">
            Whether you are coordinating care for yourself, managing a loved one&apos;s recovery,
            or navigating multiple doctors, CareLoop meets you with empathy, clarity, and action.
          </p>

          {/* Persona Tabs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {AUDIENCE_PERSONAS.map((p, idx) => {
              const Icon = p.icon;
              const isActive = activeTab === idx;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveTab(idx)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-teal-800 text-white shadow-md ring-2 ring-teal-700/50"
                      : "bg-white text-stone-700 hover:bg-stone-50 border border-stone-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{p.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Persona Featured Card */}
        <div className="mt-12 overflow-hidden rounded-3xl border border-stone-200 bg-stone-50/70 p-6 sm:p-10 shadow-sm">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left Column: Story & Challenges */}
            <div className="space-y-6 lg:col-span-7">
              <div>
                <span className="inline-block rounded-md bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-900">
                  {activePersona.badge}
                </span>
                <h3 className="mt-3 text-2xl font-bold text-stone-900 sm:text-3xl">
                  {activePersona.headline}
                </h3>
              </div>

              <p className="text-sm leading-relaxed text-stone-700 sm:text-base">
                {activePersona.description}
              </p>

              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Common Obstacles Faced
                </div>
                <ul className="mt-3 space-y-2 text-xs sm:text-sm text-stone-700">
                  {activePersona.keyChallenges.map((ch, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-teal-600" />
                      <span>{ch}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 text-xs sm:text-sm text-teal-950">
                <strong className="block font-semibold">How CareLoop Solves It:</strong>
                <p className="mt-1 leading-relaxed text-teal-900">
                  {activePersona.careLoopBenefit}
                </p>
              </div>

              <div>
                <Link
                  href={activePersona.linkHref}
                  className="inline-flex items-center gap-2 text-xs font-bold text-teal-800 hover:text-teal-950"
                >
                  <span>{activePersona.linkText}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Right Column: Empathy Quote & Feature Highlights */}
            <div className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-6 shadow-xs lg:col-span-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-teal-800">
                  The Lived Experience
                </div>

                <blockquote className="mt-4 border-l-2 border-teal-600 pl-4 text-sm italic leading-relaxed text-stone-700">
                  &ldquo;{activePersona.quote}&rdquo;
                </blockquote>

                <div className="mt-6 space-y-3">
                  <div className="rounded-xl bg-stone-50 p-3 text-xs">
                    <div className="font-semibold text-stone-900">
                      Intelligent Companion + Human Escalation
                    </div>
                    <div className="mt-0.5 text-stone-600">
                      Automated scheduling when it&apos;s simple; licensed nurse navigators when it&apos;s complex.
                    </div>
                  </div>

                  <div className="rounded-xl bg-stone-50 p-3 text-xs">
                    <div className="font-semibold text-stone-900">
                      Zero Insurance Guesswork
                    </div>
                    <div className="mt-0.5 text-stone-600">
                      Pre-verified network status, copay estimation, and prior authorization tracking.
                    </div>
                  </div>

                  <div className="rounded-xl bg-stone-50 p-3 text-xs">
                    <div className="font-semibold text-stone-900">
                      Family Sync &amp; Reminders
                    </div>
                    <div className="mt-0.5 text-stone-600">
                      Multi-user permissions so spouses and adult children can stay informed in real time.
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-stone-100 pt-4 text-xs text-stone-500">
                <span>CareLoop is designed for real people, not healthcare bureaucrats.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
