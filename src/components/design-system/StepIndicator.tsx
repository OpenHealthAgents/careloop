import React from "react";
import { Check } from "lucide-react";

export interface StepItem {
  id: string;
  number: string;
  name: string;
  description?: string;
  tagline?: string;
}

export interface StepIndicatorProps {
  steps: StepItem[];
  currentStepIndex: number;
  onStepClick?: (index: number) => void;
  orientation?: "horizontal" | "vertical";
  variant?: "pill" | "timeline";
  className?: string;
}

export function StepIndicator({
  steps,
  currentStepIndex,
  onStepClick,
  orientation = "horizontal",
  variant = "pill",
  className = "",
}: StepIndicatorProps) {
  if (variant === "pill" && orientation === "horizontal") {
    return (
      <div className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
        {steps.map((step, idx) => {
          const isActive = idx === currentStepIndex;
          const isCompleted = idx < currentStepIndex;
          const isClickable = Boolean(onStepClick);

          return (
            <button
              key={step.id}
              type="button"
              disabled={!isClickable}
              onClick={() => onStepClick?.(idx)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-[#0E6156] text-white shadow-sm ring-2 ring-[#0E6156]/30"
                  : isCompleted
                  ? "bg-[#EBF5F3] text-[#0E6156] border border-[#C8E4DE]"
                  : "bg-white text-[#5C5650] hover:bg-[#F4F0EB] border border-[#E2DDD5]"
              } ${isClickable ? "cursor-pointer" : "cursor-default"}`}
              aria-current={isActive ? "step" : undefined}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                  isActive
                    ? "bg-[#09473F] text-white"
                    : isCompleted
                    ? "bg-[#0E6156] text-white"
                    : "bg-[#EAE5DE] text-[#5C5650]"
                }`}
              >
                {isCompleted ? <Check className="h-2.5 w-2.5 stroke-[3]" /> : step.number}
              </span>
              <span>{step.name}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Vertical Timeline
  return (
    <ol className={`relative space-y-6 border-l-2 border-[#C8E4DE] pl-5 ${className}`}>
      {steps.map((step, idx) => {
        const isActive = idx === currentStepIndex;
        const isCompleted = idx < currentStepIndex;
        const isClickable = Boolean(onStepClick);

        return (
          <li
            key={step.id}
            onClick={() => isClickable && onStepClick?.(idx)}
            className={`relative group ${isClickable ? "cursor-pointer" : ""}`}
          >
            {/* Indicator Node */}
            <span
              className={`absolute -left-[27px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full transition-all duration-200 ${
                isActive
                  ? "bg-[#0E6156] text-white ring-4 ring-[#EBF5F3]"
                  : isCompleted
                  ? "bg-[#0E6156] text-white"
                  : "bg-white border-2 border-[#C7C0B5] text-[#8A8279]"
              }`}
            >
              {isCompleted ? (
                <Check className="h-3 w-3 stroke-[3]" />
              ) : (
                <span className="text-[10px] font-bold">{step.number}</span>
              )}
            </span>

            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-bold tracking-tight transition-colors ${
                    isActive
                      ? "text-[#0E6156]"
                      : isCompleted
                      ? "text-[#191716]"
                      : "text-[#8A8279]"
                  }`}
                >
                  {step.name}
                </span>
                {isActive && (
                  <span className="rounded-full bg-[#EBF5F3] px-2 py-0.5 text-[10px] font-semibold text-[#0E6156]">
                    Active Phase
                  </span>
                )}
              </div>
              {step.tagline && (
                <p className="mt-0.5 text-xs text-[#5C5650] leading-relaxed">
                  {step.tagline}
                </p>
              )}
              {step.description && (
                <p className="mt-1 text-xs text-[#8A8279] leading-relaxed">
                  {step.description}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
