"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  PhoneOff,
  FileQuestion,
  DollarSign,
  CalendarX,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

const CONSUMER_QUESTIONS = [
  {
    q: "Which doctor should I see?",
    a: "CareLoop parses your referral or doctor note, identifies the exact sub-specialty required, and matches you with verified specialists who treat your condition.",
  },
  {
    q: "Is the provider covered by my insurance?",
    a: "We verify your network tier and benefits upfront, preventing unexpected out-of-network bills before you ever step through the clinic door.",
  },
  {
    q: "Is this urgent, or can it wait?",
    a: "CareLoop clarifies clinical timing from your referral (e.g. within 14 days vs. routine 90 days), prioritizing urgent follow-ups so nothing slips.",
  },
  {
    q: "What if appointments are months away?",
    a: "Our coordination engine monitors live cancellations, waitlists, and telehealth options across network practices to secure slots weeks sooner.",
  },
  {
    q: "What paperwork and prior auth do I need?",
    a: "CareLoop tracks prior authorizations directly with your insurer and gathers intake questionnaires in advance so your visit isn't cancelled at check-in.",
  },
  {
    q: "What if I can't afford it or need a ride?",
    a: "We identify copay assistance programs, sliding scales, and pre-scheduled transit rides to eliminate real-world access hurdles.",
  },
  {
    q: "What should I ask my doctor during the visit?",
    a: "CareLoop automatically prepares a concise 3-question visit guide tailored to your diagnosis so you leave feeling informed and empowered.",
  },
  {
    q: "What happens after the appointment?",
    a: "We close the loop: checking in with you, recording doctor instructions, tracking prescription fills, and scheduling ordered follow-up tests.",
  },
];

