import React from "react";
import type { Metadata } from "next";
import { HowItWorksClient } from "@/components/consumer/HowItWorksClient";
import { SITE_CONFIG } from "@/lib/seo/config";

export const metadata: Metadata = {
  title: "How CareLoop Works: Understand, Plan, Act, Follow Through",
  description:
    "See how CareLoop turns healthcare recommendations into completed care. From explaining your situation to planning next steps, scheduling in-network appointments, and proactive follow-through.",
  keywords: [
    "how healthcare navigation works",
    "care coordination steps",
    "healthcare follow-through",
    "schedule doctor appointment",
    "healthcare action plan",
    "patient navigation",
  ],
  alternates: {
    canonical: `${SITE_CONFIG.url}/how-it-works`,
  },
  openGraph: {
    title: "How CareLoop Works — From 'What do I do?' to 'It's done.'",
    description:
      "CareLoop guides your healthcare journey one clear step at a time: Understand → Plan → Act → Follow Through.",
    url: `${SITE_CONFIG.url}/how-it-works`,
    type: "website",
  },
};

export default function HowItWorksPage() {
  return <HowItWorksClient />;
}
