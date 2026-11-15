import React from "react";
import { Card } from "./Card";
import { Badge } from "./Badge";

export interface StatisticCardProps {
  value: string;
  label: string;
  subtext?: string;
  badge?: string;
  icon?: React.ReactNode;
  variant?: "default" | "subtle" | "brand";
  className?: string;
}

export function StatisticCard({
  value,
  label,
  subtext,
  badge,
  icon,
  variant = "default",
  className = "",
}: StatisticCardProps) {
  const isBrand = variant === "brand";

  return (
    <Card
      variant={isBrand ? "highlight" : "default"}
      padding="md"
      className={`relative flex flex-col justify-between ${className}`}
    >
      <div>
        <div className="flex items-center justify-between">
          {icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F4F0EB] text-[#0E6156]">
              {icon}
            </div>
          )}
          {badge && (
            <Badge variant={isBrand ? "brand" : "neutral"} size="sm">
              {badge}
            </Badge>
          )}
        </div>

        <div className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-[#191716] tabular-nums">
          {value}
        </div>

        <h4 className="mt-1 text-sm font-bold text-[#191716]">{label}</h4>

        {subtext && (
          <p className="mt-1.5 text-xs text-[#5C5650] leading-relaxed">
            {subtext}
          </p>
        )}
      </div>
    </Card>
  );
}
