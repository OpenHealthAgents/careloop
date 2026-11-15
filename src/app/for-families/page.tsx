import React from "react";
import type { Metadata } from "next";
import { ForFamiliesClient } from "@/components/consumer/ForFamiliesClient";
import { SITE_CONFIG } from "@/lib/seo/config";

export const metadata: Metadata = {
  title: "Family Caregiver Support & Healthcare Coordination",
  description:
    "CareLoop helps family caregivers coordinate appointments, medications, specialists, and transitions for aging parents, children, and partners without losing track.",
  keywords: [
    "caregiver support",
    "family care coordination",
    "eldercare navigation",
    "pediatric care coordination",
    "healthcare organization",
    "family healthcare tracker",
  ],
  alternates: {
    canonical: `${SITE_CONFIG.url}/for-families`,
  },
  openGraph: {
    title: "CareLoop for Families — Care for Them Without Losing Track",
    description:
      "Because sometimes you're managing healthcare for more than one person. Coordinated healthcare navigation for loved ones.",
    url: `${SITE_CONFIG.url}/for-families`,
    type: "website",
  },
};

export default function ForFamiliesPage() {
  return <ForFamiliesClient />;
}
