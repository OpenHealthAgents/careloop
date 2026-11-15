"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
  MessageSquare,
  Sparkles,
  Heart,
  Users,
  ShieldCheck,
  X,
} from "lucide-react";
import { Navigation } from "@/components/design-system/Navigation";
import { Footer } from "@/components/design-system/Footer";
import {
  Badge,
  Button,
  Card,
  CtaSection,
  H1,
  H3,
  Lead,
  Body,
  FaqAccordion,
} from "@/components/design-system";

export type FaqCategory =
  | "all"
  | "about"
  | "clinical-safety"
  | "features"
  | "ai-privacy"
  | "joining";

export interface FaqItemData {
  id: string;
  category: FaqCategory;
  question: string;
  answer: React.ReactNode;
  tags?: string[];
}

export const FAQ_ITEMS: FaqItemData[] = [
  // 1. What is CareLoop?
  {
    id: "what-is-careloop",
    category: "about",
    question: "What is CareLoop?",
    tags: ["overview", "about", "mission", "navigation"],
    answer: (
      <div className="space-y-3">
        <p>
          CareLoop is a healthcare navigation companion designed to help people turn healthcare recommendations into completed care.
        </p>
        <p>
          Healthcare is often effective at identifying what care people need—such as doctor referrals, diagnostic tests, prescriptions, and follow-up visits. However, those recommendations often fail to become completed care due to confusing provider directories, administrative friction, and complicated logistics.
        </p>
        <p>
          CareLoop exists to close that execution gap by guiding you through every step: from understanding what to do, to finding your next step and following through until care is complete.
        </p>
      </div>
    ),
  },

  // 2. How does CareLoop help me?
  {
    id: "how-does-it-help",
    category: "about",
    question: "How does CareLoop help me?",
    tags: ["benefits", "how it works", "steps", "tasks"],
    answer: (
      <div className="space-y-3">
        <p>
          CareLoop structures the healthcare journey into four clear, manageable stages:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
          <li>
            <strong>Understand:</strong> We help you make sense of your situation, whether that is a new doctor referral, hospital discharge instructions, or an overdue screening.
          </li>
          <li>
            <strong>Plan:</strong> We identify concrete goals, next steps, required documents, and questions to ask your physician.
          </li>
          <li>
            <strong>Act:</strong> We help you locate provider options, prepare for visits, and coordinate logistics so you arrive confident and organized.
          </li>
          <li>
            <strong>Follow Through:</strong> We send reminders for instructions, track lab results, and help close the loop on post-visit recommendations.
          </li>
        </ul>
      </div>
    ),
  },

  // 3. Is CareLoop a doctor?
  {
    id: "is-careloop-a-doctor",
    category: "clinical-safety",
    question: "Is CareLoop a doctor?",
    tags: ["doctor", "physician", "clinical", "medical"],
    answer: (
      <div className="space-y-3">
        <p>
          <strong>No. CareLoop is not a doctor</strong>, licensed medical practitioner, clinic, or healthcare provider.
        </p>
        <p>
          CareLoop is a technology-enabled navigation and organization companion. We provide administrative assistance, organizational tools, and logistical guidance. We do not practice medicine, render clinical advice, or establish a doctor-patient relationship.
        </p>
      </div>
    ),
  },

  // 4. Can CareLoop diagnose me?
  {
    id: "can-careloop-diagnose",
    category: "clinical-safety",
    question: "Can CareLoop diagnose me?",
    tags: ["diagnosis", "symptoms", "medical advice", "tests"],
    answer: (
      <div className="space-y-3">
        <p>
          <strong>No. CareLoop does not diagnose illnesses</strong>, evaluate symptoms, or interpret medical laboratory tests.
        </p>
        <p>
          Medical diagnoses require the professional judgment, examination, and diagnostic capabilities of licensed healthcare providers. If you are experiencing symptoms or have health questions, CareLoop helps you organize your notes and find appropriate licensed doctors who can evaluate you in person or via telehealth.
        </p>
      </div>
    ),
  },

  // 5. Does CareLoop replace my healthcare provider?
  {
    id: "does-careloop-replace-provider",
    category: "clinical-safety",
    question: "Does CareLoop replace my healthcare provider?",
    tags: ["provider", "doctor", "replace", "care team"],
    answer: (
      <div className="space-y-3">
        <p>
          <strong>No. CareLoop does not replace your primary care doctor, specialists, or healthcare team.</strong>
        </p>
        <p>
          CareLoop is designed to complement and support your relationship with your healthcare providers. We help you stay organized so you can show up prepared for visits, follow your doctor&apos;s care plan, and complete follow-up orders between clinic appointments.
        </p>
      </div>
    ),
  },

  // 6. What should I do in an emergency?
  {
    id: "what-to-do-in-emergency",
    category: "clinical-safety",
    question: "What should I do in an emergency?",
    tags: ["emergency", "911", "urgent", "crisis"],
    answer: (
      <div className="space-y-3 rounded-xl bg-amber-50/70 p-4 border border-amber-200/80 text-amber-950">
        <p className="font-bold text-sm text-amber-900">
          If you believe you are experiencing a medical emergency, contact local emergency services or seek immediate medical attention.
        </p>
        <p className="text-xs sm:text-sm text-amber-900/90 leading-relaxed">
          Please dial <strong>911</strong> (in the United States) or go immediately to the nearest hospital emergency room. CareLoop is an administrative and navigation platform; we do not provide emergency triage, urgent response, or acute crisis intervention.
        </p>
      </div>
    ),
  },

  // 7. What happens when CareLoop doesn't know the answer?
  {
    id: "when-careloop-doesnt-know",
    category: "clinical-safety",
    question: "What happens when CareLoop doesn't know the answer?",
    tags: ["escalation", "uncertainty", "limits", "support"],
    answer: (
      <div className="space-y-3">
        <p>
          CareLoop is intentionally built with clear operational boundaries. When a question requires clinical judgment, complex medical evaluation, or institutional verification beyond its navigation scope, CareLoop will not guess or invent answers.
        </p>
        <p>
          Instead, CareLoop clearly states its limitations and guides you toward the appropriate next step—such as contacting your prescribing physician, calling your clinic&apos;s triage desk, or speaking with a human support navigator where available.
        </p>
      </div>
    ),
  },

  // 8. Can CareLoop help me find a doctor?
  {
    id: "help-find-doctor",
    category: "features",
    question: "Can CareLoop help me find a doctor?",
    tags: ["find doctor", "specialist", "network", "appointments"],
    answer: (
      <div className="space-y-3">
        <p>
          Yes. CareLoop helps you identify qualified provider options tailored to your specific care needs, clinical specialty, and geographical location.
        </p>
        <p>
          As provider network integrations and directory integrations expand, CareLoop assists in cross-referencing available provider listings, helping you organize contact information and determine open intake availability so you can schedule timely care.
        </p>
      </div>
    ),
  },

  // 9. Can CareLoop help me prepare for an appointment?
  {
    id: "help-prepare-appointment",
    category: "features",
    question: "Can CareLoop help me prepare for an appointment?",
    tags: ["prepare", "checklist", "questions", "doctor visit"],
    answer: (
      <div className="space-y-3">
        <p>
          Yes. Appointment preparation is a central feature of the CareLoop platform.
        </p>
        <p>
          Before your appointment, CareLoop can help you:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
          <li>Structure a concise summary of your symptoms or care goals.</li>
          <li>Formulate relevant, high-priority questions to ask your doctor.</li>
          <li>Compile a checklist of required identification, medication lists, or previous medical records.</li>
          <li>Review pre-appointment requirements such as fasting or arrival windows.</li>
        </ul>
      </div>
    ),
  },

  // 10. Can CareLoop help manage care for a family member?
  {
    id: "help-family-member",
    category: "features",
    question: "Can CareLoop help manage care for a family member?",
    tags: ["family", "caregiver", "parents", "children", "pediatric"],
    answer: (
      <div className="space-y-3">
        <p>
          Yes. CareLoop is purposefully designed to relieve the burden on family caregivers.
        </p>
        <p>
          Whether you are coordinating specialist visits and medication refills for an aging parent, staying on top of pediatric checkups for children, or supporting a spouse, CareLoop lets you maintain separate, organized care journeys for each loved one while keeping reminders, tasks, and follow-ups consolidated in one place.
        </p>
      </div>
    ),
  },

  // 11. How does CareLoop use AI?
  {
    id: "how-does-careloop-use-ai",
    category: "ai-privacy",
    question: "How does CareLoop use AI?",
    tags: ["artificial intelligence", "ai", "technology", "llm"],
    answer: (
      <div className="space-y-3">
        <p>
          CareLoop uses artificial intelligence to help simplify complex healthcare processes into clear, organized action steps.
        </p>
        <p>
          Specifically, AI is used to:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
          <li>Synthesize complicated healthcare jargon and clinical instructions into plain, conversational language.</li>
          <li>Generate personalized appointment preparation checklists and discussion points.</li>
          <li>Organize multi-step care timelines, lab follow-ups, and calendar reminders.</li>
        </ul>
        <p className="text-xs text-[#5C5650] italic">
          Importantly, CareLoop&apos;s AI operates within strict boundaries: it is never used for independent medical diagnosis, treatment planning, or clinical decision-making.
        </p>
      </div>
    ),
  },

  // 12. How does CareLoop protect my information?
  {
    id: "how-protect-information",
    category: "ai-privacy",
    question: "How does CareLoop protect my information?",
    tags: ["privacy", "security", "encryption", "data protection"],
    answer: (
      <div className="space-y-3">
        <p>
          Healthcare information is deeply personal, and we treat your privacy with the highest degree of respect and care.
        </p>
        <p>
          Our platform is architected with modern technical and administrative safeguards, including encryption in transit and at rest, role-based access restrictions, and secure data isolation.
        </p>
        <p>
          Furthermore, CareLoop operates under a strict zero-ad monetization model: we do not sell, rent, or trade your personal health data to advertisers, marketers, or data brokers.
        </p>
      </div>
    ),
  },

  // 13. Who is CareLoop for?
  {
    id: "who-is-careloop-for",
    category: "about",
    question: "Who is CareLoop for?",
    tags: ["audience", "who is this for", "patients", "caregivers"],
    answer: (
      <div className="space-y-3">
        <p>
          CareLoop is designed for anyone who wants healthcare to feel less overwhelming and more manageable:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
          <li><strong>Individuals:</strong> Anyone who needs to schedule appointments, find new doctors, or stay on top of preventive screenings.</li>
          <li><strong>People managing ongoing conditions:</strong> Patients who have multiple appointments, lab tests, and medication routines to coordinate.</li>
          <li><strong>Patients navigating transitions:</strong> Anyone recently discharged from the hospital or referred to a specialist who needs a clear next step.</li>
          <li><strong>Family Caregivers:</strong> Adult children managing care for aging parents, or parents balancing pediatric and family health tasks.</li>
        </ul>
      </div>
    ),
  },

  // 14. How do I join?
  {
    id: "how-do-i-join",
    category: "joining",
    question: "How do I join?",
    tags: ["join", "sign up", "early access", "waitlist", "pricing"],
    answer: (
      <div className="space-y-3">
        <p>
          You can request early access directly on our website by visiting our <Link href="/join" className="font-semibold text-[#0E6156] underline underline-offset-2 hover:text-[#093e37]">Join page</Link>.
        </p>
        <p>
          Simply share a few basic details about the healthcare situation you are currently navigating. We will provide updates on availability, early access onboarding, and how to get started with an organized care roadmap.
        </p>
      </div>
    ),
  },

  // 15. Bonus: How much does CareLoop cost? (Qualified language)
  {
    id: "how-much-does-it-cost",
    category: "joining",
    question: "How much does CareLoop cost?",
    tags: ["pricing", "cost", "free", "benefit"],
    answer: (
      <div className="space-y-3">
        <p>
          During our initial rollout and preview access, CareLoop is available directly to consumers at no upfront cost.
        </p>
        <p>
          As we expand, CareLoop is exploring partnerships with employers and health plans to provide sponsored navigation benefits to members, as well as affordable direct consumer plans for families needing comprehensive coordination support.
        </p>
      </div>
    ),
  },
];

