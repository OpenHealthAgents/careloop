import React from "react";

export type CardVariant = "default" | "subtle" | "elevated" | "interactive" | "highlight" | "dark";
export type CardPadding = "none" | "sm" | "md" | "lg" | "xl";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  as?: React.ElementType;
  children: React.ReactNode;
}

export function Card({
  variant = "default",
  padding = "md",
  as: Component = "div",
  children,
  className = "",
  ...props
}: CardProps) {
  const baseStyles = "rounded-3xl transition-all duration-200 overflow-hidden";

  const variantStyles: Record<CardVariant, string> = {
    default:
      "bg-white border border-[#E2DDD5] shadow-soft",
    subtle:
      "bg-[#F4F0EB] border border-[#E2DDD5]/80",
    elevated:
      "bg-white border border-[#E2DDD5]/90 shadow-elevated",
    interactive:
      "bg-white border border-[#E2DDD5] shadow-soft hover:shadow-card hover:border-[#C7C0B5] motion-safe:hover:-translate-y-0.5 cursor-pointer",
    highlight:
      "bg-[#F2FAF8] border border-[#C8E4DE] shadow-highlight",
    dark:
      "bg-[#06312B] text-white border border-[#0E6156]/40 shadow-elevated",
  };

  const paddingStyles: Record<CardPadding, string> = {
    none: "p-0",
    sm: "p-4 sm:p-5",
    md: "p-6 sm:p-8",
    lg: "p-8 sm:p-10",
    xl: "p-10 sm:p-12 lg:p-14",
  };

  return (
    <Component
      className={`${baseStyles} ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
