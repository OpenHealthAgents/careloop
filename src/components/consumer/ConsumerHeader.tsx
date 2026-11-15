"use client";

import React from "react";
import { Navigation } from "@/components/design-system/Navigation";

interface ConsumerHeaderProps {
  onOpenJoinModal?: () => void;
}

export function ConsumerHeader({ onOpenJoinModal }: ConsumerHeaderProps) {
  return (
    <Navigation
      primaryCtaText="Join the CareLoop"
      primaryCtaHref="/join"
      onPrimaryCtaClick={onOpenJoinModal}
    />
  );
}
