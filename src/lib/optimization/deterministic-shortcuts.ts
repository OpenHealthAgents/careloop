import { AIOperation } from "@prisma/client";
import { ReferralAssessmentInput } from "@/ai/provider";

/**
 * ============================================================================
 * DETERMINISTIC SHORTCUTS ENGINE
 * ============================================================================
 * RULE: "Do not use an LLM when deterministic code is sufficient."
 *
 * For unambiguous operational patterns, deterministic code is:
 * - 100% cheaper (0 tokens consumed, $0.00 cost)
 * - 99.9% faster (< 2ms vs 1200ms+ network roundtrips)
 * - 100% reproducible and hallucination-free
 * ============================================================================
 */

export interface DeterministicShortcutEvaluation {
  canUseDeterministicShortcut: boolean;
  reason: string;
  detectedSignals: string[];
  recommendedModelTier: "DETERMINISTIC" | "SMALL_MODEL" | "LARGE_MODEL";
}

/**
 * Keywords and indicators that provide unambiguous evidence for deterministic resolution
 */
const UNAMBIGUOUS_BARRIER_KEYWORDS: Record<string, string[]> = {
  NO_RELIABLE_TRANSIT: ["bus", "transit", "ride", "transport", "no car", "subway", "distance"],
  HIGH_COPAY_OR_DEDUCTIBLE: ["copay", "deductible", "cost", "afford", "uninsured", "out-of-pocket"],
  PRIOR_AUTH_DELAY: ["prior auth", "authorization", "insurance approval", "paperwork delay"],
  UNREACHABLE_NO_RESPONSE: ["wrong number", "disconnected", "no answer", "voicemail full", "unreachable"],
  MISSED_FIRST_VISIT: ["missed appointment", "no-show", "did not show", "rescheduled repeatedly"],
};

/**
 * Determines whether a referral assessment can bypass LLMs completely.
 */
export function evaluateDeterministicBarrierShortcut(
  input: ReferralAssessmentInput
): DeterministicShortcutEvaluation {
  const detectedSignals: string[] = [];

  // Discrete operational flags
  if (input.verifiedAvailableSlotsCount === 0 && input.matchingProvidersCount === 0) {
    detectedSignals.push("verifiedAvailableSlotsCount is 0 (Network capacity)");
    return {
      canUseDeterministicShortcut: true,
      reason: "Network capacity exhaustion is fully determined by verified provider slot metrics.",
      detectedSignals,
      recommendedModelTier: "DETERMINISTIC",
    };
  }

  if (input.member?.transportationAccess === "NONE") {
    detectedSignals.push("member.transportationAccess is NONE");
    return {
      canUseDeterministicShortcut: true,
      reason: "Transportation barrier explicitly recorded in discrete member intake profile.",
      detectedSignals,
      recommendedModelTier: "DETERMINISTIC",
    };
  }

  if (typeof input.member?.priorNoShowCount === "number" && input.member.priorNoShowCount >= 2) {
    detectedSignals.push(`member.priorNoShowCount is ${input.member.priorNoShowCount}`);
    return {
      canUseDeterministicShortcut: true,
      reason: "Historical engagement gap is quantitatively established by prior no-show counts.",
      detectedSignals,
      recommendedModelTier: "DETERMINISTIC",
    };
  }

  // Text keyword search in operational notes
  const notes = (input.operationalNotes ?? "").toLowerCase();
  for (const [barrierKey, keywords] of Object.entries(UNAMBIGUOUS_BARRIER_KEYWORDS)) {
    const matched = keywords.filter((kw) => notes.includes(kw));
    if (matched.length > 0) {
      detectedSignals.push(`Keyword match for ${barrierKey}: [${matched.join(", ")}]`);
      return {
        canUseDeterministicShortcut: true,
        reason: `Unambiguous operational keyword pattern matching ${barrierKey}.`,
        detectedSignals,
        recommendedModelTier: "DETERMINISTIC",
      };
    }
  }

  // If notes are empty or brief and provider counts are straightforward
  if (!input.operationalNotes || input.operationalNotes.trim().length === 0) {
    return {
      canUseDeterministicShortcut: true,
      reason: "No unstructured text present; taxonomy can be evaluated strictly from discrete structured attributes.",
      detectedSignals: ["empty_operational_notes"],
      recommendedModelTier: "DETERMINISTIC",
    };
  }

  // Ambiguous reasoning required when complex contradictory text exists
  return {
    canUseDeterministicShortcut: false,
    reason: "Complex unstructured clinical or operational narrative requires semantic interpretation.",
    detectedSignals: ["unstructured_narrative"],
    recommendedModelTier: "SMALL_MODEL",
  };
}

/**
 * Checks whether an operation is eligible for deterministic execution
 */
export function isDeterministicEligible(operation: AIOperation, payload: unknown): boolean {
  switch (operation) {
    case "MATCH_PROVIDER":
      // Provider matching is 100% algorithmic / SQL-based ranking
      return true;

    case "CALCULATE_RISK":
      // Weighted numerical risk engine handles risk deterministically
      return true;

    case "RECOMMEND_INTERVENTION":
      // Rules-based mapping table maps barriers to canonical interventions
      return true;

    case "CLASSIFY_BARRIER": {
      const assessment = payload as ReferralAssessmentInput;
      return evaluateDeterministicBarrierShortcut(assessment).canUseDeterministicShortcut;
    }

    case "SUMMARIZE_CASE":
      // Summaries can be generated deterministically if standard gap analysis is sufficient
      return false;

    case "GENERATE_COMMUNICATION":
      // Outreach templates can be rendered deterministically if standard template suffices
      return false;

    default:
      return false;
  }
}
