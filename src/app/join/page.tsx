import React from "react";
import type { Metadata } from "next";
import { JoinWizardClient } from "@/components/consumer/JoinWizardClient";
import { SITE_CONFIG } from "@/lib/seo/config";

export const metadata: Metadata = {
  title: "Join the CareLoop: Request Early Access & Start Your Plan",
  description:
    "Join CareLoop. Share what care you need, and we will build your clear path forward with step-by-step guidance, appointment coordination, and follow-through.",
  keywords: [
    "join careloop",
    "healthcare navigation signup",
    "care coordination early access",
    "start healthcare plan",
  ],
  alternates: {
    canonical: `${SITE_CONFIG.url}/join`,
  },
  openGraph: {
    title: "Join the CareLoop — Turn Healthcare Needs into Completed Care",
    description:
      "Request early access. Tell us what healthcare situation you're facing, and we will help you find your next step.",
    url: `${SITE_CONFIG.url}/join`,
    type: "website",
  },
};

export default function JoinPage() {
  return <JoinWizardClient />;
}
