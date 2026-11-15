import React from "react";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "./Badge";

export interface FeatureBlockProps {
  badge?: string;
  title: string;
  description: string;
  bulletPoints?: string[];
  cta?: React.ReactNode;
  visual: React.ReactNode;
  reversed?: boolean;
  className?: string;
}

export function FeatureBlock({
  badge,
  title,
  description,
  bulletPoints,
  cta,
  visual,
  reversed = false,
  className = "",
}: FeatureBlockProps) {
  return (
    <div
      className={`grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16 ${className}`}
    >
      {/* Content Column */}
      <div
        className={`space-y-6 lg:col-span-6 ${
          reversed ? "lg:order-2" : "lg:order-1"
        }`}
      >
        {badge && (
          <div>
            <Badge variant="brand" size="md">
              {badge}
            </Badge>
          </div>
        )}

        <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#191716] leading-[1.2]">
          {title}
        </h3>

        <p className="text-base leading-relaxed text-[#5C5650]">
          {description}
        </p>

        {bulletPoints && bulletPoints.length > 0 && (
          <ul className="space-y-3 text-sm text-[#5C5650]">
            {bulletPoints.map((point, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0E6156]" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        )}

        {cta && <div className="pt-2">{cta}</div>}
      </div>

      {/* Visual Slot */}
      <div
        className={`lg:col-span-6 ${
          reversed ? "lg:order-1" : "lg:order-2"
        }`}
      >
        <div className="relative mx-auto w-full max-w-xl">{visual}</div>
      </div>
    </div>
  );
}