export function ExecutionGapSection() {
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  return (
    <section id="why-careloop" className="relative bg-white py-16 sm:py-24 border-y border-stone-200/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold tracking-wider uppercase text-stone-600">
            The Consumer Healthcare Crisis
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
            Healthcare has an execution gap.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-stone-600 sm:text-lg">
            Every year, millions of doctor recommendations, specialist referrals, and care plans
            vanish into a fragmented maze. The doctor writes a referral, but you are left to
            navigate insurance directories, endless phone tag, prior authorizations, and complex
            logistics entirely alone.
          </p>
        </div>

        {/* Side-by-Side Comparison: Status Quo vs CareLoop */}
        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Status Quo */}
          <div className="rounded-3xl border border-rose-200/80 bg-gradient-to-b from-rose-50/50 to-white p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs font-semibold tracking-wider uppercase text-rose-700">
                  The Broken Status Quo
                </span>
                <h3 className="text-xl font-bold text-stone-900">
                  Left to figure it out yourself
                </h3>
              </div>
            </div>

            <ul className="mt-6 space-y-4 text-sm text-stone-600">
              <li className="flex items-start gap-3">
                <PhoneOff className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                <div>
                  <strong className="text-stone-900">Endless Phone Trees &amp; Voicemails:</strong>{" "}
                  Calling 5 clinics only to find out they aren&apos;t taking new patients or don&apos;t accept your specific plan.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CalendarX className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                <div>
                  <strong className="text-stone-900">4-Month Wait Times:</strong>{" "}
                  Accepting distant appointment dates because nobody cross-checks nearby cancellations or alternative providers.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <DollarSign className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                <div>
                  <strong className="text-stone-900">Surprise Bills &amp; Prior Auth Denials:</strong>{" "}
                  Arriving at the clinic only to learn your prior authorization wasn&apos;t completed, risking a massive out-of-pocket invoice.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <FileQuestion className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                <div>
                  <strong className="text-stone-900">Zero Follow-Through:</strong>{" "}
                  After the appointment, nobody checks if the prescription was filled, what the next steps are, or whether your health improved.
                </div>
              </li>
            </ul>

            <div className="mt-8 rounded-2xl bg-rose-100/60 p-4 text-xs font-medium text-rose-900">
              <strong>The Result:</strong> High anxiety, delayed treatment, worsening conditions, and care that was recommended but never completed.
            </div>
          </div>

          {/* With CareLoop */}
          <div className="rounded-3xl border border-teal-200/90 bg-gradient-to-b from-teal-50/50 to-white p-6 sm:p-8 shadow-sm ring-1 ring-teal-600/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-800">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs font-semibold tracking-wider uppercase text-teal-800">
                  The CareLoop Solution
                </span>
                <h3 className="text-xl font-bold text-stone-900">
                  Guided, coordinated, and completed
                </h3>
              </div>
            </div>

            <ul className="mt-6 space-y-4 text-sm text-stone-700">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
                <div>
                  <strong className="text-stone-900">Direct In-Network Coordination:</strong>{" "}
                  CareLoop checks real-time availability, verifies insurance network status, and secures your slot without the phone tag.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
                <div>
                  <strong className="text-stone-900">Proactive Scheduling &amp; Fast-Tracking:</strong>{" "}
                  We match you with providers who have near-term openings and keep an eye on earlier cancellations.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
                <div>
                  <strong className="text-stone-900">Prior Auth &amp; Barrier Resolution:</strong>{" "}
                  We track insurance authorizations, arrange accessible rides, and translate paperwork into plain language.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
                <div>
                  <strong className="text-stone-900">End-to-End Loop Closure:</strong>{" "}
                  We prepare you for the visit, follow up afterwards, and ensure every doctor recommendation becomes a completed action.
                </div>
              </li>
            </ul>

            <div className="mt-8 rounded-2xl bg-teal-100/60 p-4 text-xs font-semibold text-teal-950">
              <strong>The Transformation:</strong> You feel supported, clear, and confident. Care moves forward on schedule.
            </div>
          </div>
        </div>

        {/* Real Questions CareLoop Solves (Interactive Explorer) */}
        <div className="mt-16 rounded-3xl border border-stone-200 bg-stone-50/80 p-6 sm:p-10">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-800">
              Everyday Healthcare Roadblocks
            </span>
            <h3 className="mt-2 text-2xl font-bold text-stone-900">
              What question are you stuck on right now?
            </h3>
            <p className="mt-1 text-sm text-stone-600">
              Click any question to see how CareLoop turns friction into a clear path forward.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Question Selector List */}
            <div className="space-y-2 lg:col-span-5">
              {CONSUMER_QUESTIONS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveQuestionIndex(idx)}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-xs font-medium transition-all ${
                    activeQuestionIndex === idx
                      ? "bg-teal-800 text-white shadow-xs"
                      : "bg-white text-stone-700 hover:bg-stone-100 border border-stone-200/70"
                  }`}
                >
                  <span className="pr-2">{item.q}</span>
                  <ArrowRight
                    className={`h-3.5 w-3.5 shrink-0 ${
                      activeQuestionIndex === idx ? "text-teal-200" : "text-stone-400"
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Answer & CareLoop Action Resolution */}
            <div className="flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-6 shadow-sm lg:col-span-7">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-800">
                  <HelpCircle className="h-4 w-4" />
                  <span>CareLoop Action Resolution</span>
                </div>

                <h4 className="mt-3 text-xl font-bold text-stone-900">
                  {CONSUMER_QUESTIONS[activeQuestionIndex].q}
                </h4>

                <p className="mt-4 text-sm leading-relaxed text-stone-700">
                  {CONSUMER_QUESTIONS[activeQuestionIndex].a}
                </p>

                <div className="mt-6 rounded-xl border border-teal-100 bg-teal-50/60 p-4 text-xs text-stone-700">
                  <div className="font-semibold text-teal-950">
                    How it feels with CareLoop:
                  </div>
                  <div className="mt-1 text-teal-900">
                    Instead of guessing or calling during your workday, you open your CareLoop roadmap, review verified options, and approve next actions with a single click.
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4 text-xs text-stone-500">
                <span>Part of the CareLoop Execution Framework</span>
                <span className="font-semibold text-teal-800">Action, Not Advice</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
