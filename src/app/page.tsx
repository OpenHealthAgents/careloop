import React from "react";
import type { Metadata } from "next";
import { ConsumerHomeClient } from "@/components/consumer/ConsumerHomeClient";

export const metadata: Metadata = {
  title: "CareLoop — Healthcare is Complicated. Getting Care Shouldn't Be.",
  description:
    "CareLoop helps you understand what to do, find your next step, and follow through — turning doctor referrals, care plans, and health tasks into completed care.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "CareLoop — Healthcare is Complicated. Getting Care Shouldn't Be.",
    description:
      "Intelligent healthcare navigation and follow-through. From knowing what care you need, to getting it done.",
    url: "/",
    type: "website",
  },
};

export default function HomePage() {
  return <ConsumerHomeClient />;
}
