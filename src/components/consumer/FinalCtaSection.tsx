"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  HeartHandshake,
} from "lucide-react";

interface FinalCtaSectionProps {
  onOpenJoinModal?: () => void;
}

export function FinalCtaSection({ onOpenJoinModal }: FinalCtaSectionProps) {
  return (
    <section className="relative overflow-hidden bg-teal-900 py-16 sm:py-24 text-white">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/40 bg-teal-800/80 px-3.5 py-1 text-xs font-semibold text-teal-200">
          <span>Healthcare Follow-Through</span>
        </div>

        <h2 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
          Turn your healthcare recommendations into{" "}
          <span className="text-teal-200 underline decoration-teal-400 underline-offset-8">
            completed care.
          </span>
        </h2>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-teal-100 sm:text-lg">
          No more guessing, no more holding on the phone for hours, and no more lost
          referrals. Experience the calm of knowing what to do, knowing what happens next,
          and having a companion that helps you get it done.
        </p>

        {/* CTA Interaction */}
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {onOpenJoinModal ? (
            <button
              type="button"
              onClick={onOpenJoinModal}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-bold text-teal-950 shadow-lg transition hover:bg-teal-50 hover:shadow-xl active:scale-98"
            >
              <span>Join the CareLoop</span>
              <ArrowRight className="h-4 w-4 text-teal-800" />
            </button>
          ) : (
            <Link
              href="/join"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-bold text-teal-950 shadow-lg transition hover:bg-teal-50 hover:shadow-xl active:scale-98"
            >
              <span>Join the CareLoop</span>
              <ArrowRight className="h-4 w-4 text-teal-800" />
            </Link>
          )}

          <Link
            href="/how-it-works"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-teal-400/40 bg-teal-800/60 px-7 py-4 text-sm font-semibold text-white transition hover:bg-teal-800 hover:border-teal-300 active:scale-98"
          >
            <span>Explore The 5-Step Journey</span>
          </Link>
        </div>

        {/* Trust Points */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-teal-200">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-teal-300" />
            Strict patient privacy safeguards
          </span>
          <span className="inline-flex items-center gap-1.5">
            <HeartHandshake className="h-4 w-4 text-teal-300" />
            Personal human care navigator support
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-teal-300" />
            No hidden costs to explore
          </span>
        </div>
      </div>
    </section>
  );
}
