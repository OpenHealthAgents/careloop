import { AIOperation } from "@prisma/client";

/**
 * ============================================================================
 * TIERED MODEL ROUTER
 * ============================================================================
 * PRINCIPLE:
 * - Deterministic code for unambiguous calculations and state rules
 * - Smaller models (e.g. gpt-4o-mini) for routine/simple tasks (90-95% cost reduction)
 * - Larger models (e.g. gpt-4o) ONLY when ambiguous reasoning is required
 * ============================================================================
 */

export type ModelTier = "DETERMINISTIC" | "SMALL_MODEL" | "LARGE_MODEL";

export interface ModelRoutingDecision {
  tier: ModelTier;
  selectedModel: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  reason: string;
  isAmbiguous: boolean;
}

export interface ModelAmbiguityContext {
  conflictingEvidenceCount?: number;
  unstructuredNotesLength?: number;
  hasAmbiguousSpecialty?: boolean;
  confidenceScoreThreshold?: number;
  explicitAmbiguityFlag?: boolean;
}

export const MODEL_PRICING = {
  DETERMINISTIC: {
    promptPerMillionDollars: 0,
    completionPerMillionDollars: 0,
  },
  SMALL_MODEL: {
    modelName: "gpt-4o-mini",
    promptPerMillionDollars: 0.15,
    completionPerMillionDollars: 0.60,
  },
  LARGE_MODEL: {
    modelName: "gpt-4o",
    promptPerMillionDollars: 2.50,
    completionPerMillionDollars: 10.00,
  },
} as const;

/**
 * Evaluates whether an incoming task requires larger-model ambiguous reasoning.
 */
export function detectAmbiguousReasoningNeed(
  operation: AIOperation,
  context?: ModelAmbiguityContext
): boolean {
  if (context?.explicitAmbiguityFlag) return true;
  if ((context?.conflictingEvidenceCount ?? 0) >= 2) return true;
  if (context?.hasAmbiguousSpecialty) return true;
  if (typeof context?.confidenceScoreThreshold === "number" && context.confidenceScoreThreshold < 0.7) {
    return true;
  }
  return false;
}

/**
 * Routes an AI operation to the optimal model tier:
 * - Simple tasks (communications, simple summaries) -> SMALL_MODEL
 * - Ambiguous reasoning -> LARGE_MODEL
 * - Rule-based tasks -> DETERMINISTIC
 */
export function routeModelTier(
  operation: AIOperation,
  context?: ModelAmbiguityContext
): ModelRoutingDecision {
  const isAmbiguous = detectAmbiguousReasoningNeed(operation, context);

  // If ambiguous reasoning is strictly required
  if (isAmbiguous) {
    return {
      tier: "LARGE_MODEL",
      selectedModel: MODEL_PRICING.LARGE_MODEL.modelName,
      maxTokens: 1200,
      temperature: 0.1,
      timeoutMs: 12000,
      reason: "Complex multi-signal or contradictory context requires deep semantic disambiguation.",
      isAmbiguous: true,
    };
  }

  // Simple / routine tasks use the small model
  switch (operation) {
    case "GENERATE_COMMUNICATION":
      return {
        tier: "SMALL_MODEL",
        selectedModel: MODEL_PRICING.SMALL_MODEL.modelName,
        maxTokens: 500,
        temperature: 0.3,
        timeoutMs: 4000,
        reason: "Drafting outreach messages uses lightweight fast model.",
        isAmbiguous: false,
      };

    case "SUMMARIZE_CASE":
      return {
        tier: "SMALL_MODEL",
        selectedModel: MODEL_PRICING.SMALL_MODEL.modelName,
        maxTokens: 800,
        temperature: 0.1,
        timeoutMs: 5000,
        reason: "Operational summarization runs efficiently on small model.",
        isAmbiguous: false,
      };

    case "CLASSIFY_BARRIER":
      return {
        tier: "SMALL_MODEL",
        selectedModel: MODEL_PRICING.SMALL_MODEL.modelName,
        maxTokens: 600,
        temperature: 0.0,
        timeoutMs: 4000,
        reason: "Standard barrier classification falls under structured lightweight model tier.",
        isAmbiguous: false,
      };

    case "CALCULATE_RISK":
    case "RECOMMEND_INTERVENTION":
    case "MATCH_PROVIDER":
    default:
      return {
        tier: "DETERMINISTIC",
        selectedModel: "careloop-rules-v1",
        maxTokens: 0,
        temperature: 0.0,
        timeoutMs: 100,
        reason: "Mathematical risk scoring and provider ranking use deterministic algorithms directly.",
        isAmbiguous: false,
      };
  }
}
