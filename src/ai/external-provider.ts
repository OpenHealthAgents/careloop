import { AIOperation } from "@prisma/client";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { AuthorizationError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { minimizePayloadForLLM } from "@/lib/security/phi-minimization";
import { validateUntrustedModelOutput } from "@/lib/security/ai-safety-defense";
import { assertSecureTransportUrl, assertVendorBaaBoundary } from "@/lib/security/transport";
import {
  isDeterministicEligible,
  routeModelTier,
  safeAICache,
  executeWithRetryAndTimeout,
  ModelAmbiguityContext,
} from "@/lib/optimization";
import { DeterministicAIProvider } from "./deterministic-provider";
import { getPromptTemplate } from "./prompts/registry";
import {
  AIProvider,
  GenerateCommunicationInput,
  MatchProviderAIInput,
  RecommendInterventionInput,
  ReferralAssessmentInput,
  SummarizeCaseInput,
} from "./provider";
import {
  CalculateRiskResult,
  CalculateRiskResultSchema,
  ClassifyBarrierResult,
  ClassifyBarrierResultSchema,
  GenerateCommunicationResult,
  GenerateCommunicationResultSchema,
  MatchProviderResult,
  MatchProviderResultSchema,
  RecommendInterventionResult,
  RecommendInterventionResultSchema,
  SummarizeCaseResult,
  SummarizeCaseResultSchema,
} from "./schemas";

/**
 * Validates raw text returned by an external LLM against the expected Zod schema.
 * Treats all model output as untrusted until validated, scanning for prompt injections
 * and instruction hijacking before schema conformance.
 */
export function parseAndValidateModelJson<T>(
  rawContent: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  operation: string
): T {
  const proposal = validateUntrustedModelOutput(rawContent, schema, operation);
  return proposal.data;
}

export interface ExternalProviderOptions {
  modelVersion?: string;
  /**
   * When true, malformed LLM outputs throw ValidationError instead of falling back
   * to DeterministicAIProvider. Useful for strict validation pipelines and tests.
   */
  strictRejectMalformed?: boolean;
  enableCaching?: boolean;
  enableDeterministicShortcuts?: boolean;
  enableTieredRouting?: boolean;
  timeoutMs?: number;
}

/**
 * OpenAI-compatible external LLM adapter.
 * Uses versioned prompt artifacts from src/ai/prompts/registry.ts.
 * Every external LLM response is strictly schema-validated with Zod;
 * never writes directly to the database.
 */
export class ExternalOpenAIProvider implements AIProvider {
  public readonly name = "OpenAI-Compatible-Provider";
  public readonly modelVersion: string;
  private readonly strictRejectMalformed: boolean;
  private readonly enableCaching: boolean;
  private readonly enableDeterministicShortcuts: boolean;
  private readonly enableTieredRouting: boolean;
  private readonly timeoutMs: number;
  private readonly fallback = new DeterministicAIProvider();

  constructor(modelVersionOrOptions: string | ExternalProviderOptions = "gpt-4o-mini") {
    if (typeof modelVersionOrOptions === "string") {
      this.modelVersion = modelVersionOrOptions;
      this.strictRejectMalformed = false;
      this.enableCaching = false;
      this.enableDeterministicShortcuts = false;
      this.enableTieredRouting = false;
      this.timeoutMs = 8000;
    } else {
      this.modelVersion = modelVersionOrOptions.modelVersion ?? "gpt-4o-mini";
      this.strictRejectMalformed = Boolean(modelVersionOrOptions.strictRejectMalformed);
      this.enableCaching = Boolean(modelVersionOrOptions.enableCaching);
      this.enableDeterministicShortcuts = Boolean(modelVersionOrOptions.enableDeterministicShortcuts);
      this.enableTieredRouting = Boolean(modelVersionOrOptions.enableTieredRouting);
      this.timeoutMs = modelVersionOrOptions.timeoutMs ?? 8000;
    }
  }

  private async callStructured<T>(
    operation: AIOperation,
    userPayload: unknown,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    fallbackFn: () => Promise<T>
  ): Promise<T> {
    const config = getConfig();
    const template = getPromptTemplate(operation);

    if (!config.OPENAI_API_KEY) {
      logger.warn("ai.external_missing_key_fallback", { operation });
      return fallbackFn();
    }

    // 1. Deterministic shortcut check: "Do not use an LLM when deterministic code is sufficient."
    if (this.enableDeterministicShortcuts && isDeterministicEligible(operation, userPayload)) {
      return fallbackFn();
    }

    assertVendorBaaBoundary();
    assertSecureTransportUrl(config.OPENAI_BASE_URL, "AI vendor endpoint");
    const minimizedPayload = minimizePayloadForLLM(userPayload);

    // 2. Safe cache lookup
    const cacheKey = this.enableCaching
      ? safeAICache.computeKey(config.AI_VENDOR_NAME, operation, minimizedPayload)
      : null;

    if (cacheKey) {
      const cached = safeAICache.get<T>(cacheKey);
      if (cached) {
        return {
          ...cached,
          promptVersion: template.version,
        };
      }
    }

    // 3. Tiered model selection (small model for simple, large model only for ambiguous reasoning)
    const routing = this.enableTieredRouting
      ? routeModelTier(
          operation,
          (userPayload as Record<string, unknown>)?.ambiguityContext as ModelAmbiguityContext
        )
      : null;
    const effectiveModel = routing?.selectedModel ?? this.modelVersion;
    const effectiveTimeoutMs = routing?.timeoutMs ?? this.timeoutMs;

    try {
      const response = await executeWithRetryAndTimeout(
        async (signal) => {
          return fetch(`${config.OPENAI_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.OPENAI_API_KEY}`,
            },
            signal,
            body: JSON.stringify({
              model: effectiveModel,
              temperature: routing?.temperature ?? 0.1,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: template.systemPrompt },
                { role: "user", content: JSON.stringify(minimizedPayload) },
              ],
            }),
          });
        },
        { timeoutMs: effectiveTimeoutMs, operationName: operation, maxAttempts: 3 }
      );

      if (!response.ok) {
        throw new Error(`LLM HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent) {
        throw new ValidationError(`Empty LLM content for ${operation}`);
      }

      const validated = parseAndValidateModelJson(rawContent, schema, operation);
      const result = {
        ...validated,
        promptVersion: template.version,
      };

      if (cacheKey) {
        safeAICache.set(cacheKey, validated, operation);
      }

      return result;
    } catch (err) {
      if (err instanceof AuthorizationError) {
        throw err;
      }
      if (this.strictRejectMalformed && err instanceof ValidationError) {
        throw err;
      }
      logger.warn("ai.external_call_failed_fallback", {
        operation,
        promptVersion: template.version,
        error: err instanceof Error ? err.message : "unknown",
      });
      return fallbackFn();
    }
  }

  async classifyBarrier(input: ReferralAssessmentInput): Promise<ClassifyBarrierResult> {
    return this.callStructured(
      "CLASSIFY_BARRIER",
      input,
      ClassifyBarrierResultSchema,
      () => this.fallback.classifyBarrier(input)
    );
  }

  async calculateRisk(input: ReferralAssessmentInput): Promise<CalculateRiskResult> {
    return this.callStructured(
      "CALCULATE_RISK",
      input,
      CalculateRiskResultSchema,
      () => this.fallback.calculateRisk(input)
    );
  }

  async recommendIntervention(
    input: RecommendInterventionInput
  ): Promise<RecommendInterventionResult> {
    return this.callStructured(
      "RECOMMEND_INTERVENTION",
      input,
      RecommendInterventionResultSchema,
      () => this.fallback.recommendIntervention(input)
    );
  }

  async summarizeCase(input: SummarizeCaseInput): Promise<SummarizeCaseResult> {
    return this.callStructured(
      "SUMMARIZE_CASE",
      input,
      SummarizeCaseResultSchema,
      () => this.fallback.summarizeCase(input)
    );
  }

  async generateMemberCommunication(
    input: GenerateCommunicationInput
  ): Promise<GenerateCommunicationResult> {
    return this.callStructured(
      "GENERATE_COMMUNICATION",
      input,
      GenerateCommunicationResultSchema,
      () => this.fallback.generateMemberCommunication(input)
    );
  }

  async matchProvider(input: MatchProviderAIInput): Promise<MatchProviderResult> {
    return this.callStructured(
      "MATCH_PROVIDER",
      {
        caseId: input.caseId,
        criteria: input.criteria,
        candidates: input.candidates.map((c) => ({
          id: c.id,
          name: c.name,
          specialty: c.specialty,
          languages: c.languages,
          geography: c.geography,
          availabilitySource: c.availabilitySource,
          verifiedSlotCount: c.verifiedSlots.length,
        })),
      },
      MatchProviderResultSchema,
      () => this.fallback.matchProvider(input)
    );
  }
}
