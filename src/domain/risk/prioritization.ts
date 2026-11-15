import { RiskLevel } from "@prisma/client";
import { ValidationError } from "@/lib/errors";
import type { RiskScoringInput, RiskScoringOutput, RiskSignalContribution } from "./risk-engine";

export interface RiskPrioritizationRecord {
  caseId: string;
  referralId: string;
  risk_score: number;
  risk_band: RiskLevel;
  factors: RiskSignalContribution[];
  model_version: string;
  created_at: string;
  determinesClinicalTreatment: false;
}

const SENSITIVE_DEMOGRAPHIC_KEYS = [
  "race",
  "ethnicity",
  "raceEthnicity",
  "gender",
  "sex",
  "sexualOrientation",
  "religion",
  "disability",
  "incomeBracket",
] as const;

const CLINICAL_TREATMENT_PATTERNS = [
  /\bprescribe\b/i,
  /\bmedication\b/i,
  /\bdosage\b/i,
  /\bdiagnos(e|is)\b/i,
  /\bclinical\s+treatment\b/i,
  /\bantidepressant\b/i,
  /\bpsychotropic\b/i,
];

/**
 * Governance guard: ensures risk prioritization explains operational drop-off risk
 * ("which cases deserve attention first") and never prescribes clinical treatment.
 */
export function assertNoClinicalTreatmentDirective(output: Pick<RiskScoringOutput, "explanation" | "supportingSignals">): void {
  const texts = [output.explanation, ...output.supportingSignals.map((s) => s.signal)];
  for (const text of texts) {
    for (const pattern of CLINICAL_TREATMENT_PATTERNS) {
      if (pattern.test(text)) {
        throw new ValidationError(
          `Risk prioritization violation: output must not prescribe clinical treatment (matched ${pattern.source}).`
        );
      }
    }
  }
}

/**
 * Governance guard: verifies protected/sensitive attributes are excluded from risk scoring inputs
 * and reserved strictly for health equity measurement and monitoring.
 */
export function stripSensitiveAttributesForRiskScoring<T extends Record<string, unknown>>(
  rawInput: T
): Omit<T, (typeof SENSITIVE_DEMOGRAPHIC_KEYS)[number]> & RiskScoringInput {
  const cleaned: Record<string, unknown> = { ...rawInput };
  for (const key of SENSITIVE_DEMOGRAPHIC_KEYS) {
    delete cleaned[key];
  }
  if (cleaned.member && typeof cleaned.member === "object" && cleaned.member !== null) {
    const cleanedMember: Record<string, unknown> = {
      ...(cleaned.member as Record<string, unknown>),
    };
    for (const key of SENSITIVE_DEMOGRAPHIC_KEYS) {
      delete cleanedMember[key];
    }
    cleaned.member = cleanedMember;
  }
  return cleaned as Omit<T, (typeof SENSITIVE_DEMOGRAPHIC_KEYS)[number]> & RiskScoringInput;
}

export function toRiskPrioritizationRecord(params: {
  caseId: string;
  referralId: string;
  output: RiskScoringOutput;
}): RiskPrioritizationRecord {
  assertNoClinicalTreatmentDirective(params.output);
  return {
    caseId: params.caseId,
    referralId: params.referralId,
    risk_score: params.output.riskScore,
    risk_band: params.output.riskLevel,
    factors: params.output.supportingSignals,
    model_version: params.output.modelVersion,
    created_at: params.output.calculatedAt,
    determinesClinicalTreatment: false,
  };
}

/**
 * Deterministically ranks cases by attention priority (highest risk_score first,
 * breaking ties by earliest created_at timestamp).
 */
export function rankCasesByAttentionPriority(
  records: RiskPrioritizationRecord[]
): Array<RiskPrioritizationRecord & { priorityRank: number }> {
  const sorted = [...records].sort((a, b) => {
    if (b.risk_score !== a.risk_score) {
      return b.risk_score - a.risk_score;
    }
    return a.created_at.localeCompare(b.created_at);
  });

  return sorted.map((record, index) => ({
    ...record,
    priorityRank: index + 1,
  }));
}
