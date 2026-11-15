import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Navigation } from "@/components/design-system/Navigation";
import { Footer } from "@/components/design-system/Footer";
import {
  Badge,
  H1,
  H2,
  Lead,
  Small,
} from "@/components/design-system";

import { SITE_CONFIG } from "@/lib/seo/config";

export const metadata: Metadata = {
  title: "Terms of Service: Platform Scope & Non-Diagnostic Limits",
  description:
    "Terms of service for CareLoop, outlining service scope, clinical non-diagnostic limits, and emergency medical protocols.",
  alternates: {
    canonical: `${SITE_CONFIG.url}/terms`,
  },
  openGraph: {
    title: "CareLoop Terms of Service — Platform Scope & Non-Diagnostic Limits",
    description:
      "CareLoop terms of service: health navigation scope, clinical non-diagnostic boundaries, and emergency protocols.",
    url: `${SITE_CONFIG.url}/terms`,
    type: "website",
  },
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF8F5] text-[#191716]">
      <Navigation />

      <main id="main-content" className="flex-1">
        {/* Header */}
        <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-20 border-b border-[#E2DDD5]/60 bg-white">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
            <Badge variant="brand" className="mb-4">
              Agreement & Terms
            </Badge>
            <H1 className="mb-4">CareLoop Terms of Service</H1>
            <Lead className="mb-4">
              Please read these terms carefully before using CareLoop. They outline our services, your responsibilities, and essential medical boundaries.
            </Lead>
            <Small className="text-[#8A8279]">
              Effective Date: November 15, 2026 • Version 2.0
            </Small>
          </div>
        </section>

        {/* Emergency & Non-Diagnostic Banner */}
        <section className="py-6 bg-[#FFFDF9] border-b border-amber-200">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-start gap-3 text-xs sm:text-sm text-[#191716]">
              <ShieldAlert className="h-5 w-5 text-[#C87D2A] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[#191716]">Critical Medical Notice: </span>
                <span className="text-[#5C5650]">
                  CareLoop provides administrative navigation, scheduling, and follow-through assistance. <strong>CareLoop is not a medical provider and does not provide clinical diagnoses, medical treatments, or emergency care.</strong> In the event of a medical emergency, call <strong>911</strong> immediately or visit the nearest emergency facility.
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Terms Content */}
        <section className="py-12 pb-24 bg-white">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-10 text-[#5C5650] leading-relaxed text-sm sm:text-base">
            <div>
              <H2 className="text-xl font-bold text-[#191716] mb-3">1. Scope of the Service</H2>
              <p className="mb-3">
                CareLoop operates an intelligent healthcare navigation and coordination platform. We assist individuals and family caregivers by:
              </p>
              <ul className="space-y-2 list-disc pl-5 text-xs sm:text-sm">
                <li>Searching in-network provider directories based on your declared health insurance.</li>
                <li>Facilitating appointment scheduling with third-party medical practices.</li>
                <li>Organizing visit checklists, reminder alerts, and after-care action plans.</li>
                <li>Providing non-clinical Care Guide support to assist with administrative bottlenecks.</li>
              </ul>
            </div>

            <div className="border-t border-[#E2DDD5]/60 pt-8">
              <H2 className="text-xl font-bold text-[#191716] mb-3">2. No Doctor-Patient Relationship</H2>
              <p className="text-xs sm:text-sm mb-3">
                Use of CareLoop does not establish a doctor-patient relationship. Content provided through our website, recommendations, or notifications is for informational and logistical purposes only.
              </p>
              <p className="text-xs sm:text-sm">
                Always consult your licensed healthcare provider regarding questions about your health, treatment plans, or clinical diagnoses. Never disregard professional medical advice or delay seeking care because of information received through CareLoop.
              </p>
            </div>

            <div className="border-t border-[#E2DDD5]/60 pt-8">
              <H2 className="text-xl font-bold text-[#191716] mb-3">3. Managing Care for Family Members</H2>
              <p className="text-xs sm:text-sm mb-3">
                If you use CareLoop to coordinate care on behalf of an aging parent, spouse, dependent child, or other individual:
              </p>
              <ul className="space-y-2 list-disc pl-5 text-xs sm:text-sm">
                <li>You affirm that you have appropriate legal authority, healthcare power of attorney, or voluntary consent to act as their healthcare coordinator.</li>
                <li>You agree to keep all health information shared with you strictly confidential.</li>
              </ul>
            </div>

            <div className="border-t border-[#E2DDD5]/60 pt-8">
              <H2 className="text-xl font-bold text-[#191716] mb-3">4. Accuracy of Information</H2>
              <p className="text-xs sm:text-sm">
                While CareLoop continuously audits provider network directories and clinic intake requirements, health insurance plans and clinics frequently alter provider participation without notice. CareLoop assists in verification, but cannot guarantee that a clinic will not modify its network status or scheduling availability.
              </p>
            </div>

            <div className="border-t border-[#E2DDD5]/60 pt-8">
              <H2 className="text-xl font-bold text-[#191716] mb-3">5. Termination & Account Deletion</H2>
              <p className="text-xs sm:text-sm">
                You may discontinue use of CareLoop at any time. You may request full deletion of your coordinated records by emailing privacy@careloop.health. CareLoop reserves the right to suspend accounts that violate these terms or abuse navigation services.
              </p>
            </div>

            <div className="border-t border-[#E2DDD5]/60 pt-8">
              <H2 className="text-xl font-bold text-[#191716] mb-3">6. Governing Law & Contact</H2>
              <p className="text-xs sm:text-sm">
                These terms are governed by the laws of the State of Delaware. For legal inquiries or questions regarding these terms, please contact legal@careloop.health or visit our <Link href="/contact" className="text-[#0E6156] font-semibold hover:underline">Contact Page</Link>.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
