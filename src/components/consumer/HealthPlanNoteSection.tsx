import React from "react";
import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";

export function HealthPlanNoteSection() {
  return (
    <section className="relative bg-stone-100/60 py-12 border-b border-stone-200/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-semibold text-stone-700">
                <Building2 className="h-3.5 w-3.5 text-stone-600" />
                <span>For Health Plans, Employers &amp; Care Systems</span>
              </div>
              <h3 className="mt-3 text-xl font-bold text-stone-900 sm:text-2xl">
                Closing the care execution gap at population scale.
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-stone-600 leading-relaxed">
                While our heart is consumer-first, CareLoop also partners with forward-thinking
                health plans, ACOs, and employer benefit leaders. We provide closed-loop referral
                visibility, reduce costly emergency room escalation, and bridge health equity
                disparities across underserved populations.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col shrink-0 gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-stone-800 transition"
              >
                <span>Care Operations Portal</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <span className="text-[11px] text-stone-500 text-center lg:text-left">
                Secured access for care teams &amp; clinicians
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
