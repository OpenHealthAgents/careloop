import {
  BarrierCategory,
  CaseStatus,
  CommunicationMessageType,
  InterventionType,
  ReadingLevel,
  RiskLevel,
} from "@prisma/client";
import { z } from "zod";
import { BARRIER_UNKNOWN_LABEL, isValidSubBarrier } from "@/domain/barriers/taxonomy";

export const InferenceItemSchema = z.object({
  statement: z.string().min(1),
  confidence: z.number().min(0).max(1),
  uncertainty: z.string().min(1),
  supportingSignals: z.array(z.string()).default([]),
});

export const RecommendationItemSchema = z.object({
  action: z.string().min(1),
  rationale: z.string().min(1),
  confidence: z.number().min(0).max(1),
  requiresHumanReview: z.boolean(),
});

export const BaseAIEnvelopeSchema = z.object({
  providerName: z.string().min(1),
  modelVersion: z.string().min(1),
  promptVersion: z.string().min(1).optional(),
  timestamp: z.string().datetime(),
  confidence: z.number().min(0).max(1),
  uncertainty: z.string().min(1),
  evidenceSignals: z.array(z.string()),
  facts: z.array(z.string()),
  inferences: z.array(InferenceItemSchema),
  recommendations: z.array(RecommendationItemSchema),
});

export const ClassifyBarrierResultSchema = BaseAIEnvelopeSchema.extend({
  epistemicStatus: z.enum(["INFERENCE", "UNKNOWN"]).default("INFERENCE"),
  source: z.string().min(1).default("DETERMINISTIC_RULES"),
  primaryBarrier: z
    .object({
      category: z.nativeEnum(BarrierCategory),
      subBarrier: z.string().min(1),
      rationale: z.string().min(1),
    })
    .refine(
      (val) => {
        if (val.category === "UNKNOWN") {
          return val.subBarrier === BARRIER_UNKNOWN_LABEL;
        }
        return isValidSubBarrier(val.category, val.subBarrier);
      },
      { message: "Barrier category and subBarrier must belong to the canonical CareLoop barrier taxonomy" }
    ),
  secondaryBarriers: z
    .array(
      z.object({
        category: z.nativeEnum(BarrierCategory),
        subBarrier: z.string().min(1),
        confidence: z.number().min(0).max(1),
      })
    )
    .default([]),
}).refine(
  (data) => {
    // Hallucination guard: a specific non-UNKNOWN barrier MUST cite >= 1 concrete evidence signal.
    if (data.primaryBarrier.category !== "UNKNOWN") {
      return data.evidenceSignals.length >= 1;
    }
    return true;
  },
  {
    message:
      "Hallucination guard: non-UNKNOWN barrier classification requires at least one supporting evidence signal",
  }
);

export const CalculateRiskResultSchema = BaseAIEnvelopeSchema.extend({
  priorityScore: z.number().int().min(0).max(100),
  riskTier: z.nativeEnum(RiskLevel),
  explanation: z.string().min(1),
  humanEscalationRecommended: z.boolean(),
  signalContributions: z
    .array(
      z.object({
        factor: z.string(),
        points: z.number().int(),
        signal: z.string(),
      })
    )
    .default([]),
});

export const RecommendInterventionResultSchema = BaseAIEnvelopeSchema.extend({
  proposedInterventions: z
    .array(
      z.object({
        type: z.nativeEnum(InterventionType),
        reason: z.string().min(1),
        triggeringBarrierCategory: z.nativeEnum(BarrierCategory),
        triggeringBarrierCode: z.string().min(1),
        barrierLabel: z.string().min(1).optional(),
        recommendedAction: z.string().min(1),
        executionMode: z.enum(["AUTOMATED", "HUMAN_ASSISTED", "HUMAN_ONLY"]).default("HUMAN_ASSISTED"),
        automationEligible: z.boolean(),
        isHighRisk: z.boolean().default(false),
        requiredHumanInvolvement: z
          .string()
          .min(1)
          .default("Care Manager review and approval required prior to execution."),
        expectedOutcome: z
          .string()
          .min(1)
          .default("Coordinate next step toward confirmed behavioral-health appointment."),
        evidence: z.array(z.string()).default([]),
        confidence: z.number().min(0).max(1),
      })
    )
    .min(1),
});

export const SummarizeCaseResultSchema = BaseAIEnvelopeSchema.extend({
  operationalSummary: z.string().min(1),
  openGaps: z.array(z.string()),
  nextStepSummary: z.string().min(1),
});

export const GenerateCommunicationResultSchema = BaseAIEnvelopeSchema.extend({
  channel: z.enum(["SMS", "PHONE", "EMAIL", "PORTAL"]),
  messageType: z.nativeEnum(CommunicationMessageType).default(CommunicationMessageType.HUMAN_OUTREACH),
  readingLevel: z.nativeEnum(ReadingLevel).default(ReadingLevel.PLAIN),
  templateKey: z.string().min(1).default("human_outreach.en.plain"),
  internalAiLabel: z.literal("AI_GENERATED").default("AI_GENERATED"),
  language: z.string().min(1),
  subject: z.string().optional(),
  draftMessage: z.string().min(1),
  toneNotes: z.string().min(1),
});

export const MatchProviderResultSchema = BaseAIEnvelopeSchema.extend({
  rankedMatches: z.array(
    z.object({
      providerId: z.string().min(1),
      providerName: z.string().min(1),
      matchScore: z.number().min(0).max(100),
      availabilityLabel: z.enum(["VERIFIED AVAILABILITY", "DIRECTORY DATA", "NOT AVAILABLE"]),
      recommendedForBooking: z.boolean(),
      rationale: z.string().min(1),
      availabilityWarning: z.string().nullable(),
    })
  ),
});

export const CaseOrchestratorToolSchema = z.enum([
  "run_ai_assessment",
  "human_barrier_review",
  "human_intervention_approval",
  "search_providers",
  "check_provider_availability",
  "send_member_communication",
  "request_scheduling",
  "schedule_appointment",
  "send_reminder",
  "verify_appointment",
  "verify_completion",
  "escalate_to_human",
  "close_verified_case",
]);

export const CaseOrchestratorDecisionSchema = z.object({
  goal: z.string().min(1),
  current_state: z.nativeEnum(CaseStatus),
  proposed_next_state: z.nativeEnum(CaseStatus).nullable().optional(),
  recommended_action: z.string().min(1),
  tool: CaseOrchestratorToolSchema,
  reason: z.string().min(1),
  evidence: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  requires_human: z.boolean(),
  policy_check_required: z.boolean(),
  expected_outcome: z.string().min(1),
  fallback_action: z.string().min(1),
});

export type ClassifyBarrierResult = z.infer<typeof ClassifyBarrierResultSchema>;
export type CalculateRiskResult = z.infer<typeof CalculateRiskResultSchema>;
export type RecommendInterventionResult = z.infer<typeof RecommendInterventionResultSchema>;
export type SummarizeCaseResult = z.infer<typeof SummarizeCaseResultSchema>;
export type GenerateCommunicationResult = z.infer<typeof GenerateCommunicationResultSchema>;
export type MatchProviderResult = z.infer<typeof MatchProviderResultSchema>;
export type CaseOrchestratorTool = z.infer<typeof CaseOrchestratorToolSchema>;
export type CaseOrchestratorDecision = z.infer<typeof CaseOrchestratorDecisionSchema>;
