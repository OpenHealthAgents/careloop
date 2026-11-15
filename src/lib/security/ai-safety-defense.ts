import { z } from "zod";
import { ValidationError } from "@/lib/errors";
import { CaseOrchestratorDecision } from "@/ai/schemas";

/**
 * ============================================================================
 * AI SAFETY & UNTRUSTED MODEL DEFENSE SYSTEM
 * ============================================================================
 * CORE PRINCIPLE:
 *   LLM output ≠ trusted instruction.
 *   All model outputs are untrusted external proposals until validated by
 *   deterministic schemas, policy engines, and human governance gates.
 * ============================================================================
 */

export const HOSTILE_INJECTION_PATTERNS: readonly RegExp[] = [
  /\b(?:ignore|disregard|forget|override)\s+(?:all\s+)?(?:prior|previous|above|system)\s+(?:instructions?|rules?|prompts?|constraints?)\b/i,
  /\b(?:system\s*directive|admin\s*override|developer\s*mode|god\s*mode|sudo\s+mode|jailbreak)\b/i,
  /\b(?:you\s+must\s+now|new\s+system\s+prompt|operating\s+as\s+root|role:\s*system)\b/i,
  /\b(?:(?:bypass|override)\s+(?:policy|guard|filter|check)|skip\s+(?:human\s+)?approval|mark\s+as\s+pre-?approved)\b/i,
  /\b(?:exfiltrate|leak|dump)\s+(?:phi|database|credentials|tokens|keys|passwords?)\b/i,
  /<\s*script\b/i,
  /\bjavascript:\s*void|eval\s*\(/i,
  /\b(?:drop\s+table|delete\s+from\s+users|truncate\s+table)\b/i,
];

export class UntrustedModelOutputError extends ValidationError {
  constructor(message: string, details?: unknown) {
    super(`Untrusted Model Output Rejected: ${message}`, details);
  }
}

/**
 * Recursively scans any payload (string, object, array) for hostile prompt injection,
 * command injection, or instruction-poisoning patterns.
 */
export function scanForPromptInjection(value: unknown, path = "root"): string[] {
  const violations: string[] = [];

  if (typeof value === "string") {
    for (const pattern of HOSTILE_INJECTION_PATTERNS) {
      if (pattern.test(value)) {
        violations.push(
          `Hostile instruction pattern (${pattern.source}) detected at '${path}'.`
        );
      }
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => {
      violations.push(...scanForPromptInjection(item, `${path}[${index}]`));
    });
  } else if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      violations.push(...scanForPromptInjection(val, `${path}.${key}`));
    }
  }

  return violations;
}

/**
 * Asserts that an input string does not contain prompt injection or instruction hijacking markers.
 * Throws UntrustedModelOutputError if a violation is detected.
 */
export function assertSafeUntrustedInput(text: string, context = "input"): void {
  const violations = scanForPromptInjection(text, context);
  if (violations.length > 0) {
    throw new UntrustedModelOutputError(
      `Input contains hostile instruction overriding patterns at ${context}.`,
      { violations }
    );
  }
}

export interface ValidatedModelProposal<T> {
  source: "UNTRUSTED_AI_MODEL";
  operation: string;
  verified: true;
  data: T;
  timestamp: string;
  advisoryOnly: true;
}

/**
 * Validates untrusted LLM output with multi-layered defense:
 * 1. Confirms input is not treated as a trusted instruction.
 * 2. Strict JSON parsing (rejects arbitrary executable prose or script injection).
 * 3. Scans recursively for instruction overrides, jailbreaks, and injection tokens.
 * 4. Strictly validates against the target Zod schema.
 * 5. Returns a typed, validated proposal labeled `advisoryOnly: true`.
 */
export function validateUntrustedModelOutput<T>(
  rawContent: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  operation: string
): ValidatedModelProposal<T> {
  // Step 1: Parse JSON strictly
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawContent);
  } catch {
    throw new UntrustedModelOutputError(
      `Malformed JSON returned by AI provider for '${operation}'. Model output cannot be executed.`
    );
  }

  // Step 2: Scan parsed JSON for prompt/command injection patterns
  const injectionViolations = scanForPromptInjection(parsedJson, operation);
  if (injectionViolations.length > 0) {
    throw new UntrustedModelOutputError(
      `Prompt injection or unauthorized instruction detected in model output for '${operation}'. Output is untrusted and rejected.`,
      { violations: injectionViolations }
    );
  }

  // Step 3: Schema Conformance Check
  const validated = schema.safeParse(parsedJson);
  if (!validated.success) {
    throw new UntrustedModelOutputError(
      `Schema validation failed for AI operation '${operation}'. Model output does not conform to required contract.`,
      { issues: validated.error.issues }
    );
  }

  // Step 4: Return advisory proposal wrapper
  return {
    source: "UNTRUSTED_AI_MODEL",
    operation,
    verified: true,
    data: validated.data,
    timestamp: new Date().toISOString(),
    advisoryOnly: true,
  };
}

/**
 * Defends against Tool Injection & Privilege Escalation by LLM Decisions.
 * Ensures the model cannot unilaterally:
 * 1. Mark an action as "human approved"
 * 2. Bypass policy evaluation (policy_check_required must remain true)
 * 3. Invoke unauthorized or unregistered tools
 * 4. Claim high-risk actions do not require human review
 */
export function assertModelCannotBypassHumanApproval(
  decision: CaseOrchestratorDecision,
  context?: { riskTier?: string; isHighRiskTool?: boolean }
): void {
  // Model cannot set policy_check_required to false
  if (decision.policy_check_required === false) {
    throw new UntrustedModelOutputError(
      "Tool injection defense: Model output cannot disable 'policy_check_required'."
    );
  }

  // Model cannot bypass human approval on high-risk cases or high-risk tools
  const isHighRisk = context?.riskTier === "HIGH" || context?.isHighRiskTool === true;
  if (isHighRisk && decision.requires_human === false) {
    throw new UntrustedModelOutputError(
      "Privilege escalation defense: Model cannot waive human approval ('requires_human: false') on high-risk cases or tools."
    );
  }
}
