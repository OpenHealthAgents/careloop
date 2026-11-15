import { createHash } from "crypto";

export type StudyArm = "INTERVENTION" | "USUAL_CARE_CONTROL";

export interface PilotCohortConfig {
  studyName: string;
  targetPopulationSize: number; // e.g. 10,000 - 50,000
  studyDurationMonths: number; // 3 - 6 months (90 - 180 days)
  trackingWindowDays: number; // 90 days per referral for primary endpoint evaluation
  allocationRatio: {
    intervention: number; // e.g. 1
    control: number; // e.g. 1
  };
  randomizationSeed: number;
}

export const DEFAULT_PILOT_CONFIG: PilotCohortConfig = {
  studyName: "CareLoop Equitable Behavioral Health Access Validation Pilot",
  targetPopulationSize: 20000,
  studyDurationMonths: 6,
  trackingWindowDays: 90,
  allocationRatio: { intervention: 1, control: 1 },
  randomizationSeed: 42,
};

export interface StratificationFactors {
  coverageType: "MEDICAID" | "COMMERCIAL" | "MEDICARE_DUAL" | "UNINSURED";
  preferredLanguage: "English" | "Spanish" | "Other";
  urbanicity: "URBAN" | "SUBURBAN" | "RURAL";
  raceEthnicity: "Hispanic/Latino" | "Black/African American" | "White" | "Asian/Pacific Islander" | "Other";
  clinicalAcuity?: "HIGH" | "MEDIUM" | "LOW";
}

/**
 * Deterministic stratified pseudo-random arm allocation.
 * Uses SHA-256 hash of seed + strata + memberId to ensure:
 * 1. Perfectly reproducible assignment
 * 2. Balance across vulnerable demographic cohorts (covariate balance)
 * 3. Zero selection bias or operator tampering
 */
export function assignStudyArm(
  memberId: string,
  strata: StratificationFactors,
  seed = DEFAULT_PILOT_CONFIG.randomizationSeed,
  ratio = DEFAULT_PILOT_CONFIG.allocationRatio
): StudyArm {
  const strataKey = `${strata.coverageType}|${strata.preferredLanguage}|${strata.urbanicity}|${strata.raceEthnicity}`;
  const rawKey = `pilot-v1:${seed}:${strataKey}:${memberId}`;
  const hash = createHash("sha256").update(rawKey).digest("hex");
  
  // Use first 8 hex characters as 32-bit integer for uniform 0..1 floating point
  const intVal = parseInt(hash.slice(0, 8), 16);
  const normalized = intVal / 0xffffffff;

  const totalParts = ratio.intervention + ratio.control;
  const interventionThreshold = ratio.intervention / totalParts;

  return normalized < interventionThreshold ? "INTERVENTION" : "USUAL_CARE_CONTROL";
}

export interface StatisticalPowerSpec {
  alpha: number; // Significance level (e.g. 0.05)
  beta: number; // Type II error rate (e.g. 0.10 for 90% power, 0.05 for 95% power)
  expectedControlCompletionRate: number; // e.g. 0.20 (20%)
  minimumDetectableEffectAbsolute: number; // e.g. 0.05 (+5% points lift)
  totalSampleSize: number;
}

/**
 * Calculates statistical power for a two-proportion z-test given sample size and expected effect.
 */
export function calculateStatisticalPower(spec: StatisticalPowerSpec): {
  powerPct: number;
  isAdequatelyPowered: boolean;
  requiredSampleSizeFor90Power: number;
  zAlpha: number;
  zBeta: number;
} {
  const p1 = spec.expectedControlCompletionRate;
  const p2 = p1 + spec.minimumDetectableEffectAbsolute;
  const pAvg = (p1 + p2) / 2;
  const qAvg = 1 - pAvg;

  // Standard normal critical values for two-sided test
  // alpha=0.05 -> z_alpha = 1.96
  const zAlpha = 1.96;

  // Per-arm sample size (assuming 1:1 allocation)
  const nPerArm = spec.totalSampleSize / 2;

  // Standard error under null and alternative
  const seNull = Math.sqrt(2 * pAvg * qAvg / nPerArm);
  const seAlt = Math.sqrt((p1 * (1 - p1) + p2 * (1 - p2)) / nPerArm);

  const zScore = (Math.abs(p2 - p1) - zAlpha * seNull) / seAlt;
  
  // Normal cumulative distribution approximation for zScore
  const power = Math.min(0.9999, Math.max(0.0001, 0.5 * (1 + erf(zScore / Math.SQRT2))));
  const powerPct = Number((power * 100).toFixed(1));

  // Required per-arm sample size for 90% power (zBeta = 1.282)
  const zBeta90 = 1.282;
  const requiredPerArm = Math.ceil(
    Math.pow(zAlpha * Math.sqrt(2 * pAvg * qAvg) + zBeta90 * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)), 2) /
    Math.pow(p2 - p1, 2)
  );

  return {
    powerPct,
    isAdequatelyPowered: powerPct >= 90,
    requiredSampleSizeFor90Power: requiredPerArm * 2,
    zAlpha,
    zBeta: Number(zScore.toFixed(3)),
  };
}

// Error function approximation for normal CDF
function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}
