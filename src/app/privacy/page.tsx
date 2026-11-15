import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Lock, ShieldCheck, EyeOff } from "lucide-react";
import { Navigation } from "@/components/design-system/Navigation";
import { Footer } from "@/components/design-system/Footer";
import {
  Badge,
  Card,
  H1,
  H2,
  Lead,
  Small,
} from "@/components/design-system";

import { SITE_CONFIG } from "@/lib/seo/config";

export const metadata: Metadata = {
  title: "Privacy Policy: Health Information & Data Rights",
  description:
    "Plain-English explanation of how CareLoop protects your personal health navigation information with rigorous data safeguards and zero advertising sales.",
  alternates: {
    canonical: `${SITE_CONFIG.url}/privacy`,
  },
  openGraph: {
    title: "CareLoop Privacy Policy — Protecting Your Health Information",
    description:
      "We never sell, rent, or monetize your health data. Learn our privacy protections and data rights.",
    url: `${SITE_CONFIG.url}/privacy`,
    type: "website",
  },
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF8F5] text-[#191716]">
      <Navigation />

      <main id="main-content" className="flex-1">
        {/* Header */}
        <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-20 border-b border-[#E2DDD5]/60 bg-white">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
            <Badge variant="brand" className="mb-4">
              Data Dignity & Security
            </Badge>
            <H1 className="mb-4">CareLoop Privacy Policy</H1>
            <Lead className="mb-4">
              Your health information is personal. We believe you deserve transparent, plain-English terms, rigorous security safeguards, and a strict promise that your data is never sold.
            </Lead>
            <Small className="text-[#8A8279]">
              Effective Date: November 15, 2026 • Version 2.1
            </Small>
          </div>
        </section>

        {/* Core Promises Callout */}
        <section className="py-12 bg-[#FAF8F5]">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card variant="highlight" padding="md" className="border-[#0E6156]/30 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <EyeOff className="h-4 w-4 text-[#0E6156]" />
                  <span className="text-xs font-bold text-[#0E6156]">Zero Data Sales</span>
                </div>
                <p className="text-xs text-[#5C5650] leading-relaxed">
                  We never sell, rent, or trade your medical inquiries or profile to advertisers or brokers.
                </p>
              </Card>

              <Card variant="highlight" padding="md" className="border-[#0E6156]/30 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="h-4 w-4 text-[#0E6156]" />
                  <span className="text-xs font-bold text-[#0E6156]">AES-256 Encryption</span>
                </div>
                <p className="text-xs text-[#5C5650] leading-relaxed">
                  All stored records and transmission channels are protected by modern cryptographic standards.
                </p>
              </Card>

              <Card variant="highlight" padding="md" className="border-[#0E6156]/30 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="h-4 w-4 text-[#0E6156]" />
                  <span className="text-xs font-bold text-[#0E6156]">You Own Your Data</span>
                </div>
                <p className="text-xs text-[#5C5650] leading-relaxed">
                  Export your coordinated plans or permanently purge your account at any moment.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Detailed Sections in Plain English */}
        <section className="py-12 pb-24 bg-white border-t border-[#E2DDD5]/60">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-12 text-[#5C5650] leading-relaxed text-sm sm:text-base">
            <div>
              <H2 className="text-xl font-bold text-[#191716] mb-3">1. Information We Collect</H2>
              <p className="mb-4">
                To help navigate and coordinate your healthcare, CareLoop collects information you provide directly to us:
              </p>
              <ul className="space-y-2 list-disc pl-5 text-xs sm:text-sm">
                <li>
                  <strong>Contact & Profile Information:</strong> Your name, email, phone number, and state/region.
                </li>
                <li>
                  <strong>Care Coordination Needs:</strong> Doctor referral notes, appointment dates, preferred clinic locations, and insurance carrier name (used exclusively to verify provider network tiers).
                </li>
                <li>
                  <strong>Family Profiles (Optional):</strong> If you coordinate care for parents or dependents, you may store their scheduling details with authorized consent.
                </li>
              </ul>
            </div>

            <div className="border-t border-[#E2DDD5]/60 pt-8">
              <H2 className="text-xl font-bold text-[#191716] mb-3">2. How We Use Your Information</H2>
              <p className="mb-4">
                We use your data solely to deliver, coordinate, and execute healthcare navigation services:
              </p>
              <ul className="space-y-2 list-disc pl-5 text-xs sm:text-sm">
                <li>Cross-referencing insurance directories to verify provider in-network status.</li>
                <li>Transmitting appointment requests to clinic scheduling offices on your behalf.</li>
                <li>Sending pre-visit briefings and after-care medication/lab reminders.</li>
                <li>Enabling human Care Guides to assist you when scheduling stalls.</li>
              </ul>
            </div>

            <div className="border-t border-[#E2DDD5]/60 pt-8">
              <H2 className="text-xl font-bold text-[#191716] mb-3">3. How Information Is Shared</H2>
              <p className="mb-3">
                <strong>We do not share or sell your information to advertisers, third-party data brokers, or prospective employers.</strong>
              </p>
              <p className="text-xs sm:text-sm mb-3">
                Information is only shared under these strict circumstances:
              </p>
              <ul className="space-y-2 list-disc pl-5 text-xs sm:text-sm">
                <li>
                  <strong>With Healthcare Providers:</strong> When you authorize us to book an appointment, we provide your necessary intake details (name, contact, insurance policy ID) directly to the medical office.
                </li>
                <li>
                  <strong>With Secure Infrastructure Partners:</strong> Trusted, HIPAA-compliant cloud hosting and encrypted SMS communication vendors operating under signed Business Associate Agreements (BAAs).
                </li>
                <li>
                  <strong>As Required by Law:</strong> When required to comply with a valid court order or statutory requirement.
                </li>
              </ul>
            </div>

            <div className="border-t border-[#E2DDD5]/60 pt-8">
              <H2 className="text-xl font-bold text-[#191716] mb-3">4. Security & Safeguards</H2>
              <p className="text-xs sm:text-sm">
                CareLoop implements multi-layered security protocols including AES-256 data encryption at rest, TLS 1.3 encryption in transit, strict role-based access controls for human staff, and continuous vulnerability monitoring.
              </p>
            </div>

            <div className="border-t border-[#E2DDD5]/60 pt-8">
              <H2 className="text-xl font-bold text-[#191716] mb-3">5. Your Data Rights & Deletion</H2>
              <p className="text-xs sm:text-sm mb-3">
                You retain complete sovereignty over your health information:
              </p>
              <ul className="space-y-2 list-disc pl-5 text-xs sm:text-sm">
                <li>You may request an export of all coordinated history at any time.</li>
                <li>You may request permanent deletion of your account and personal identifiers by emailing privacy@careloop.health.</li>
              </ul>
            </div>

            <div className="border-t border-[#E2DDD5]/60 pt-8">
              <H2 className="text-xl font-bold text-[#191716] mb-3">6. Questions & Contact</H2>
              <p className="text-xs sm:text-sm">
                If you have questions about this Privacy Policy or our security standards, contact our privacy officer at <a href="mailto:privacy@careloop.health" className="text-[#0E6156] font-semibold hover:underline">privacy@careloop.health</a> or visit our <Link href="/contact" className="text-[#0E6156] font-semibold hover:underline">Contact Page</Link>.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
