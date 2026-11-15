import { BarrierCategory } from "@prisma/client";

export const BARRIER_UNKNOWN_LABEL = "Barrier unknown";

export interface BarrierDefinition {
  category: BarrierCategory;
  label: string;
  subBarriers: readonly string[];
  description: string;
}

export const BARRIER_TAXONOMY: Record<BarrierCategory, BarrierDefinition> = {
  ACCESS: {
    category: "ACCESS",
    label: "Access",
    subBarriers: [
      "provider shortage",
      "long wait time",
      "geographic distance",
      "unavailable appointments",
    ],
    description: "Supply, distance, wait-time, or scheduling availability constraints.",
  },
  ADMINISTRATIVE: {
    category: "ADMINISTRATIVE",
    label: "Administrative",
    subBarriers: [
      "incomplete referral",
      "authorization requirement",
      "network confusion",
      "documentation requirement",
    ],
    description: "Payer authorization, referral paperwork, eligibility, or network navigation issues.",
  },
  FINANCIAL: {
    category: "FINANCIAL",
    label: "Financial",
    subBarriers: [
      "copay concern",
      "coverage uncertainty",
      "affordability",
    ],
    description: "Out-of-pocket cost, copay, deductible, or coverage uncertainty.",
  },
  COMMUNICATION: {
    category: "COMMUNICATION",
    label: "Communication",
    subBarriers: [
      "language",
      "digital access",
      "inability to understand healthcare instructions",
    ],
    description: "Language mismatch, limited digital access, or health-literacy/instruction friction.",
  },
  BEHAVIORAL: {
    category: "BEHAVIORAL",
    label: "Behavioral",
    subBarriers: [
      "prior missed appointments",
      "low engagement",
      "treatment uncertainty",
    ],
    description: "Engagement patterns, prior no-shows, or non-clinical ambivalence toward starting care.",
  },
  SOCIAL_LOGISTICAL: {
    category: "SOCIAL_LOGISTICAL",
    label: "Social / Logistical",
    subBarriers: [
      "transportation",
      "work schedule",
      "caregiving responsibilities",
    ],
    description: "Logistical constraints such as transit, shift work, or family caregiving.",
  },
  UNKNOWN: {
    category: "UNKNOWN",
    label: "Unknown",
    subBarriers: [BARRIER_UNKNOWN_LABEL],
    description: "Insufficient operational evidence to classify a barrier without fabrication.",
  },
};

export function isValidSubBarrier(category: BarrierCategory, subBarrier: string): boolean {
  const def = BARRIER_TAXONOMY[category];
  if (!def) return false;
  return def.subBarriers.includes(subBarrier);
}

export function getAllSubBarriers(): Array<{ category: BarrierCategory; subBarrier: string }> {
  return (Object.keys(BARRIER_TAXONOMY) as BarrierCategory[]).flatMap((category) =>
    BARRIER_TAXONOMY[category].subBarriers.map((subBarrier) => ({ category, subBarrier }))
  );
}
