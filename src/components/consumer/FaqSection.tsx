"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    q: "Is CareLoop a doctor, or does it diagnose medical conditions?",
    a: "No. CareLoop is an intelligent healthcare execution companion, not a medical provider. We do not diagnose conditions or give speculative clinical advice. Instead, we take the care plan, referrals, and recommendations created by your licensed doctors and ensure they actually get done — finding in-network specialists, booking appointments, clearing insurance barriers, and supporting follow-through.",
  },
  {
    q: "How does CareLoop differ from my health insurance company's website?",
    a: "Health insurance directories are notoriously frustrating: static lists of doctors where up to 40% of listings have wrong phone numbers, aren't taking new patients, or have moved. Furthermore, insurance sites don't make appointments for you. CareLoop actively executes: checking live clinic availability, holding slots, resolving prior authorizations, arranging rides, and preparing you for the appointment.",
  },
  {
    q: "Can I use CareLoop to coordinate care for an aging parent, spouse, or child?",
    a: "Yes. Family care coordination is one of our primary use cases. CareLoop gives adult caregivers a shared timeline with permissions for multiple family members. You can view upcoming visits, track doctor recommendations, arrange wheelchair-accessible transportation, and receive post-visit summaries, giving you peace of mind even if you live miles away.",
  },
  {
    q: "What happens if my care situation gets complicated? Can I talk to a real person?",
    a: "Absolutely. CareLoop pairs intelligent automation with licensed human care navigators and registered nurses. Whenever a clinical situation requires nuanced advocacy, insurance appeals, or personal coordination, a dedicated human navigator steps in to make calls, speak with clinics, and guide you every step of the way.",
  },
  {
    q: "How does CareLoop handle prior authorizations and insurance coverage?",
    a: "Prior authorization denials and delays are one of the biggest reasons care falls apart. CareLoop tracks authorizations directly with your insurer, ensures your doctor's office submits supporting clinical notes, and alerts you before your visit so you never face surprise out-of-pocket invoices.",
  },
  {
    q: "How much does CareLoop cost?",
    a: "CareLoop is available directly to consumers through flexible family plans, and is also sponsored as a covered benefit by leading health plans and employers. You can start exploring your care roadmap and matching providers at zero upfront cost.",
  },
  {
    q: "How is my personal health information protected?",
    a: "We adhere to the highest institutional healthcare data security standards. Your data is encrypted with AES-256 encryption at rest and in transit, protected by strict role-based access controls, and strictly maintained in confidential compliance with healthcare privacy protocols. We will never sell your health data to advertisers.",
  },
  {
    q: "What happens after my appointment is over?",
    a: "CareLoop believes care isn't complete when you leave the exam room. We check in with you after the visit, capture your physician's next steps, track prescription fulfillment at your local pharmacy, and proactively schedule secondary orders such as physical therapy, labs, or follow-up imaging.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  function toggleIndex(idx: number) {
    setOpenIndex(openIndex === idx ? null : idx);
  }

  return (
    <section id="faq" className="relative bg-white py-16 sm:py-24 border-b border-stone-200/70">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <span className="inline-block rounded-full bg-stone-100 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-stone-700">
            Frequently Asked Questions
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
            Everything you need to know about CareLoop.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-stone-600">
            Clear, honest answers to help you understand how we help turn healthcare
            recommendations into completed care.
          </p>
        </div>

        {/* Accordion List */}
        <div className="mt-12 space-y-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="overflow-hidden rounded-2xl border border-stone-200 transition-all hover:border-stone-300"
              >
                <button
                  type="button"
                  onClick={() => toggleIndex(idx)}
                  className="flex w-full items-center justify-between bg-stone-50/60 p-5 text-left transition-colors hover:bg-stone-50"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-bold text-stone-900 pr-4 sm:text-base">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-stone-500 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-teal-800" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-stone-100 bg-white p-5 text-xs sm:text-sm leading-relaxed text-stone-600 animate-fade-in">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Still have questions card */}
        <div className="mt-10 rounded-2xl border border-teal-100 bg-teal-50/60 p-5 text-center text-xs text-stone-700">
          <span className="font-semibold text-teal-950">Have a specific question about your care plan?</span>{" "}
          <span>Our care navigation team is here to assist with any questions.</span>
        </div>
      </div>
    </section>
  );
}
