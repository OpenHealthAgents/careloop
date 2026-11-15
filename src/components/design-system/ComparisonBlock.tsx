import React from "react";
import { Check, X, AlertCircle, Sparkles } from "lucide-react";
import { Card } from "./Card";

export interface ComparisonItem {
  title: string;
  description: string;
}

export interface ComparisonBlockProps {
  statusQuoTitle?: string;
  statusQuoTagline?: string;
  statusQuoItems: ComparisonItem[];
  careLoopTitle?: string;
  careLoopTagline?: string;
  careLoopItems: ComparisonItem[];
  className?: string;
}

export function ComparisonBlock({
  statusQuoTitle = "The Broken Status Quo",
  statusQuoTagline = "Where care recommendations sit in a drawer and are forgotten.",
  statusQuoItems,
  careLoopTitle = "The CareLoop Way",
  careLoopTagline = "Intelligent navigation and follow-through until care is complete.",
  careLoopItems,
  className = "",
}: ComparisonBlockProps) {
  return (
    <div className={`grid grid-cols-1 gap-8 lg:grid-cols-2 ${className}`}>
      {/* Status Quo Card */}
      <Card
        variant="subtle"
        padding="lg"
        className="border-[#FCA5A5]/50 bg-gradient-to-b from-[#FEF2F2]/60 to-white"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF2F2] text-[#B91C1C] border border-[#FCA5A5]/60">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider uppercase text-[#B91C1C]">
              Friction &amp; Abandonment
            </span>
            <h3 className="text-xl font-bold text-[#191716]">{statusQuoTitle}</h3>
          </div>
        </div>

        <p className="mt-3 text-sm text-[#5C5650] leading-relaxed">
          {statusQuoTagline}
        </p>

        <ul className="mt-6 space-y-4 text-sm text-[#5C5650]">
          {statusQuoItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FEF2F2] text-[#B91C1C]">
                <X className="h-3 w-3 stroke-[2.5]" />
              </span>
              <div>
                <strong className="font-semibold text-[#191716]">{item.title}: </strong>
                <span>{item.description}</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-8 rounded-2xl bg-[#FEF2F2] p-4 text-xs text-[#8F2323] border border-[#FCA5A5]/40 font-medium">
          <strong>The Result:</strong> Months of delay, anxiety, and care recommended but never received.
        </div>
      </Card>

      {/* CareLoop Card */}
      <Card
        variant="highlight"
        padding="lg"
        className="bg-gradient-to-b from-[#EBF5F3]/60 via-white to-white"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EBF5F3] text-[#0E6156] border border-[#C8E4DE]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider uppercase text-[#0E6156]">
              Execution &amp; Resolution
            </span>
            <h3 className="text-xl font-bold text-[#191716]">{careLoopTitle}</h3>
          </div>
        </div>

        <p className="mt-3 text-sm text-[#5C5650] leading-relaxed">
          {careLoopTagline}
        </p>

        <ul className="mt-6 space-y-4 text-sm text-[#5C5650]">
          {careLoopItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#EBF5F3] text-[#0E6156]">
                <Check className="h-3 w-3 stroke-[3]" />
              </span>
              <div>
                <strong className="font-semibold text-[#191716]">{item.title}: </strong>
                <span>{item.description}</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-8 rounded-2xl bg-[#EBF5F3] p-4 text-xs text-[#09473F] border border-[#C8E4DE] font-semibold">
          <strong>The Transformation:</strong> You feel supported, clear, and confident. Care is completed on schedule.
        </div>
      </Card>
    </div>
  );
}
