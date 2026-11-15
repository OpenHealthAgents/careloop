"use client";

import React, { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  UserCheck,
  Play,
  RotateCcw,
} from "lucide-react";

interface Scenario {
  id: string;
  category: string;
  title: string;
  persona: string;
  initialProblem: string;
  roadblocks: string[];
  careLoopSolution: {
    step1: string;
    step2: string;
    step3: string;
    step4: string;
  };
  metricsOutcome: {
    timeSaved: string;
    waitReduction: string;
    costClarity: string;
  };
  finalCard: {
    status: string;
    doctor: string;
    clinic: string;
    date: string;
    logistics: string;
    navigatorNote: string;
  };
}

const SCENARIOS: Scenario[] = [
  {
    id: "specialist",
    category: "Adult Managing Care for Herself",
    title: "Neurologist Referral for Severe Migraines",
    persona: "Elena, 34 • Marketing Director",
    initialProblem:
      "Elena's primary care doctor recommended seeing a neurologist. She was handed a paper slip with three doctor names. Two offices weren't taking new patients; the third offered an appointment 14 weeks out.",
    roadblocks: [
      "14-week wait time for standard clinic",
      "Confusing in-network vs. out-of-network specialist tiers",
      "Uncertain what medical records to bring or what tests are required",
    ],
    careLoopSolution: {
      step1: "Decoded referral note and identified requirement for headache sub-specialist.",
      step2: "Scanned in-network practices with cancellation monitoring; found an opening in 8 days.",
      step3: "Transferred prior cervical spine MRI images digitally to avoid repeat imaging.",
      step4: "Delivered pre-visit migraine frequency guide for Elena to review with the doctor.",
    },
    metricsOutcome: {
      timeSaved: "3.5 hours of phone tag avoided",
      waitReduction: "Seen in 8 days instead of 14 weeks",
      costClarity: "Fixed $30 copay verified beforehand",
    },
    finalCard: {
      status: "Appointment Secured & Verified In-Network",
      doctor: "Dr. Andrea Chen, MD, FAAN",
      clinic: "Valley Medical Pavilion (Headache Center)",
      date: "Thursday, Nov 20 • 10:30 AM",
      logistics: "Intake forms completed online • Imaging disc confirmed received",
      navigatorNote: "Care Navigator Sarah checked in: 'Elena, Dr. Chen's office has your imaging disc and your headache log is attached to your chart.'",
    },
  },
  {
    id: "parent",
    category: "Family Caregiver Navigation",
    title: "Post-Discharge Cardiology for Aging Parent",
    persona: "Maya, 42 • Coordinating care for her father Robert (Age 79)",
    initialProblem:
      "Robert was discharged from the hospital after a heart flutter. He needs an echocardiogram and cardiology visit within 14 days, but Maya lives an hour away, works full-time, and Robert doesn't drive.",
    roadblocks: [
      "Father has limited mobility and needs wheelchair-accessible transit",
      "Confusion around Medicare Advantage prior authorization requirements",
      "Maya needs shared visibility into his care without interrupting work",
    ],
    careLoopSolution: {
      step1: "Clarified Medicare Advantage cardiology network rules and cleared prior auth.",
      step2: "Booked a ground-floor accessible clinic slot at 11:00 AM to avoid morning rush.",
      step3: "Dispatched an accessible medical rideshare with door-to-door escort.",
      step4: "Synced Maya's calendar with appointment details, clinical questions, and post-visit alerts.",
    },
    metricsOutcome: {
      timeSaved: "Zero workdays missed by caregiver",
      waitReduction: "Completed within 10 days of hospital discharge",
      costClarity: "100% covered under Medicare Advantage follow-up",
    },
    finalCard: {
      status: "Care Synchronized & Transit Confirmed",
      doctor: "Dr. Marcus Vance, FACC",
      clinic: "St. Jude Heart & Vascular Suite",
      date: "Monday, Nov 24 • 11:00 AM",
      logistics: "Accessible transit van reserved (Pickup: 10:15 AM at Robert's residence)",
      navigatorNote: "Coordinator David noted: 'Maya, I spoke with Robert's cardiologist; we confirmed his medication list is synced and the driver will escort him into the lobby.'",
    },
  },
  {
    id: "imaging",
    category: "Diagnostic & Prior Auth Coordination",
    title: "Urgent Knee MRI & Prior Auth Clearance",
    persona: "David, 29 • High School Teacher & Coach",
    initialProblem:
      "David injured his knee during practice. The orthopedist ordered an MRI of the knee. The hospital imaging center quoted $1,800 out-of-pocket because prior auth was pending, and warned the scan might be delayed 3 weeks.",
    roadblocks: [
      "Pending insurance prior authorization threatening high out-of-pocket bill",
      "Hospital facility fee markup versus freestanding diagnostic centers",
      "Fear of worsening ligament tear without timely diagnosis",
    ],
    careLoopSolution: {
      step1: "Identified freestanding, accredited in-network imaging centers with lower copays.",
      step2: "Fast-tracked prior authorization submission with clinical notes to insurance.",
      step3: "Secured prior authorization approval in 48 hours.",
      step4: "Booked an MRI scan for $125 copay instead of $1,800 hospital quote.",
    },
    metricsOutcome: {
      timeSaved: "Over $1,600 saved on imaging facility fee",
      waitReduction: "Scan completed in 4 days vs 3-week backlog",
      costClarity: "Guaranteed $125 out-of-pocket copay",
    },
    finalCard: {
      status: "Prior Auth Approved • Scan Scheduled",
      doctor: "Advanced Open MRI Center",
      clinic: "Suite 104 (In-Network Tier 1)",
      date: "Saturday, Nov 22 • 9:00 AM",
      logistics: "Prior Auth #PA-88412 on file • Fasting not required",
      navigatorNote: "Navigator note: 'Prior authorization approved this morning. Results will automatically route to Dr. Patel for your follow-up consult.'",
    },
  },
  {
    id: "mental_health",
    category: "Behavioral Health & Specialty Care",
    title: "In-Network Therapy with Evening Availability",
    persona: "Priya, 26 • Software Engineer",
    initialProblem:
      "Priya sought therapy for work-related anxiety and panic attacks. She called 8 therapists listed on her insurer's directory: 5 had full waitlists, 2 were out-of-network, and 1 only offered appointments during work hours.",
    roadblocks: [
      "Ghost provider directories with outdated in-network lists",
      "Need for specialized Cognitive Behavioral Therapy (CBT) for panic",
      "Strict requirement for 6:00 PM or weekend appointments",
    ],
    careLoopSolution: {
      step1: "Queried verified live provider registries for licensed CBT practitioners.",
      step2: "Filtered for providers accepting new telehealth patients with 6:30 PM availability.",
      step3: "Initiated intake match and verified in-network copay ($20/session).",
      step4: "Scheduled introductory consultation and set up recurring weekly calendar slot.",
    },
    metricsOutcome: {
      timeSaved: "Eliminated weeks of cold calling",
      waitReduction: "First session in 5 days",
      costClarity: "$20 standard behavioral health copay",
    },
    finalCard: {
      status: "Therapist Matched & First Session Booked",
      doctor: "Sarah Jenkins, LCSW",
      clinic: "CareLoop Telehealth Suite (Secure Video)",
      date: "Wednesday, Nov 19 • 6:30 PM",
      logistics: "Secure video link generated • Digital intake completed",
      navigatorNote: "CareLoop note: 'Priya, your introductory session is locked in. We have verified your $20 copay and your intake answers have been sent.'",
    },
  },
];

