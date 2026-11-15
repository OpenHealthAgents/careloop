"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface FaqItem {
  question: string;
  answer: string | React.ReactNode;
}

export interface FaqAccordionProps {
  items: FaqItem[];
  allowMultiple?: boolean;
  defaultOpenIndex?: number | null;
  className?: string;
}

export function FaqAccordion({
  items,
  allowMultiple = false,
  defaultOpenIndex = 0,
  className = "",
}: FaqAccordionProps) {
  const [openIndices, setOpenIndices] = useState<number[]>(
    defaultOpenIndex !== null ? [defaultOpenIndex] : []
  );

  function toggle(idx: number) {
    if (allowMultiple) {
      setOpenIndices((prev) =>
        prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
      );
    } else {
      setOpenIndices((prev) => (prev.includes(idx) ? [] : [idx]));
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((item, idx) => {
        const isOpen = openIndices.includes(idx);
        const buttonId = `faq-btn-${idx}`;
        const panelId = `faq-panel-${idx}`;

        return (
          <div
            key={idx}
            className="rounded-2xl border border-[#E2DDD5] bg-white transition-colors hover:border-[#C7C0B5] overflow-hidden"
          >
            <button
              id={buttonId}
              type="button"
              onClick={() => toggle(idx)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="flex w-full items-center justify-between p-5 text-left transition-colors bg-[#FAF8F5]/50 hover:bg-[#FAF8F5] focus-visible:outline-2 focus-visible:outline-[#0E6156]"
            >
              <span className="text-sm sm:text-base font-bold text-[#191716] pr-4">
                {item.question}
              </span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-[#8A8279] transition-transform duration-200 ${
                  isOpen ? "rotate-180 text-[#0E6156]" : ""
                }`}
              />
            </button>

            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className="border-t border-[#E2DDD5] bg-white p-5 text-xs sm:text-sm leading-relaxed text-[#5C5650]"
              >
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
