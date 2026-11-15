import React from "react";

interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}

export function Display({
  children,
  className = "",
  as: Component = "h1",
  ...props
}: TypographyProps) {
  return (
    <Component
      className={`text-4xl sm:text-5xl lg:text-6xl font-bold tracking-[-0.03em] leading-[1.1] text-[#191716] ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export function H1({
  children,
  className = "",
  as: Component = "h1",
  ...props
}: TypographyProps) {
  return (
    <Component
      className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[-0.025em] leading-[1.15] text-[#191716] ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export function H2({
  children,
  className = "",
  as: Component = "h2",
  ...props
}: TypographyProps) {
  return (
    <Component
      className={`text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-[-0.02em] leading-[1.25] text-[#191716] ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export function H3({
  children,
  className = "",
  as: Component = "h3",
  ...props
}: TypographyProps) {
  return (
    <Component
      className={`text-xl sm:text-2xl font-semibold tracking-[-0.015em] leading-[1.3] text-[#191716] ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export function Lead({
  children,
  className = "",
  as: Component = "p",
  ...props
}: TypographyProps) {
  return (
    <Component
      className={`text-lg sm:text-xl font-normal leading-relaxed text-[#5C5650] ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export function Body({
  children,
  className = "",
  as: Component = "p",
  ...props
}: TypographyProps) {
  return (
    <Component
      className={`text-sm sm:text-base font-normal leading-relaxed text-[#5C5650] ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export function Small({
  children,
  className = "",
  as: Component = "p",
  ...props
}: TypographyProps) {
  return (
    <Component
      className={`text-xs sm:text-sm font-normal leading-normal text-[#8A8279] ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export function Label({
  children,
  className = "",
  as: Component = "span",
  ...props
}: TypographyProps) {
  return (
    <Component
      className={`text-[11px] sm:text-xs font-semibold uppercase tracking-[0.08em] text-[#0E6156] ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
