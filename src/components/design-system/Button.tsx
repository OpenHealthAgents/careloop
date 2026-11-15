import React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "accent";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  href,
  leftIcon,
  rightIcon,
  loading = false,
  fullWidth = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-semibold rounded-full transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E6156] disabled:opacity-50 disabled:pointer-events-none motion-safe:active:scale-[0.98]";

  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      "bg-[#0E6156] text-white hover:bg-[#09473F] shadow-sm hover:shadow",
    secondary:
      "bg-[#F4F0EB] text-[#191716] hover:bg-[#EAE5DE] border border-[#E2DDD5]/60",
    outline:
      "bg-white/80 backdrop-blur-xs text-[#191716] border border-[#E2DDD5] hover:bg-[#F4F0EB] hover:border-[#C7C0B5]",
    ghost:
      "bg-transparent text-[#5C5650] hover:text-[#191716] hover:bg-[#F4F0EB]",
    accent:
      "bg-[#C87D2A] text-white hover:bg-[#A6631B] shadow-sm hover:shadow",
  };

  const sizeStyles: Record<ButtonSize, string> = {
    sm: "h-8 px-3.5 text-xs gap-1.5",
    md: "h-10 px-5 text-sm gap-2",
    lg: "h-12 px-7 text-base gap-2.5",
  };

  const widthStyle = fullWidth ? "w-full" : "";
  const combinedClasses = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className}`;

  const content = (
    <>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-current" />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={combinedClasses}>
        {content}
      </Link>
    );
  }

  return (
    <button disabled={disabled || loading} className={combinedClasses} {...props}>
      {content}
    </button>
  );
}
