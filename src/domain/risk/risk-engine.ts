import { RiskLevel } from "@prisma/client";

/**
 * Operational input for referral non-completion risk prioritization.
 * GOVERNANCE: Protected demographic attributes (race, ethnicity, gender, etc.)
 * are intentionally excluded so risk scores are never derived from protected traits.
 */
export interface RiskScoringInput {
  referralId: string;
  referralDate: Date;
  urgency: string;
  specialty: string;
  geography: string;
  networkRequired: string;
  preferredLanguage: string;
  eligibilityVerified: string;
  referringProviderName?: string | null;
  operationalNotes?: string | null;
  member: {
    urbanicity: string;
    eligibilityStatus: string;
    digitalAccessLevel: string;
    transportationAccess: string;
    priorNoShowCount: number;
    priorFailedReferralsCount?: number;
    historicalEngagementRate: number | null;
  };
  matchingProvidersCount: number;
  inNetworkProvidersCount: number;
  languageConcordantProvidersCount: number;
  verifiedAvailableSlotsCount: number;
  minDirectoryWaitDays: number | null;
  now?: Date;
}

export interface RiskSignalContribution {
  factor: string;
  points: number;
  signal: string;
}

export interface RiskScoringOutput {
  riskLevel: RiskLevel;
  riskScore: number;
  supportingSignals: RiskSignalContribution[];
  explanation: string;
  confidence: number;
  uncertainty: string;
  calculatedAt: string;
  modelVersion: string;
  modelType: "DETERMINISTIC" | "ML";
  humanEscalationRecommended: boolean;
}

/**
 * Pluggable risk prioritization engine interface.
 * Allows replacing or ensembling the deterministic rules engine
 * with a calibrated ML survival/propensity model without changing callers.
 */
export interface RiskScoringEngine {
  readonly modelVersion: string;
  readonly modelType: "DETERMINISTIC" | "ML";
  scoreReferral(input: RiskScoringInput): Promise<RiskScoringOutput>;
}

export class DeterministicRiskEngine implements RiskScoringEngine {
  public readonly modelVersion: string;
  public readonly modelType = "DETERMINISTIC" as const;

  constructor(modelVersion = "careloop-deterministic-risk-v2") {
    this.modelVersion = modelVersion;
  }

