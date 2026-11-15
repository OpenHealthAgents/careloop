"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Compass,
  HeartHandshake,
} from "lucide-react";
import { CareCompanionPreview } from "./CareCompanionPreview";

interface HeroSectionProps {
  onOpenJoinModal?: () => void;
}

export function HeroSection({ onOpenJoinModal }: HeroSectionProps) {
  function scrollToJourney() {
    const el = document.getElementById("journey");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <section className="relative pt-8 pb-16 sm:pt-14 sm:pb-24 lg:pt-20 lg:pb-32 border-b border-[#E2DDD5]/60 bg-gradient-to-b from-[#FAF8F5] to-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Editorial Eyebrow & Headline */}
        <div className="mx-auto max-w-3xl text-center">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-teal-50 px-3.5 py-1 text-xs font-semibold text-teal-900 shadow-2xs">
            <span>Healthcare Follow-Through</span>
            <span className="text-teal-400">•</span>
            <span className="font-normal text-teal-800">From referral to completed visit</span>
          </div>

          {/* Main Headline */}
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
            Healthcare is complicated.{" "}
            <span className="block text-teal-800 sm:inline">
              Getting care shouldn&apos;t be.
            </span>
          </h1>

          {/* Subheading with Core Idea */}
          <p className="mt-5 text-lg leading-relaxed text-stone-600 sm:text-xl">
            Healthcare has gotten good at identifying what care people need. The problem
            is that recommendations, referrals, and care plans too often fail to become{" "}
            <strong className="font-semibold text-stone-900">completed care</strong>.
            CareLoop bridges that execution gap — from knowing what to do, to actually
            getting it done.
          </p>

          {/* Emotional Transformation Pill Bar */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-stone-600">
            <span className="rounded-full bg-stone-100 px-3 py-1">Overwhelmed → Clear</span>
            <span className="text-stone-300">•</span>
            <span className="rounded-full bg-stone-100 px-3 py-1">Uncertain → Confident</span>
            <span className="text-stone-300">•</span>
            <span className="rounded-full bg-stone-100 px-3 py-1">Stuck → Moving</span>
            <span className="text-stone-300">•</span>
            <span className="rounded-full bg-stone-100 px-3 py-1">Alone → Supported</span>
          </div>

          {/* Dual CTAs */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            {onOpenJoinModal ? (
              <button
                type="button"
                onClick={onOpenJoinModal}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-teal-800 px-7 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-teal-900 hover:shadow-lg active:scale-98 sm:w-auto"
              >
                <span>Join the CareLoop</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <Link
                href="/join"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-teal-800 px-7 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-teal-900 hover:shadow-lg active:scale-98 sm:w-auto"
              >
                <span>Join the CareLoop</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}

            <button
              type="button"
              onClick={scrollToJourney}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-stone-300 bg-white/90 px-6 py-3.5 text-sm font-semibold text-stone-700 shadow-2xs transition hover:bg-stone-50 hover:text-stone-900 active:scale-98 sm:w-auto"
            >
              <span>See how CareLoop works</span>
              <Compass className="h-4 w-4 text-teal-700" />
            </button>
          </div>

          {/* Trust Guarantees */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-stone-500">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-teal-700" />
              Rigorous patient privacy safeguards
            </span>
            <span className="inline-flex items-center gap-1.5">
              <HeartHandshake className="h-4 w-4 text-teal-700" />
              Licensed human care navigators on standby
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-teal-700" />
              Personalized to your health insurance
            </span>
          </div>
        </div>

        {/* Product UI / Companion Interactive Preview */}
        <div className="mt-12 sm:mt-16">
          <CareCompanionPreview />
        </div>
      </div>
    </section>
  );
}