export function InteractiveSimulator() {
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState(0);
  const [simulationStep, setSimulationStep] = useState<number>(4); // fully resolved by default
  const [isSimulating, setIsSimulating] = useState(false);

  const scenario = SCENARIOS[selectedScenarioIndex];

  function runSimulation() {
    setIsSimulating(true);
    setSimulationStep(1);

    const timer1 = setTimeout(() => setSimulationStep(2), 500);
    const timer2 = setTimeout(() => setSimulationStep(3), 1000);
    const timer3 = setTimeout(() => {
      setSimulationStep(4);
      setIsSimulating(false);
    }, 1500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }

  return (
    <section id="demo" className="relative bg-stone-100/70 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-900">
            Interactive Care Simulator
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
            See how CareLoop resolves real healthcare hurdles.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-stone-600 sm:text-lg">
            Choose a common healthcare situation below to see how CareLoop turns confusion,
            long waitlists, and insurance barriers into a completed appointment.
          </p>

          {/* Scenario Selector Tabs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {SCENARIOS.map((sc, idx) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => {
                  setSelectedScenarioIndex(idx);
                  setSimulationStep(4);
                }}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                  selectedScenarioIndex === idx
                    ? "bg-teal-800 text-white shadow-md ring-2 ring-teal-700/50"
                    : "bg-white text-stone-700 hover:bg-stone-50 border border-stone-200"
                }`}
              >
                {sc.title}
              </button>
            ))}
          </div>
        </div>

        {/* Main Simulation Container */}
        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Column: The Problem & Roadblocks */}
          <div className="flex flex-col justify-between rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 lg:col-span-5 shadow-sm">
            <div>
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  {scenario.category}
                </span>
                <span className="text-xs font-medium text-teal-800">
                  {scenario.persona}
                </span>
              </div>

              <h3 className="mt-4 text-xl font-bold text-stone-900">
                {scenario.title}
              </h3>

              <div className="mt-4 rounded-2xl bg-amber-50/70 border border-amber-200/70 p-4 text-xs text-amber-950">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" />
                  <span>The Real-Life Friction</span>
                </div>
                <p className="mt-2 leading-relaxed text-stone-700">
                  {scenario.initialProblem}
                </p>
              </div>

              <div className="mt-6">
                <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Typical Roadblocks
                </div>
                <ul className="mt-3 space-y-2 text-xs text-stone-600">
                  {scenario.roadblocks.map((rb, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                      <span>{rb}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Run Simulation Trigger */}
            <div className="mt-8 border-t border-stone-100 pt-5">
              <button
                type="button"
                onClick={runSimulation}
                disabled={isSimulating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-800 py-3 text-xs font-bold text-white shadow-xs transition hover:bg-teal-900 disabled:opacity-50"
              >
                {isSimulating ? (
                  <>
                    <RotateCcw className="h-4 w-4 animate-spin" />
                    <span>Executing CareLoop Engine...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-white" />
                    <span>Simulate CareLoop Resolution</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: CareLoop Resolution & Verified Card */}
          <div className="flex flex-col justify-between rounded-3xl border border-teal-200/90 bg-gradient-to-b from-teal-50/40 via-white to-white p-6 sm:p-8 lg:col-span-7 shadow-md ring-1 ring-teal-600/10">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-teal-700" />
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
                    CareLoop Execution Loop
                  </span>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900">
                  {simulationStep === 4 ? "Care Completed" : `Resolving (${simulationStep}/4)`}
                </span>
              </div>

              {/* Step-by-Step Resolution progress */}
              <div className="mt-5 space-y-3 text-xs">
                <div
                  className={`flex items-start gap-3 rounded-xl p-3 transition-all ${
                    simulationStep >= 1 ? "bg-white border border-stone-200" : "opacity-40"
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-700 text-[10px] font-bold text-white">
                    1
                  </span>
                  <div>
                    <span className="font-semibold text-stone-900">Understand: </span>
                    <span className="text-stone-600">{scenario.careLoopSolution.step1}</span>
                  </div>
                </div>

                <div
                  className={`flex items-start gap-3 rounded-xl p-3 transition-all ${
                    simulationStep >= 2 ? "bg-white border border-stone-200" : "opacity-40"
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-700 text-[10px] font-bold text-white">
                    2
                  </span>
                  <div>
                    <span className="font-semibold text-stone-900">Decide &amp; Match: </span>
                    <span className="text-stone-600">{scenario.careLoopSolution.step2}</span>
                  </div>
                </div>

                <div
                  className={`flex items-start gap-3 rounded-xl p-3 transition-all ${
                    simulationStep >= 3 ? "bg-white border border-stone-200" : "opacity-40"
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-700 text-[10px] font-bold text-white">
                    3
                  </span>
                  <div>
                    <span className="font-semibold text-stone-900">Act &amp; Book: </span>
                    <span className="text-stone-600">{scenario.careLoopSolution.step3}</span>
                  </div>
                </div>

                <div
                  className={`flex items-start gap-3 rounded-xl p-3 transition-all ${
                    simulationStep >= 4 ? "bg-white border border-stone-200" : "opacity-40"
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-700 text-[10px] font-bold text-white">
                    4
                  </span>
                  <div>
                    <span className="font-semibold text-stone-900">Follow Through: </span>
                    <span className="text-stone-600">{scenario.careLoopSolution.step4}</span>
                  </div>
                </div>
              </div>

              {/* Final Appointment & Care Plan Card */}
              <div className="mt-6 rounded-2xl border border-teal-200 bg-white p-5 shadow-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-800">
                      <CheckCircle2 className="h-3.5 w-3.5 text-teal-700" />
                      {scenario.finalCard.status}
                    </span>
                    <div className="mt-1 text-base font-bold text-stone-900">
                      {scenario.finalCard.doctor}
                    </div>
                    <div className="text-xs text-stone-600">{scenario.finalCard.clinic}</div>
                  </div>

                  <span className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-900">
                    {scenario.finalCard.date}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-lg bg-stone-50 p-2.5 text-xs text-stone-700">
                  <FileCheck className="h-4 w-4 shrink-0 text-teal-700" />
                  <span>{scenario.finalCard.logistics}</span>
                </div>

                <div className="mt-3 rounded-lg border border-teal-100 bg-teal-50/50 p-3 text-xs text-stone-700">
                  <div className="flex items-center gap-1.5 font-semibold text-teal-950">
                    <UserCheck className="h-3.5 w-3.5 text-teal-700" />
                    <span>Human Care Team Continuity</span>
                  </div>
                  <p className="mt-1 italic text-stone-600">
                    {scenario.finalCard.navigatorNote}
                  </p>
                </div>
              </div>
            </div>

            {/* Metrics Impact */}
            <div className="mt-6 border-t border-stone-200 pt-4">
              <div className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
                <div className="rounded-xl bg-white p-2.5 border border-stone-100">
                  <div className="text-xs font-bold text-stone-900">
                    {scenario.metricsOutcome.waitReduction}
                  </div>
                  <div className="text-[10px] text-stone-500">Wait Time</div>
                </div>
                <div className="rounded-xl bg-white p-2.5 border border-stone-100">
                  <div className="text-xs font-bold text-stone-900">
                    {scenario.metricsOutcome.timeSaved}
                  </div>
                  <div className="text-[10px] text-stone-500">Effort Saved</div>
                </div>
                <div className="rounded-xl bg-white p-2.5 border border-stone-100">
                  <div className="text-xs font-bold text-stone-900">
                    {scenario.metricsOutcome.costClarity}
                  </div>
                  <div className="text-[10px] text-stone-500">Billing Transparency</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
