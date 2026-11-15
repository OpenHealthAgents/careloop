import React from "react";
import type { Metadata } from "next";
import { FaqPageClient } from "@/components/consumer/FaqPageClient";
import { SITE_CONFIG, getFaqSchema } from "@/lib/seo/config";

export const metadata: Metadata = {
  title: "Frequently Asked Questions (FAQ): Healthcare Navigation & Safety",
  description:
    "Clear answers about CareLoop: how healthcare navigation works, non-diagnostic safety boundaries, family care coordination, AI ethics, and data privacy.",
  keywords: [
    "healthcare navigation questions",
    "care coordination FAQ",
    "is careloop a doctor",
    "healthcare follow-through FAQ",
    "patient privacy healthcare",
    "caregiver support questions",
  ],
  alternates: {
    canonical: `${SITE_CONFIG.url}/faq`,
  },
  openGraph: {
    title: "CareLoop FAQ — Frequently Asked Questions",
    description:
      "Clear, honest answers about navigating care, clinical safety limits, emergency notices, and family coordination.",
    url: `${SITE_CONFIG.url}/faq`,
    type: "website",
  },
};

const FAQ_SCHEMA_DATA = [
  {
    question: "What is CareLoop?",
    answerText:
      "CareLoop is a healthcare navigation companion designed to help people turn healthcare recommendations into completed care by closing the administrative and logistical execution gap.",
  },
  {
    question: "How does CareLoop help me?",
    answerText:
      "CareLoop guides your healthcare journey across four clear stages: Understand (clarifying doctor instructions), Plan (organizing next steps), Act (locating provider options and scheduling), and Follow Through (tracking post-visit tasks and renewals).",
  },
  {
    question: "Is CareLoop a doctor?",
    answerText:
      "No. CareLoop is not a doctor, clinic, or medical provider. We are an administrative and navigation tool that assists with scheduling, organization, and follow-through.",
  },
  {
    question: "Can CareLoop diagnose me?",
    answerText:
      "No. CareLoop does not diagnose illnesses or evaluate symptoms. Medical diagnosis requires the clinical examination of licensed healthcare providers.",
  },
  {
    question: "Does CareLoop replace my healthcare provider?",
    answerText:
      "No. CareLoop supports and complements your care team by helping you prepare for appointments and follow through on recommendations your doctor makes.",
  },
  {
    question: "Can CareLoop help me find a doctor?",
    answerText:
      "Yes. CareLoop helps identify qualified provider options by specialty, location, and directory availability.",
  },
  {
    question: "Can CareLoop help me prepare for an appointment?",
    answerText:
      "Yes. CareLoop helps compile symptoms, draft prioritized questions for your physician, gather required documents, and review pre-visit instructions.",
  },
  {
    question: "Can CareLoop help manage care for a family member?",
    answerText:
      "Yes. CareLoop allows family caregivers to manage multiple loved ones under distinct, organized profiles with a shared overview.",
  },
  {
    question: "What should I do in an emergency?",
    answerText:
      "If you believe you are experiencing a medical emergency, contact local emergency services immediately by dialing 911 or visiting the nearest hospital emergency room.",
  },
];

export default function FaqPage() {
  const faqSchema = getFaqSchema(FAQ_SCHEMA_DATA);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <FaqPageClient />
    </>
  );
}
