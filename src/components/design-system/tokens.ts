/**
 * CareLoop Marketing Design System — Tokens
 * 
 * Brand Feel: "Calm intelligence for navigating healthcare."
 * Aesthetic: Premium consumer technology meets trusted, warm, effortless healthcare navigation.
 */

export const colors = {
  // Warm Neutral Surfaces
  canvas: {
    bg: "#FAF8F5",           // Primary warm linen background
    surface: "#FFFFFF",      // Elevated cards and modal surfaces
    subtle: "#F4F0EB",       // Subtle container backgrounds
    muted: "#EAE5DE",        // Dividers, pill tags, inset wells
    border: "#E2DDD5",       // Hairline subtle card borders
    borderStrong: "#C7C0B5", // Active or high-contrast borders
  },

  // Dark Primary Typography & Inks
  ink: {
    primary: "#191716",      // High contrast deep warm charcoal ink
    secondary: "#5C5650",    // Calming, legible editorial body copy
    tertiary: "#8A8279",     // Subtitles, helper text, timestamps
    muted: "#A8A199",        // Placeholders, disabled states
    inverse: "#FFFFFF",      // High contrast text on dark backgrounds
  },

  // Distinctive CareLoop Brand Color (Eucalyptus Pine Teal)
  brand: {
    primary: "#0E6156",      // Primary signature brand action
    hover: "#09473F",        // Deep pressed state
    dark: "#06312B",         // Deep background containers
    light: "#EBF5F3",        // Soothing background wash
    surface: "#F2FAF8",      // Subtle card background
    border: "#C8E4DE",       // Branded card hairline
    ring: "#0E615633",       // Focus ring / glow
  },

  // Secondary Accent (Warm Honey Amber Gold)
  accent: {
    primary: "#C87D2A",      // Human touch, next action highlight
    hover: "#A6631B",        // Pressed state
    light: "#FEF6EA",        // Soft warm alert wash
    border: "#F6DCB8",       // Accent hairline border
    text: "#8F5012",         // High-contrast text on light amber
  },

  // Subtle Semantic States
  semantic: {
    success: {
      text: "#1E7E55",       // Completed care, verified slots
      bg: "#EDF7F2",
      border: "#C6E7D6",
    },
    warning: {
      text: "#B45309",       // Prior auth pending, review needed
      bg: "#FEF7ED",
      border: "#FDE3C4",
    },
    info: {
      text: "#335C7A",       // Timeframes, clinical reminders
      bg: "#F0F4F8",
      border: "#D0DEEB",
    },
    error: {
      text: "#B91C1C",       // Missing record, appointment cancelled
      bg: "#FEF2F2",
      border: "#FCA5A5",
    },
  },
} as const;

export const typography = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  scale: {
    display: {
      size: "text-4xl sm:text-5xl lg:text-6xl",
      leading: "leading-[1.1]",
      tracking: "tracking-[-0.03em]",
      weight: "font-bold",
    },
    h1: {
      size: "text-3xl sm:text-4xl lg:text-5xl",
      leading: "leading-[1.15]",
      tracking: "tracking-[-0.025em]",
      weight: "font-bold",
    },
    h2: {
      size: "text-2xl sm:text-3xl lg:text-4xl",
      leading: "leading-[1.25]",
      tracking: "tracking-[-0.02em]",
      weight: "font-semibold",
    },
    h3: {
      size: "text-xl sm:text-2xl",
      leading: "leading-[1.3]",
      tracking: "tracking-[-0.015em]",
      weight: "font-semibold",
    },
    lead: {
      size: "text-lg sm:text-xl",
      leading: "leading-relaxed",
      tracking: "tracking-normal",
      weight: "font-normal",
    },
    body: {
      size: "text-sm sm:text-base",
      leading: "leading-relaxed",
      tracking: "tracking-normal",
      weight: "font-normal",
    },
    small: {
      size: "text-xs sm:text-sm",
      leading: "leading-normal",
      tracking: "tracking-normal",
      weight: "font-normal",
    },
    label: {
      size: "text-[11px] sm:text-xs",
      leading: "leading-none",
      tracking: "tracking-[0.08em]",
      weight: "font-semibold",
      transform: "uppercase",
    },
  },
} as const;

export const shadows = {
  soft: "0 2px 8px -2px rgba(25, 23, 22, 0.04), 0 1px 3px rgba(25, 23, 22, 0.02)",
  card: "0 10px 25px -5px rgba(25, 23, 22, 0.05), 0 2px 6px -2px rgba(25, 23, 22, 0.02)",
  elevated: "0 20px 40px -10px rgba(25, 23, 22, 0.08), 0 4px 12px -2px rgba(25, 23, 22, 0.03)",
  highlight: "0 0 0 1px rgba(14, 97, 86, 0.15), 0 12px 30px -8px rgba(14, 97, 86, 0.12)",
} as const;

export const radii = {
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
  xl: "rounded-3xl",
  full: "rounded-full",
} as const;

export const motion = {
  timing: "transition-all duration-200 ease-out",
  cardHover: "transition-all duration-200 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lg",
  interactive: "motion-safe:active:scale-[0.98] transition-transform duration-100",
} as const;
