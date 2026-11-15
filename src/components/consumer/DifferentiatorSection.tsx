"use client";

import React from "react";
import {
  Check,
  X,
  Sparkles,
  Bot,
  Building,
  ShieldCheck,
} from "lucide-react";

interface FeatureRow {
  capability: string;
  genericChatbot: boolean | string;
  insurancePortal: boolean | string;
  careLoop: boolean | string;
  whyItMatters: string;
}

const COMPARISON_ROWS: FeatureRow[] = [
  {
    capability: "Real Appointment Booking & Coordination",
    genericChatbot: false,
    insurancePortal: "Manual dial only",
    careLoop: "Direct coordination with verified clinics",
    whyItMatters: "Eliminates 3+ hours of phone tag and hold music.",
  },
  {
    capability: "Verified In-Network Provider Matching",
    genericChatbot: false,
    insurancePortal: "Outdated directory PDFs",
    careLoop: "Real-time verified availability & network tier",
    whyItMatters: "Prevents surprise out-of-network bills and ghost providers.",
  },
  {
    capability: "Logistical Support (Rides, Intake, Language)",
    genericChatbot: false,
    insurancePortal: false,
    careLoop: "Transportation vouchers, translation, & forms",
    whyItMatters: "Overcomes the real-life barriers that cause missed care.",
  },
  {
    capability: "Personalized Pre-Visit Preparation Guides",
    genericChatbot: "Generic text wall",
    insurancePortal: false,
    careLoop: "Custom questions & records checklist for your visit",
    whyItMatters: "Ensures your doctor has prior scans and answers your concerns.",
  },
  {
    capability: "Proactive Follow-Through & Loop Closure",
    genericChatbot: false,
    insurancePortal: false,
    careLoop: "Post-visit check-ins, rx pickup, & next orders",
    whyItMatters: "Prevents drop-off between visits and keeps recovery on track.",
  },
  {
    capability: "Licensed Human Care Navigators on Standby",
    genericChatbot: false,
    insurancePortal: "Complex call centers",
    careLoop: "Dedicated RNs & navigators when you need help",
    whyItMatters: "You are never left alone when a situation requires human judgment.",
  },
  {
    capability: "Safe Clinical Guardrails (Never Fabricates Diagnoses)",
    genericChatbot: "High hallucination risk",
    insurancePortal: "No clinical guidance",
    careLoop: "Strictly navigates your doctor's care plan",
    whyItMatters: "Provides safe, trusted navigation without dangerous medical guessing.",
  },
];

export function DifferentiatorSection() {
  return (
    <section className="relative bg-white py-16 sm:py-24 border-y border-stone-200/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-teal-50 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-teal-800 ring-1 ring-teal-200">
            Beyond Advice • Real Execution
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
            Not just another healthcare chatbot.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-stone-600 sm:text-lg">
            A chatbot gives you a paragraph of generic text and tells you to &ldquo;call your
            doctor.&rdquo; An insurance directory gives you outdated phone numbers.
          </p>
          <div className="mt-4 inline-block rounded-2xl bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white shadow-xs">
            &ldquo;CareLoop doesn&apos;t just tell you what to do. It helps you get it done.&rdquo;
          </div>
        </div>

        {/* Comparison Matrix Table */}
        <div className="mt-14 overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/80 text-xs font-bold text-stone-700">
                  <th scope="col" className="p-4 sm:p-5 w-2/5">
                    Care Execution Capability
                  </th>
                  <th scope="col" className="p-4 sm:p-5 text-center text-stone-500 w-1/5">
                    <div className="flex items-center justify-center gap-1.5">
                      <Bot className="h-4 w-4" />
                      <span>Generic AI Chatbot</span>
                    </div>
                  </th>
                  <th scope="col" className="p-4 sm:p-5 text-center text-stone-500 w-1/5">
                    <div className="flex items-center justify-center gap-1.5">
                      <Building className="h-4 w-4" />
                      <span>Insurance Portal</span>
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="p-4 sm:p-5 text-center bg-teal-800 text-white font-extrabold w-1/5"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-teal-300" />
                      <span>CareLoop</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs sm:text-sm">
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`transition-colors ${
                      idx % 2 === 0 ? "bg-white" : "bg-stone-50/40"
                    } hover:bg-stone-50`}
                  >
                    {/* Capability column */}
                    <td className="p-4 sm:p-5">
                      <div className="font-semibold text-stone-900">{row.capability}</div>
                      <div className="mt-0.5 text-xs text-stone-500">{row.whyItMatters}</div>
                    </td>

                    {/* Generic Chatbot */}
                    <td className="p-4 sm:p-5 text-center text-stone-500">
                      {typeof row.genericChatbot === "boolean" ? (
                        row.genericChatbot ? (
                          <Check className="mx-auto h-4 w-4 text-emerald-600" />
                        ) : (
                          <X className="mx-auto h-4 w-4 text-stone-300" />
                        )
                      ) : (
                        <span className="text-xs text-stone-600">{row.genericChatbot}</span>
                      )}
                    </td>

                    {/* Insurance Portal */}
                    <td className="p-4 sm:p-5 text-center text-stone-500">
                      {typeof row.insurancePortal === "boolean" ? (
                        row.insurancePortal ? (
                          <Check className="mx-auto h-4 w-4 text-emerald-600" />
                        ) : (
                          <X className="mx-auto h-4 w-4 text-stone-300" />
                        )
                      ) : (
                        <span className="text-xs text-stone-600">{row.insurancePortal}</span>
                      )}
                    </td>

                    {/* CareLoop */}
                    <td className="p-4 sm:p-5 text-center bg-teal-50/60 font-semibold text-teal-950">
                      {typeof row.careLoop === "boolean" ? (
                        row.careLoop ? (
                          <Check className="mx-auto h-5 w-5 text-teal-700 stroke-[3]" />
                        ) : (
                          <X className="mx-auto h-4 w-4 text-stone-400" />
                        )
                      ) : (
                        <span className="text-xs font-semibold text-teal-900">
                          {row.careLoop}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Table Note */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-stone-200 bg-stone-50 px-5 py-3 text-xs text-stone-600">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal-700" />
              <span>
                CareLoop operates with clinical human-in-the-loop escalation whenever necessary.
              </span>
            </div>
            <span className="font-semibold text-teal-800">
              The execution gap closes when someone actually coordinates care.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
