import React from "react";
import { Badge } from "./Badge";

export interface ProductScreenshotProps {
  title?: string;
  badge?: string;
  children: React.ReactNode;
  annotation?: {
    title: string;
    description: string;
    position?: "top-right" | "bottom-right" | "bottom-left";
  };
  className?: string;
}

export function ProductScreenshot({
  title = "CareLoop Companion",
  badge = "Live Execution",
  children,
  annotation,
  className = "",
}: ProductScreenshotProps) {
  return (
    <div
      className={`relative rounded-3xl border border-[#E2DDD5] bg-white shadow-elevated overflow-hidden ${className}`}
    >
      {/* Window Header Chrome */}
      <div className="flex items-center justify-between border-b border-[#E2DDD5] bg-[#FAF8F5] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-[#EAE5DE]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#EAE5DE]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#EAE5DE]" />
          <span className="ml-2 font-mono text-[11px] text-[#8A8279] truncate">
            {title}
          </span>
        </div>

        {badge && (
          <Badge variant="brand" size="sm" pulseDot>
            {badge}
          </Badge>
        )}
      </div>

      {/* Screen Body */}
      <div className="relative p-4 sm:p-6 lg:p-8 bg-white">
        {children}

        {/* Floating Contextual Annotation */}
        {annotation && (
          <div className="mt-4 sm:absolute sm:bottom-6 sm:right-6 sm:mt-0 max-w-xs rounded-2xl border border-[#C8E4DE] bg-[#EBF5F3]/95 p-3.5 shadow-card backdrop-blur-xs">
            <div className="text-xs font-bold text-[#0E6156]">
              {annotation.title}
            </div>
            <div className="mt-0.5 text-[11px] text-[#09473F] leading-relaxed">
              {annotation.description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
