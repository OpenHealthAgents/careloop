import React from "react";
import { Badge, BadgeVariant } from "./Badge";

export interface SectionHeaderProps {
  badge?: string;
  badgeVariant?: BadgeVariant;
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
  align?: "center" | "left";
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  badge,
  badgeVariant = "brand",
  title,
  description,
  align = "center",
  action,
  className = "",
}: SectionHeaderProps) {
  const isCenter = align === "center";

  return (
    <div
      className={`max-w-3xl ${
        isCenter ? "mx-auto text-center" : "text-left"
      } ${className}`}
    >
      {badge && (
        <div className="mb-3.5">
          <Badge variant={badgeVariant} size="md">
            {badge}
          </Badge>
        </div>
      )}

      <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#191716] leading-[1.2]">
        {title}
      </h2>

      {description && (
        <p className="mt-4 text-base sm:text-lg leading-relaxed text-[#5C5650]">
          {description}
        </p>
      )}

      {action && (
        <div
          className={`mt-6 flex ${
            isCenter ? "justify-center" : "justify-start"
          }`}
        >
          {action}
        </div>
      )}
    </div>
  );
}
