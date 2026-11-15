"use client";

import React, { useState } from "react";
import {
  X,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  User,
  Users,
  Calendar,
  AlertCircle,
  HeartHandshake,
} from "lucide-react";

interface CareAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAudience?: string;
}

export function CareAssessmentModal({
  isOpen,
  onClose,
  initialAudience = "SELF",
}: CareAssessmentModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [roleType, setRoleType] = useState<string>(initialAudience);
  const [primaryBarrier, setPrimaryBarrier] = useState<string>("FINDING_SPECIALIST");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [stateLocation, setStateLocation] = useState("");
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

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setError("Please provide your name and a valid email address.");
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
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to process registration. Please check inputs.");
        return;
      }

      setResult(data);
      setStep(4); // Success step
    } catch {
      setError("Network error submitting request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setStep(1);
    setResult(null);
    setError(null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-headline"
    >
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl animate-fade-in">
        {/* Close Button */}
        <button
          type="button"
          onClick={handleReset}
          className="absolute right-4 top-4 rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="border-b border-stone-100 bg-stone-50/80 px-6 py-5 sm:px-8">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-800">
            <Sparkles className="h-4 w-4" />
            <span>Join the CareLoop • Early Access &amp; Personalized Roadmap</span>
          </div>
          <h3 id="modal-headline" className="mt-1 text-xl font-bold text-stone-900">
            {step === 4
              ? "Your Care Plan is Ready"
              : "Let’s personalize your CareLoop companion"}
          </h3>
          <p className="mt-1 text-xs text-stone-500">
            Step {step} of 3 • Know what to do. Know what happens next. Get it done.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Who are you navigating care for? */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-stone-800">
                1. Who are you currently navigating healthcare for?
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {[
                  {
                    id: "SELF",
                    label: "Myself",
                    desc: "Managing my own symptoms, doctor visits, or new referral.",
                    icon: User,
                  },
                  {
                    id: "PARENT_OR_FAMILY",
                    label: "Parent or Family Member",
                    desc: "Coordinating appointments & rides for an aging loved one or child.",
                    icon: Users,
                  },
                  {
                    id: "CHRONIC_CARE",
                    label: "Ongoing / Chronic Care",
                    desc: "Balancing regular treatments, labs, and specialty check-ups.",
                    icon: HeartHandshake,
                  },
                  {
                    id: "SPECIALIST_COORDINATION",
                    label: "Multiple Specialists",
                    desc: "Connecting disparate doctors who don't talk to each other.",
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
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-900"
                >
                  <span>Continue</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Primary Hurdle */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-stone-800">
                2. What is your biggest healthcare hurdle right now?
              </div>

              <div className="space-y-2">
                {[
                  {
                    id: "FINDING_SPECIALIST",
                    label: "Finding an In-Network Specialist",
                    desc: "Hard to know which doctor takes my insurance and is actually taking patients.",
                  },
                  {
                    id: "SCHEDULING_WAIT",
                    label: "Long Wait Times & Phone Tag",
                    desc: "Wait times are months out, or clinic phones go straight to voicemail.",
                  },
                  {
                    id: "INSURANCE_COST",
                    label: "Prior Auth & Cost Uncertainty",
                    desc: "Worried about surprise bills, out-of-network costs, or insurance denials.",
                  },
                  {
                    id: "UNDERSTANDING_REFERRAL",
                    label: "Making Sense of Doctor's Orders",
                    desc: "Not fully sure what my doctor recommended, why it matters, or what to do next.",
                  },
                  {
                    id: "TRANSPORT_LOGISTICS",
                    label: "Transportation, Transit or Mobility",
                    desc: "Getting to the clinic is difficult due to mobility, distance, or scheduling.",
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPrimaryBarrier(item.id)}
                    className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${
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
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-900"
                >
                  <span>Continue</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Contact & Unlock Roadmap */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-sm font-semibold text-stone-800">
                3. Where should we send your CareLoop Action Roadmap?
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor="modal-fullname" className="block text-xs font-medium text-stone-700 mb-1">
                    Your Full Name *
                  </label>
                  <input
                    id="modal-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                  />
                </div>

                <div>
                  <label htmlFor="modal-email" className="block text-xs font-medium text-stone-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    id="modal-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="sarah@example.com"
                    className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                  />
                </div>

                <div>
                  <label htmlFor="modal-statelocation" className="block text-xs font-medium text-stone-700 mb-1">
                    City or State (Optional, for provider matching)
                  </label>
                  <input
                    id="modal-statelocation"
                    type="text"
                    value={stateLocation}
                    onChange={(e) => setStateLocation(e.target.value)}
                    placeholder="e.g. Seattle, WA"
                    className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-stone-50 p-3 text-[11px] text-stone-500 leading-relaxed">
                By clicking &ldquo;Join the CareLoop&rdquo;, you will receive your personalized
                onboarding roadmap and welcome link. We respect your privacy: zero spam, no ads,
                and clear data protection boundaries.
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs font-semibold text-stone-500 hover:text-stone-800"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-6 py-2.5 text-xs font-bold text-white hover:bg-teal-900 disabled:opacity-50"
                >
                  {loading ? (
                    <span>Generating Care Plan...</span>
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
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <div>
                <span className="rounded-md bg-stone-100 px-2.5 py-1 text-[11px] font-mono font-bold text-stone-700">
                  Confirmation #{result.confirmationId}
                </span>
                <h4 className="mt-3 text-2xl font-bold text-stone-900">
                  Welcome to CareLoop, {result.carePlanSummary.for}!
                </h4>
                <p className="mt-1 text-xs text-stone-600">
                  We&apos;ve sent your customized action roadmap to{" "}
                  <strong className="text-stone-800">{result.carePlanSummary.email}</strong>.
                </p>
              </div>

              <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 text-left text-xs text-stone-700 space-y-2">
                <div className="font-bold text-teal-950 uppercase tracking-wide text-[11px]">
                  Your Initial Care Roadmap
                </div>
                <div>
                  <span className="text-stone-500">Starting Phase: </span>
                  <span className="font-semibold text-stone-900">
                    Step 1: UNDERSTAND (Demystify Order)
                  </span>
                </div>
                <div>
                  <span className="text-stone-500">First Action: </span>
                  <span className="font-medium text-stone-800">
                    {result.carePlanSummary.nextAction}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full rounded-xl bg-teal-800 py-3 text-xs font-bold text-white hover:bg-teal-900"
                >
                  Back to CareLoop
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
