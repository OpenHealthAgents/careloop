"use client";

import React from "react";
import {
  ShieldCheck,
  UserCheck,
  Lock,
  HeartHandshake,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export function TrustSafetySection() {
  const trustPillars = [
    {
      icon: ShieldCheck,
      title: "Grounded Clinical Navigation",
      headline: "We follow your doctor's orders. We never guess.",
      description:
        "CareLoop is not a medical diagnosis bot and never dispenses speculative clinical advice. We strictly take the care plan, referrals, and recommendations created by your licensed clinical team and ensure they actually get completed.",
    },
    {
      icon: UserCheck,
      title: "Seamless Human Escalation",
      headline: "Real navigators when technology isn't enough.",
      description:
        "Whenever an appointment requires nuanced advocacy, clinical clarification, or personal support, you are immediately connected to licensed nurse navigators and care coordinators who can step in, make calls, and advocate on your behalf.",
    },
    {
      icon: Lock,
      title: "Privacy & Healthcare Standards",
      headline: "Your health records belong strictly to you.",
      description:
        "We treat your health information with institutional security: bank-grade encryption in transit and at rest, strict role-based access, and adherence to healthcare privacy protocols. Your personal health data is never sold to advertisers.",
    },
    {
      icon: HeartHandshake,
      title: "Empathetic, Calm Communication",
      headline: "Designed to de-escalate healthcare anxiety.",
      description:
        "Healthcare is already stressful enough. Every alert, message, and guide in CareLoop is designed with calm editorial care — avoiding clinical jargon, alarmist notifications, and confusing insurance acronyms.",
    },
  ];

  return (
    <section className="relative bg-stone-50 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-teal-100 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-teal-900">
            Trust &amp; Safety by Design
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
            Intelligent guidance. Genuine human care.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-stone-600 sm:text-lg">
            Navigating healthcare requires more than algorithms. It requires accountability,
            strict clinical guardrails, and real human support when it matters most.
          </p>
        </div>

        {/* 4 Pillars Grid */}
        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
          {trustPillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 shadow-xs transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-800 ring-1 ring-teal-200">
                    <Icon className="h-6 w-6" />
                  </div>

                  <span className="mt-4 inline-block text-xs font-bold uppercase tracking-wider text-teal-800">
                    {pillar.title}
                  </span>

                  <h3 className="mt-1 text-xl font-bold text-stone-900">
                    {pillar.headline}
                  </h3>

                  <p className="mt-3 text-sm leading-relaxed text-stone-600">
                    {pillar.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center gap-2 border-t border-stone-100 pt-4 text-xs font-medium text-stone-500">
                  <CheckCircle2 className="h-3.5 w-3.5 text-teal-700" />
                  <span>Verified CareLoop Architecture Standard</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Clinical Disclaimer Callout Box */}
        <div className="mt-12 rounded-2xl border border-stone-200 bg-white p-5 text-xs text-stone-600">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="leading-relaxed">
              <strong className="text-stone-900">Clinical Scope Notice:</strong> CareLoop is an
              intelligent healthcare navigation and execution companion. We partner with you to coordinate
              recommended appointments, verify insurance networks, arrange logistics, and prepare for visits.
              CareLoop does not provide emergency medical services or replace the clinical judgment of licensed physicians.
              If you believe you are experiencing a medical emergency, please call 911 or visit the nearest emergency department immediately.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
