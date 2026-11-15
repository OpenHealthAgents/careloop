import React from "react";
import Link from "next/link";

interface CareLoopLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  withTagline?: boolean;
}

export function CareLoopLogo({
  className = "",
  size = "md",
  withTagline = false,
}: CareLoopLogoProps) {
  const iconSizes = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  return (
    <Link
      href="/"
      className={`group inline-flex items-center gap-2.5 transition-opacity hover:opacity-95 ${className}`}
      aria-label="CareLoop Home"
    >
      <div
        className={`relative flex items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 p-1.5 shadow-sm ring-1 ring-teal-600/30 transition-transform group-hover:scale-[1.02] ${iconSizes[size]}`}
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full text-white"
          aria-hidden="true"
        >
          {/* Continuous Loop of Care */}
          <path
            d="M9 16C9 12.134 12.134 9 16 9C19.866 9 23 12.134 23 16C23 19.866 19.866 23 16 23"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M16 23C13.2386 23 11 20.7614 11 18C11 15.2386 13.2386 13 16 13C18.7614 13 21 15.2386 21 18C21 20.7614 18.7614 23 16 23Z"
            stroke="#99f6e4"
            strokeWidth="2"
            strokeDasharray="2 3"
          />
          <circle cx="16" cy="9" r="2.2" fill="#5eead4" />
          <circle cx="23" cy="16" r="2.2" fill="#ffffff" />
        </svg>
      </div>

      <div className="flex flex-col leading-none">
        <span
          className={`font-semibold tracking-tight text-stone-900 group-hover:text-teal-900 ${textSizes[size]}`}
        >
          Care<span className="font-light text-teal-700">Loop</span>
        </span>
        {withTagline && (
          <span className="mt-0.5 text-[10px] font-medium tracking-wider uppercase text-stone-500">
            Healthcare Execution
          </span>
        )}
      </div>
    </Link>
  );
}
