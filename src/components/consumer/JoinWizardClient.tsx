"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ConsumerHeader } from "@/components/consumer/ConsumerHeader";
import { ConsumerFooter } from "@/components/consumer/ConsumerFooter";
import {
  CheckCircle2,
  ArrowRight,
  User,
  Users,
  Activity,
  Calendar,
  AlertCircle,
} from "lucide-react";

export function JoinWizardClient() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [roleType, setRoleType] = useState<string>("SELF");
  const [primaryBarrier, setPrimaryBarrier] = useState<string>("FINDING_SPECIALIST");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [stateLocation, setStateLocation] = useState("");
  const [currentCareChallenge, setCurrentCareChallenge] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    confirmationId: string;
    carePlanSummary: {
      for: string;
      email: string;
      audience: string;
      focusBarrier: string;
      assignedStep: string;
      nextAction: string;
    };
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setError("Please provide your full name and email address.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          roleType,
          primaryBarrier,
          stateLocation: stateLocation.trim() || undefined,
          currentCareChallenge: currentCareChallenge.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to complete registration. Please check inputs.");
        return;
      }

      setResult(data);
      setStep(4);
    } catch {
      setError("Network error submitting request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 text-stone-900">
      <ConsumerHeader />

      <main id="main-content" className="flex-1 py-12 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center">
            <span className="inline-block rounded-full bg-teal-100 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-teal-900">
              Join the CareLoop
            </span>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
              Turn your care plan into completed care.
            </h1>
            <p className="mt-3 text-base text-stone-600">
              Know what to do. Know what happens next. Get it done.
            </p>
          </div>

          {/* Form Card */}
          <div className="mt-10 overflow-hidden rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
            {error && (
              <div className="mb-6 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* STEP 1: Audience */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-stone-900">
                    1. Who are you looking to coordinate care for?
                  </h2>
                  <p className="mt-1 text-xs text-stone-500">
                    CareLoop personalizes its action tools based on who needs care.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    {
                      id: "SELF",
                      label: "Myself",
                      desc: "Navigating my own health concerns, referrals, or specialist visits.",
                      icon: User,
                    },
                    {
                      id: "PARENT_OR_FAMILY",
                      label: "Parent or Family Member",
                      desc: "Managing care, appointments, or transportation for a loved one.",
                      icon: Users,
                    },
                    {
                      id: "CHRONIC_CARE",
                      label: "Ongoing / Chronic Care",
                      desc: "Balancing multiple ongoing treatments, medications, or therapy.",
                      icon: Activity,
                    },
                    {
                      id: "SPECIALIST_COORDINATION",
                      label: "Multiple Specialists",
                      desc: "Coordinating disparate doctors who need to share records and plans.",
                      icon: Calendar,
                    },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setRoleType(item.id)}
                      className={`flex flex-col text-left rounded-2xl border p-4 transition-all ${
                        roleType === item.id
                          ? "border-teal-700 bg-teal-50/70 shadow-xs ring-1 ring-teal-700"
                          : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                        <item.icon className="h-4 w-4 text-teal-700" />
                        <span>{item.label}</span>
                      </div>
                      <div className="mt-1 text-xs text-stone-600 leading-relaxed">
                        {item.desc}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-6 py-3 text-xs font-bold text-white hover:bg-teal-900 transition"
                  >
                    <span>Continue to Step 2</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Barrier */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-stone-900">
                    2. What is your primary healthcare roadblock?
                  </h2>
                  <p className="mt-1 text-xs text-stone-500">
                    Tell us what makes getting care difficult right now.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {[
                    {
                      id: "FINDING_SPECIALIST",
                      label: "Finding an In-Network Specialist",
                      desc: "Hard to verify which doctors accept my insurance and have openings.",
                    },
                    {
                      id: "SCHEDULING_WAIT",
                      label: "Long Wait Times & Phone Tag",
                      desc: "Offices offer appointments months away, or nobody calls back.",
                    },
                    {
                      id: "INSURANCE_COST",
                      label: "Prior Auth & Cost Uncertainty",
                      desc: "Worried about insurance rejections, deductibles, or unexpected bills.",
                    },
                    {
                      id: "UNDERSTANDING_REFERRAL",
                      label: "Making Sense of Doctor's Orders",
                      desc: "Confused by what the doctor diagnosed or what tests are really needed.",
                    },
                    {
                      id: "TRANSPORT_LOGISTICS",
                      label: "Transportation & Physical Access",
                      desc: "Need wheelchair assistance, rideshare coordination, or language help.",
                    },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPrimaryBarrier(item.id)}
                      className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-all ${
                        primaryBarrier === item.id
                          ? "border-teal-700 bg-teal-50/70 ring-1 ring-teal-700"
                          : "border-stone-200 bg-white hover:border-stone-300"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-stone-900">{item.label}</div>
                        <div className="text-[11px] text-stone-600">{item.desc}</div>
                      </div>
                      {primaryBarrier === item.id && (
                        <CheckCircle2 className="h-4 w-4 text-teal-700 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs font-semibold text-stone-500 hover:text-stone-800"
                  >
                    ← Back to Step 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-6 py-3 text-xs font-bold text-white hover:bg-teal-900 transition"
                  >
                    <span>Continue to Step 3</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Contact & Optional Notes */}
            {step === 3 && (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-stone-900">
                    3. Where should we send your CareLoop Action Plan?
                  </h2>
                  <p className="mt-1 text-xs text-stone-500">
                    We will prepare your personalized navigation steps and early access link.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="join-fullname" className="block text-xs font-medium text-stone-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      id="join-fullname"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Maria Gonzalez"
                      className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    />
                  </div>

                  <div>
                    <label htmlFor="join-email" className="block text-xs font-medium text-stone-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      id="join-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="maria@example.com"
                      className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    />
                  </div>

                  <div>
                    <label htmlFor="join-location" className="block text-xs font-medium text-stone-700 mb-1">
                      City / State (Optional, helps match nearby providers)
                    </label>
                    <input
                      id="join-location"
                      type="text"
                      value={stateLocation}
                      onChange={(e) => setStateLocation(e.target.value)}
                      placeholder="e.g. Austin, TX"
                      className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    />
                  </div>

                  <div>
                    <label htmlFor="join-challenge" className="block text-xs font-medium text-stone-700 mb-1">
                      Briefly describe what care you need (Optional)
                    </label>
                    <textarea
                      id="join-challenge"
                      rows={2}
                      value={currentCareChallenge}
                      onChange={(e) => setCurrentCareChallenge(e.target.value)}
                      placeholder="e.g. Need a neurologist for recurring migraines who takes Blue Cross"
                      className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-stone-50 p-3.5 text-[11px] text-stone-500 leading-relaxed">
                  CareLoop adheres strictly to patient privacy principles.
                  Your information is protected, never shared or sold, and strictly used to coordinate your care journey.
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-xs font-semibold text-stone-500 hover:text-stone-800"
                  >
                    ← Back to Step 2
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-6 py-3 text-xs font-bold text-white hover:bg-teal-900 transition disabled:opacity-50"
                  >
                    {loading ? (
                      <span>Personalizing Care Plan...</span>
                    ) : (
                      <>
                        <span>Join the CareLoop</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 4: Success Receipt */}
            {step === 4 && result && (
              <div className="space-y-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="h-10 w-10" />
                </div>

                <div>
                  <span className="rounded-md bg-stone-100 px-3 py-1 font-mono text-xs font-bold text-stone-800">
                    Registration Code: #{result.confirmationId}
                  </span>
                  <h3 className="mt-3 text-2xl font-bold text-stone-900">
                    You are in the CareLoop, {result.carePlanSummary.for}!
                  </h3>
                  <p className="mt-1 text-sm text-stone-600">
                    We have generated your personalized onboarding roadmap and sent it to{" "}
                    <strong className="text-stone-900">{result.carePlanSummary.email}</strong>.
                  </p>
                </div>

                <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-5 text-left text-xs text-stone-700 space-y-3">
                  <div className="font-bold text-teal-950 uppercase tracking-wide">
                    Your Personalized Care Summary
                  </div>
                  <div className="flex justify-between border-b border-teal-100 pb-2">
                    <span className="text-stone-500">Care Focus:</span>
                    <span className="font-bold text-stone-900">
                      {result.carePlanSummary.audience}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-teal-100 pb-2">
                    <span className="text-stone-500">Starting Step:</span>
                    <span className="font-bold text-teal-800">
                      Phase 1: UNDERSTAND
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block mb-1">Assigned Action:</span>
                    <span className="font-medium text-stone-800">
                      {result.carePlanSummary.nextAction}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    href="/"
                    className="inline-block rounded-xl bg-teal-800 px-6 py-3 text-xs font-bold text-white hover:bg-teal-900 transition"
                  >
                    Return to Homepage
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <ConsumerFooter />
    </div>
  );
}
