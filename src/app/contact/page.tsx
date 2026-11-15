import React from "react";
import type { Metadata } from "next";
import { ContactFormClient } from "@/components/consumer/ContactFormClient";
import { SITE_CONFIG } from "@/lib/seo/config";

export const metadata: Metadata = {
  title: "Contact Us: Support & Care Navigation Assistance",
  description:
    "Get in touch with the CareLoop care team. Ask questions about healthcare navigation, family coordination, or partnerships.",
  keywords: [
    "contact careloop",
    "healthcare navigation support",
    "care guide assistance",
    "care coordination contact",
  ],
  alternates: {
    canonical: `${SITE_CONFIG.url}/contact`,
  },
  openGraph: {
    title: "Contact CareLoop — Support & Care Navigation Assistance",
    description:
      "Have a question about navigating care? Contact our care navigation team directly.",
    url: `${SITE_CONFIG.url}/contact`,
    type: "website",
  },
};

export default function ContactPage() {
  return <ContactFormClient />;
}