const CATEGORIES: { id: FaqCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "all", label: "All Questions", icon: HelpCircle },
  { id: "about", label: "About CareLoop", icon: Sparkles },
  { id: "clinical-safety", label: "Clinical Safety & Boundaries", icon: ShieldCheck },
  { id: "features", label: "Features & Appointments", icon: Heart },
  { id: "ai-privacy", label: "AI & Privacy", icon: ShieldAlert },
  { id: "joining", label: "Joining & Access", icon: Users },
];

export function FaqPageClient() {
  const [activeCategory, setActiveCategory] = useState<FaqCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFaqs = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return FAQ_ITEMS.filter((item) => {
      const matchesCategory =
        activeCategory === "all" || item.category === activeCategory;
      if (!matchesCategory) return false;

      if (!query) return true;

      const questionMatch = item.question.toLowerCase().includes(query);
      const tagMatch = item.tags?.some((t) => t.toLowerCase().includes(query));
      // For string search in answer, check common search keywords
      const idMatch = item.id.replace(/-/g, " ").includes(query);

      return questionMatch || tagMatch || idMatch;
    });
  }, [activeCategory, searchQuery]);

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
                <span>Frequently Asked Questions</span>
                <span className="text-[#0E6156]/40">•</span>
                <span className="font-normal text-[#5C5650]">Direct, transparent answers</span>
              </div>

              <H1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-[-0.03em] text-[#191716]">
                Questions about navigating care with CareLoop
              </H1>

              <Lead className="text-sm sm:text-base md:text-lg text-[#5C5650] max-w-2xl mx-auto leading-relaxed font-normal">
                Clear, transparent answers about our navigation platform, clinical boundaries, family coordination, and how we protect your personal health information.
              </Lead>

              {/* Live Search Input */}
              <div className="pt-2 mx-auto max-w-xl">
                <div className="relative flex items-center">
                  <Search className="absolute left-4 h-5 w-5 text-[#8A8279] pointer-events-none" />
                  <label htmlFor="faq-search-input" className="sr-only">
                    Search frequently asked questions
                  </label>
                  <input
                    id="faq-search-input"
                    name="faq-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by topic, e.g. 'doctor', 'emergency', 'privacy', 'family'..."
                    aria-label="Search frequently asked questions"
                    className="w-full rounded-2xl border border-[#E2DDD5] bg-[#FAF8F5] py-3.5 pl-12 pr-10 text-sm text-[#191716] placeholder-[#8A8279] shadow-soft transition-all focus:border-[#0E6156] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E6156]/20"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3.5 p-1 rounded-full text-[#8A8279] hover:text-[#191716] hover:bg-[#E2DDD5]/50 transition-colors"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* MAIN FAQ CONTENT                                                          */}
        {/* ========================================================================= */}
        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
              {CATEGORIES.map((cat) => {
                const isSelected = activeCategory === cat.id;
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    type="button"
                    className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                      isSelected
                        ? "bg-[#0E6156] text-white shadow-soft"
                        : "bg-white text-[#5C5650] border border-[#E2DDD5] hover:bg-[#F4F0EB] hover:text-[#191716]"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${isSelected ? "text-white" : "text-[#8A8279]"}`} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Results count feedback */}
            {searchQuery && (
              <div className="mb-6 flex items-center justify-between text-xs text-[#5C5650] border-b border-[#E2DDD5]/60 pb-3">
                <span>
                  Showing {filteredFaqs.length} question{filteredFaqs.length === 1 ? "" : "s"} matching &ldquo;{searchQuery}&rdquo;
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="font-semibold text-[#0E6156] hover:underline"
                >
                  Reset search
                </button>
              </div>
            )}

            {/* Accordion List */}
            {filteredFaqs.length > 0 ? (
              <FaqAccordion
                items={filteredFaqs.map((faq) => ({
                  question: faq.question,
                  answer: faq.answer,
                }))}
                allowMultiple={true}
                defaultOpenIndex={0}
              />
            ) : (
              <Card variant="subtle" padding="xl" className="text-center py-12 bg-white">
                <HelpCircle className="mx-auto h-10 w-10 text-[#8A8279] mb-3" />
                <H3 className="text-base font-semibold text-[#191716] mb-1">
                  No matching questions found
                </H3>
                <Body className="text-xs text-[#5C5650] mb-4 max-w-sm mx-auto">
                  We couldn&apos;t find an answer matching &ldquo;{searchQuery}&rdquo;. Try another search term or browse by category.
                </Body>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveCategory("all");
                  }}
                >
                  View All Questions
                </Button>
              </Card>
            )}

            {/* Direct Support & Questions Card */}
            <div className="mt-14 rounded-2xl border border-[#E2DDD5] bg-white p-6 sm:p-8 shadow-soft flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EBF5F3] text-[#0E6156] mt-0.5">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#191716]">
                    Have a question not listed here?
                  </h3>
                  <p className="text-xs text-[#5C5650] mt-1 leading-relaxed">
                    We are always here to help you understand how CareLoop supports your healthcare journey and keeps you organized.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="primary"
                href="/contact"
                rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
              >
                Contact Support
              </Button>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* EMERGENCY MEDICAL NOTICE                                                  */}
        {/* ========================================================================= */}
        <section className="pb-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-amber-200 bg-[#FFFDF9] p-5 sm:p-6 shadow-soft text-xs sm:text-sm text-[#191716]">
              <div className="flex items-start gap-3.5">
                <ShieldAlert className="h-5 w-5 text-[#C87D2A] shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="font-bold text-[#191716]">
                    Immediate Medical Emergency Notice
                  </p>
                  <p className="leading-relaxed text-[#5C5650]">
                    &ldquo;If you believe you are experiencing a medical emergency, contact local emergency services or seek immediate medical attention.&rdquo;
                  </p>
                  <p className="text-xs text-[#8A8279] leading-relaxed pt-0.5">
                    CareLoop is strictly a health navigation, organizational, and follow-through service. We do not provide clinical triage or acute emergency evaluations. In an emergency, dial <strong>911</strong> or proceed directly to the nearest hospital emergency room.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* FINAL CONVERSION CTA                                                      */}
        {/* ========================================================================= */}
        <CtaSection
          variant="brandDark"
          badge="Close the Execution Gap"
          title="Turn healthcare recommendations into completed care."
          description="Join CareLoop today. Tell us what care you need, and we will help you find your next step and follow through."
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
