import React from "react";
import { ArrowRight, ShieldCheck, HeartHandshake, CheckCircle2 } from "lucide-react";
import { Button } from "./Button";
import { Badge } from "./Badge";

export interface CtaSectionProps {
  badge?: string;
  title: string;
  description: string;
  primaryCtaText?: string;
  primaryCtaHref?: string;
  onPrimaryCtaClick?: () => void;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  onSecondaryCtaClick?: () => void;
  variant?: "brandDark" | "warmCanvas";
  className?: string;
}

export function CtaSection({
  badge = "The Healthcare Companion You Need",
  title,
  description,
  primaryCtaText = "Join the CareLoop",
  primaryCtaHref,
  onPrimaryCtaClick,
  secondaryCtaText = "See how it works",
  secondaryCtaHref,
  onSecondaryCtaClick,
  variant = "brandDark",
  className = "",
}: CtaSectionProps) {
  const isDark = variant === "brandDark";

  return (
    <section
      className={`relative overflow-hidden rounded-3xl ${
        isDark
          ? "bg-[#06312B] text-white border border-[#0E6156]/40"
          : "bg-white text-[#191716] border border-[#E2DDD5] shadow-card"
      } p-8 sm:p-12 lg:p-16 text-center ${className}`}
    >
      {/* Clean Background Structure */}
      {isDark && (
        <div className="pointer-events-none absolute inset-0 bg-radial from-[#0E6156]/20 via-transparent to-transparent opacity-60" />
      )}

      <div className="relative mx-auto max-w-3xl">
        {badge && (
          <div className="mb-4">
            <Badge
              variant={isDark ? "brand" : "neutral"}
              size="md"
              className={isDark ? "bg-[#0E6156]/50 text-[#C8E4DE] border-[#0E6156]" : ""}
            >
              {badge}
            </Badge>
          </div>
        )}

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15]">
          {title}
        </h2>

        <p
          className={`mt-4 text-base sm:text-lg leading-relaxed ${
            isDark ? "text-[#C8E4DE]" : "text-[#5C5650]"
          }`}
        >
          {description}
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <Button
            size="lg"
            variant={isDark ? "outline" : "primary"}
            href={primaryCtaHref}
            onClick={onPrimaryCtaClick}
            rightIcon={<ArrowRight className="h-4 w-4" />}
            className={isDark ? "bg-white text-[#06312B] hover:bg-[#F4F0EB] border-transparent font-bold" : ""}
          >
            {primaryCtaText}
          </Button>

          {(secondaryCtaText && (secondaryCtaHref || onSecondaryCtaClick)) && (
            <Button
              size="lg"
              variant={isDark ? "ghost" : "secondary"}
              href={secondaryCtaHref}
              onClick={onSecondaryCtaClick}
              className={isDark ? "text-[#C8E4DE] hover:text-white hover:bg-[#0E6156]/30 border border-[#0E6156]/50" : ""}
            >
              {secondaryCtaText}
            </Button>
          )}
        </div>

        {/* Reassurance Micro-Bar */}
        <div
          className={`mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs ${
            isDark ? "text-[#C8E4DE]/80" : "text-[#8A8279]"
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-[#0E6156] shrink-0" />
            Strict data privacy protections
          </span>
          <span className="inline-flex items-center gap-1.5">
            <HeartHandshake className="h-4 w-4 text-[#0E6156] shrink-0" />
            Human support when needed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-[#0E6156] shrink-0" />
            No hidden costs to explore
          </span>
        </div>
      </div>
    </section>
  );
}
