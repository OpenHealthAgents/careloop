import React from "react";

export type BadgeVariant =
  | "brand"
  | "accent"
  | "neutral"
  | "success"
  | "warning"
  | "info"
  | "outline";

export type BadgeSize = "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  pulseDot?: boolean;
  dotColor?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function Badge({
  variant = "brand",
  size = "md",
  pulseDot = false,
  dotColor,
  icon,
  children,
  className = "",
  ...props
}: BadgeProps) {
  const variantStyles: Record<BadgeVariant, { container: string; defaultDot: string }> = {
    brand: {
      container: "bg-[#EBF5F3] text-[#0E6156] border border-[#C8E4DE]",
      defaultDot: "bg-[#0E6156]",
    },
    accent: {
      container: "bg-[#FEF6EA] text-[#8F5012] border border-[#F6DCB8]",
      defaultDot: "bg-[#C87D2A]",
    },
    neutral: {
      container: "bg-[#F4F0EB] text-[#5C5650] border border-[#E2DDD5]",
      defaultDot: "bg-[#8A8279]",
    },
    success: {
      container: "bg-[#EDF7F2] text-[#1E7E55] border border-[#C6E7D6]",
      defaultDot: "bg-[#1E7E55]",
    },
    warning: {
      container: "bg-[#FEF7ED] text-[#B45309] border border-[#FDE3C4]",
      defaultDot: "bg-[#B45309]",
    },
    info: {
      container: "bg-[#F0F4F8] text-[#335C7A] border border-[#D0DEEB]",
      defaultDot: "bg-[#335C7A]",
    },
    outline: {
      container: "bg-white text-[#5C5650] border border-[#E2DDD5]",
      defaultDot: "bg-[#5C5650]",
    },
  };

  const sizeStyles: Record<BadgeSize, string> = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
  };

  const { container, defaultDot } = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${container} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {pulseDot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              dotColor || defaultDot
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
              dotColor || defaultDot
            }`}
          />
        </span>
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
