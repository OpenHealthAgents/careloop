import { AIOperation } from "@prisma/client";

export interface VersionedPromptTemplate {
  id: string;
  operation: AIOperation;
  version: string;
  schemaVersion: string;
  description: string;
  systemPrompt: string;
}

/**
 * Versioned prompt artifacts for CareLoop AI operations.
 * NOTE: Critical domain rules (state transitions, RBAC, consent checks,
 * verified-vs-directory availability, and non-clinical boundaries) are
 * enforced in TypeScript domain/policy layers—never exclusively in prompts.
 */
export const PROMPT_TEMPLATES: Record<AIOperation, VersionedPromptTemplate> = {
  CALCULATE_RISK: {
    id: "careloop.prompt.calculate_risk",
    operation: "CALCULATE_RISK",
    version: "2.0.0",
    schemaVersion: "CalculateRiskResultSchema.v2",
    description: "Scores operational non-completion risk without protected attributes.",
    systemPrompt:
      "You are CareLoop's non-clinical care execution risk assistant. Estimate operational referral non-completion risk (0-100) using only logistical, availability, administrative, and engagement signals. Never use protected demographic traits. Separate facts, inferences, and recommendations in strict JSON.",
  },
  CLASSIFY_BARRIER: {
    id: "careloop.prompt.classify_barrier",
    operation: "CLASSIFY_BARRIER",
    version: "2.0.0",
    schemaVersion: "ClassifyBarrierResultSchema.v2",
    description: "Maps observed operational signals to canonical barrier taxonomy.",
    systemPrompt:
      "You are CareLoop's non-clinical barrier classification assistant. Classify only into canonical categories (ACCESS, ADMINISTRATIVE, FINANCIAL, COMMUNICATION, BEHAVIORAL, SOCIAL_LOGISTICAL, UNKNOWN). If evidence is insufficient, output category UNKNOWN and subBarrier 'Barrier unknown'. Never fabricate reasons. Output strict JSON.",
  },
  RECOMMEND_INTERVENTION: {
    id: "careloop.prompt.recommend_intervention",
    operation: "RECOMMEND_INTERVENTION",
    version: "2.0.0",
    schemaVersion: "RecommendInterventionResultSchema.v1",
    description: "Suggests non-clinical navigation interventions for Care Manager review.",
    systemPrompt:
      "You are CareLoop's care navigation assistant. Propose practical non-clinical interventions aligned to the identified barrier. Never diagnose, prescribe medication, or provide psychotherapy. Output strict JSON.",
  },
  SUMMARIZE_CASE: {
    id: "careloop.prompt.summarize_case",
    operation: "SUMMARIZE_CASE",
    version: "1.1.0",
    schemaVersion: "SummarizeCaseResultSchema.v1",
    description: "Produces factual operational case summary highlighting open gaps.",
    systemPrompt:
      "You are CareLoop's operational case summarizer. Summarize verified facts, open scheduling/verification gaps, and next operational steps without clinical claims. Output strict JSON.",
  },
  GENERATE_COMMUNICATION: {
    id: "careloop.prompt.generate_communication",
    operation: "GENERATE_COMMUNICATION",
    version: "1.2.0",
    schemaVersion: "GenerateCommunicationResultSchema.v1",
    description: "Drafts warm, plain-language care navigation outreach in member's preferred language.",
    systemPrompt:
      "You are CareLoop's member care coordination drafting assistant. Write warm, supportive scheduling outreach in the member's preferred language. Never sound like a chatbot and never offer clinical advice. Output strict JSON.",
  },
  MATCH_PROVIDER: {
    id: "careloop.prompt.match_provider",
    operation: "MATCH_PROVIDER",
    version: "1.0.0",
    schemaVersion: "MatchProviderResultSchema.v1",
    description: "Ranks candidate providers while respecting verified vs directory availability.",
    systemPrompt:
      "You are CareLoop's provider matching assistant. Rank providers by specialty, network, language, geography, and availability. Never present DIRECTORY_INFORMATION as VERIFIED AVAILABILITY. Output strict JSON.",
  },
};

export const ORCHESTRATOR_PROMPT_VERSION = "careloop.orchestrator.v1.0.0";
export const ORCHESTRATOR_MODEL_DEFAULT = "deterministic-orchestrator-v1";

export function getPromptTemplate(operation: AIOperation): VersionedPromptTemplate {
  return PROMPT_TEMPLATES[operation];
}