  async scoreReferral(input: RiskScoringInput): Promise<RiskScoringOutput> {
    const now = input.now ?? new Date();
    const notes = (input.operationalNotes ?? "").toLowerCase();
    const signals: RiskSignalContribution[] = [];

    if (Number.isNaN(input.referralDate.getTime())) {
      return {
        riskLevel: RiskLevel.UNKNOWN,
        riskScore: 0,
        supportingSignals: [],
        explanation: "Cannot calculate referral risk because referral date is missing or invalid.",
        confidence: 0.2,
        uncertainty: "Missing valid referral date; human review required.",
        calculatedAt: now.toISOString(),
        modelVersion: this.modelVersion,
        modelType: this.modelType,
        humanEscalationRecommended: true,
      };
    }

    let score = 15; // baseline behavioral-health referral drop-off risk

    // 1. Referral age
    const ageDays = Math.max(
      0,
      Math.floor((now.getTime() - input.referralDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    if (ageDays >= 21) {
      signals.push({
        factor: "REFERRAL_AGE",
        points: 20,
        signal: `Referral aging ${ageDays} days without completed visit`,
      });
      score += 20;
    } else if (ageDays >= 14) {
      signals.push({
        factor: "REFERRAL_AGE",
        points: 15,
        signal: `Referral aging ${ageDays} days (>= 14d threshold)`,
      });
      score += 15;
    } else if (ageDays >= 7) {
      signals.push({
        factor: "REFERRAL_AGE",
        points: 8,
        signal: `Referral aging ${ageDays} days`,
      });
      score += 8;
    }

    // 2. Urgency / SLA sensitivity
    if (input.urgency === "EXPEDITED") {
      signals.push({
        factor: "URGENCY_SLA",
        points: 12,
        signal: "Marked EXPEDITED operational priority",
      });
      score += 12;
    } else if (input.urgency === "PRIORITY") {
      signals.push({
        factor: "URGENCY_SLA",
        points: 6,
        signal: "Marked PRIORITY operational urgency",
      });
      score += 6;
    }

    // 3. Provider availability
    if (input.matchingProvidersCount === 0) {
      signals.push({
        factor: "PROVIDER_AVAILABILITY",
        points: 18,
        signal: `Zero matching ${input.specialty} providers in ${input.geography}`,
      });
      score += 18;
    } else if (input.verifiedAvailableSlotsCount === 0) {
      signals.push({
        factor: "PROVIDER_AVAILABILITY",
        points: 12,
        signal: "Zero verified open appointment slots available",
      });
      score += 12;
    }

    // 4. Scheduling delay (directory wait time)
    if (input.minDirectoryWaitDays !== null && input.minDirectoryWaitDays >= 21) {
      signals.push({
        factor: "SCHEDULING_DELAY",
        points: 10,
        signal: `Minimum directory wait estimate is ${input.minDirectoryWaitDays} days`,
      });
      score += 10;
    }

    // 5. Network mismatch
    if (input.networkRequired !== "UNKNOWN" && input.inNetworkProvidersCount === 0) {
      signals.push({
        factor: "NETWORK_MISMATCH",
        points: 15,
        signal: `No verified in-network providers for ${input.networkRequired}`,
      });
      score += 15;
    }

    // 6. Language / provider mismatch
    if (
      input.preferredLanguage.toLowerCase() !== "english" &&
      input.languageConcordantProvidersCount === 0
    ) {
      signals.push({
        factor: "LANGUAGE_MISMATCH",
        points: 15,
        signal: `No ${input.preferredLanguage}-concordant provider matched`,
      });
      score += 15;
    }

    // 7. Geographic / transportation access
    if (input.member.transportationAccess === "NONE") {
      signals.push({
        factor: "GEOGRAPHIC_ACCESS",
        points: 12,
        signal: "Member lacks reliable transportation",
      });
      score += 12;
    } else if (input.member.urbanicity === "RURAL" && input.verifiedAvailableSlotsCount === 0) {
      signals.push({
        factor: "GEOGRAPHIC_ACCESS",
        points: 10,
        signal: "Rural geography with no verified local slots",
      });
      score += 10;
    }

    // 8. Previous missed appointments
    if (input.member.priorNoShowCount >= 2) {
      signals.push({
        factor: "PRIOR_MISSED_APPOINTMENTS",
        points: 20,
        signal: `${input.member.priorNoShowCount} prior missed appointments recorded`,
      });
      score += 20;
    } else if (input.member.priorNoShowCount === 1) {
      signals.push({
        factor: "PRIOR_MISSED_APPOINTMENTS",
        points: 10,
        signal: "1 prior missed appointment recorded",
      });
      score += 10;
    }

    // 9. Previous failed referral attempts / low engagement
    const priorFailed = input.member.priorFailedReferralsCount ?? 0;
    if (priorFailed > 0) {
      const pts = Math.min(18, priorFailed * 9);
      signals.push({
        factor: "PRIOR_FAILED_REFERRALS",
        points: pts,
        signal: `${priorFailed} previous failed referral attempt(s)`,
      });
      score += pts;
    } else if (
      input.member.historicalEngagementRate !== null &&
      input.member.historicalEngagementRate < 0.45
    ) {
      signals.push({
        factor: "LOW_ENGAGEMENT_HISTORY",
        points: 8,
        signal: `Low historical engagement rate (${Math.round(
          input.member.historicalEngagementRate * 100
        )}%)`,
      });
      score += 8;
    }

    // 10. Incomplete referral & unresolved administrative requirements
    if (
      input.eligibilityVerified === "UNVERIFIED" ||
      input.member.eligibilityStatus === "PENDING"
    ) {
      signals.push({
        factor: "UNRESOLVED_ADMIN",
        points: 12,
        signal: "Eligibility or authorization status is unverified/pending",
      });
      score += 12;
    }
    if (
      !input.referringProviderName ||
      notes.includes("incomplete") ||
      notes.includes("missing") ||
      notes.includes("auth")
    ) {
      signals.push({
        factor: "INCOMPLETE_REFERRAL",
        points: 8,
        signal: "Referral packet or authorization documentation requires completion",
      });
      score += 8;
    }

    if (input.member.digitalAccessLevel === "NONE") {
      signals.push({
        factor: "DIGITAL_ACCESS",
        points: 6,
        signal: "No digital access for portal or telehealth self-scheduling",
      });
      score += 6;
    }

    const boundedScore = Math.max(5, Math.min(98, score));
    let riskLevel: RiskLevel = RiskLevel.LOW;
    if (boundedScore >= 70) riskLevel = RiskLevel.HIGH;
    else if (boundedScore >= 45) riskLevel = RiskLevel.MEDIUM;

    // Confidence scales with completeness of structured operational fields
    const knownFields = [
      input.eligibilityVerified !== "UNKNOWN",
      input.member.transportationAccess !== "UNKNOWN",
      input.member.digitalAccessLevel !== "UNKNOWN",
      input.networkRequired !== "UNKNOWN",
      input.member.historicalEngagementRate !== null,
    ].filter(Boolean).length;
    const confidence = Number((0.45 + knownFields * 0.09).toFixed(2));

    const sortedSignals = [...signals].sort((a, b) => b.points - a.points);
    const explanation =
      sortedSignals.length > 0
        ? `Risk ${riskLevel} (${boundedScore}/100) driven by: ${sortedSignals
            .map((s) => `${s.signal} (+${s.points})`)
            .join("; ")}.`
        : `Risk ${riskLevel} (${boundedScore}/100) — baseline operational profile with no elevated barrier signals detected.`;

    return {
      riskLevel,
      riskScore: boundedScore,
      supportingSignals: sortedSignals,
      explanation,
      confidence,
      uncertainty:
        knownFields < 3
          ? "Several intake context fields are UNKNOWN; verify logistical needs with member."
          : "Operational drop-off estimate only (non-clinical); protected characteristics excluded.",
      calculatedAt: now.toISOString(),
      modelVersion: this.modelVersion,
      modelType: this.modelType,
      humanEscalationRecommended: boundedScore >= 75 || sortedSignals.length >= 4,
    };
  }
}
