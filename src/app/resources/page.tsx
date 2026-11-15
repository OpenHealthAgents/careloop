import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
} from "lucide-react";
import { Navigation } from "@/components/design-system/Navigation";
import { Footer } from "@/components/design-system/Footer";
import {
  Badge,
  CtaSection,
  H1,
  Lead,
} from "@/components/design-system";
import { EDUCATIONAL_GUIDES } from "@/lib/resources/guides";
import { SITE_CONFIG } from "@/lib/seo/config";

export const metadata: Metadata = {
  title: "Educational Healthcare Guides & Navigation Resources",
  description:
    "Plain-English educational guides on healthcare navigation, family caregiving, specialist referrals, appointment preparation, and care coordination.",
  alternates: {
    canonical: `${SITE_CONFIG.url}/resources`,
  },
  openGraph: {
    title: "Healthcare Navigation & Care Coordination Guides — CareLoop",
    description:
      "Actionable, plain-English guidance to help you navigate doctor appointments, specialist referrals, caregiver tasks, and health follow-through.",
    url: `${SITE_CONFIG.url}/resources`,
    type: "website",
  },
};

export default function ResourcesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF8F5] text-[#191716] selection:bg-[#EBF5F3] selection:text-[#0E6156]">
      <Navigation />

      <main id="main-content" className="flex-1">
        {/* ========================================================================= */}
        {/* HERO SECTION                                                              */}
        {/* ========================================================================= */}
        <section className="relative pt-12 pb-14 md:pt-20 md:pb-20 border-b border-[#E2DDD5]/60 bg-gradient-to-b from-[#FAF8F5] to-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0E6156]/20 bg-[#EBF5F3] px-3.5 py-1 text-xs font-semibold text-[#0E6156]">
                <span>Patient Navigation &amp; Care Guidance</span>
                <span className="text-[#0E6156]/40">•</span>
                <span className="font-normal text-[#5C5650]">Practical healthcare roadmaps</span>
              </div>

              <H1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-[-0.03em] text-[#191716]">
                Educational Healthcare Guides
              </H1>

              <Lead className="text-sm sm:text-base md:text-lg text-[#5C5650] max-w-2xl mx-auto leading-relaxed font-normal">
                Clear, actionable insights to help you navigate specialist referrals, coordinate family care, prepare for appointments, and close the execution gap.
              </Lead>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* GUIDES GRID                                                               */}
        {/* ========================================================================= */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {EDUCATIONAL_GUIDES.map((guide) => (
                <article
                  key={guide.slug}
                  className="rounded-3xl border border-[#E2DDD5] bg-white p-6 shadow-soft flex flex-col justify-between transition-all hover:shadow-card hover:border-[#C7C0B5]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#0E6156] bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                        {guide.category}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-[#8A8279]">
                        <Clock className="h-3 w-3" />
                        {guide.readTime}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-[#191716] leading-snug mb-2">
                      <Link
                        href={`/resources/${guide.slug}`}
                        className="hover:text-[#0E6156] transition-colors"
                      >
                        {guide.title}
                      </Link>
                    </h2>

                    <p className="text-xs sm:text-sm text-[#5C5650] leading-relaxed line-clamp-3">
                      {guide.summary}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#E2DDD5]/70 flex items-center justify-between">
                    <span className="text-[11px] text-[#8A8279]">{guide.publishedDate}</span>
                    <Link
                      href={`/resources/${guide.slug}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#0E6156] hover:underline"
                    >
                      <span>Read Guide</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* CLOSING CONVERSION CTA                                                    */}
        {/* ========================================================================= */}
        <CtaSection
          variant="brandDark"
          badge="Close the Execution Gap"
          title="Turn healthcare recommendations into completed care."
          description="CareLoop doesn't stop at information. We stay with you through scheduling, appointment prep, and follow-through."
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
