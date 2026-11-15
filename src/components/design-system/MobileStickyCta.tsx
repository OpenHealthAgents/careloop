"use client";

import React, { useState, useEffect } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "./Button";

export interface MobileStickyCtaProps {
  primaryCtaText?: string;
  primaryCtaHref?: string;
  onPrimaryCtaClick?: () => void;
  scrollThreshold?: number;
  className?: string;
}

export function MobileStickyCta({
  primaryCtaText = "Join the CareLoop",
  primaryCtaHref = "/join",
  onPrimaryCtaClick,
  scrollThreshold = 350,
  className = "",
}: MobileStickyCtaProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      // Show when user scrolls past the threshold (usually after the hero)
      setVisible(window.scrollY > scrollThreshold);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [scrollThreshold]);

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-30 md:hidden border-t border-[#E2DDD5]/90 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md transition-transform duration-200 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${className}`}
      role="region"
      aria-label="Quick Action"
    >
      <div className="mx-auto flex items-center justify-between gap-3 max-w-md">
        <div className="flex flex-col min-w-0 pr-1">
          <span className="flex items-center gap-1 text-[11px] font-bold text-[#0E6156] tracking-wide uppercase">
            <Sparkles className="h-3 w-3 shrink-0" />
            CareLoop
          </span>
          <span className="text-xs font-semibold text-[#191716] truncate">
            Turn care needs into action
          </span>
        </div>

        <Button
          size="sm"
          variant="primary"
          href={onPrimaryCtaClick ? undefined : primaryCtaHref}
          onClick={onPrimaryCtaClick}
          rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
          className="shrink-0 font-bold px-4 py-2.5 shadow-sm text-xs"
        >
          {primaryCtaText}
        </Button>
      </div>
    </div>
  );
}
