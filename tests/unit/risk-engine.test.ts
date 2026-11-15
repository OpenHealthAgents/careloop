import { describe, expect, it } from "vitest";
import { RiskLevel } from "@prisma/client";
import {
  DeterministicRiskEngine,
  RiskScoringEngine,
  RiskScoringInput,
} from "@/domain/risk/risk-engine";

describe("Deterministic Referral Risk Prioritization Engine", () => {
  const fixedNow = new Date("2026-11-11T12:00:00Z");
  const engine = new DeterministicRiskEngine("careloop-deterministic-risk-v2");

  const lowRiskBase: RiskScoringInput = {
    referralId: "REF-LOW-1",
    referralDate: new Date("2026-11-10T12:00:00Z"),
    urgency: "ROUTINE",
    specialty: "Outpatient Behavioral Health",
    geography: "Central Metro",
    networkRequired: "Horizon Medicaid",
    preferredLanguage: "English",
    eligibilityVerified: "VERIFIED",
    referringProviderName: "Dr. Smith",
    operationalNotes: "",
    member: {
      urbanicity: "URBAN",
      eligibilityStatus: "ACTIVE",
      digitalAccessLevel: "HIGH",
      transportationAccess: "RELIABLE",
      priorNoShowCount: 0,
      priorFailedReferralsCount: 0,
      historicalEngagementRate: 0.9,
    },
    matchingProvidersCount: 3,
    inNetworkProvidersCount: 3,
    languageConcordantProvidersCount: 3,
    verifiedAvailableSlotsCount: 4,
    minDirectoryWaitDays: 4,
    now: fixedNow,
  };

  it("scores clean referrals with verified slots as LOW risk with high confidence and clear explanation", async () => {
    const out = await engine.scoreReferral(lowRiskBase);
    expect(out.riskLevel).toBe(RiskLevel.LOW);
    expect(out.riskScore).toBe(15);
    expect(out.confidence).toBeGreaterThanOrEqual(0.85);
    expect(out.modelVersion).toBe("careloop-deterministic-risk-v2");
    expect(out.calculatedAt).toBe(fixedNow.toISOString());
    expect(out.explanation).toContain("LOW");
    expect(out.supportingSignals).toHaveLength(0);
  });

  it("accumulates multi-factor operational signals, caps score at 98, and explains every point", async () => {
    const highRiskInput: RiskScoringInput = {
      ...lowRiskBase,
      referralId: "REF-HIGH-1",
      referralDate: new Date("2026-10-15T12:00:00Z"), // 27 days old (+20)
      urgency: "EXPEDITED", // +12
      networkRequired: "Horizon Medicaid",
      preferredLanguage: "Vietnamese",
      eligibilityVerified: "UNVERIFIED", // +12
      referringProviderName: null, // incomplete referral (+8)
      member: {
        urbanicity: "RURAL",
        eligibilityStatus: "PENDING",
        digitalAccessLevel: "NONE", // +6
        transportationAccess: "NONE", // +12
        priorNoShowCount: 3, // +20
        priorFailedReferralsCount: 2, // +18
        historicalEngagementRate: 0.2,
      },
      matchingProvidersCount: 0, // +18
      inNetworkProvidersCount: 0, // +15
      languageConcordantProvidersCount: 0, // +15
      verifiedAvailableSlotsCount: 0,
      minDirectoryWaitDays: 35, // +10
      now: fixedNow,
    };

    const out = await engine.scoreReferral(highRiskInput);
    expect(out.riskLevel).toBe(RiskLevel.HIGH);
    expect(out.riskScore).toBe(98);
    expect(out.humanEscalationRecommended).toBe(true);
    expect(out.supportingSignals.length).toBeGreaterThanOrEqual(8);

    const factors = out.supportingSignals.map((s) => s.factor);
    expect(factors).toContain("REFERRAL_AGE");
    expect(factors).toContain("PROVIDER_AVAILABILITY");
    expect(factors).toContain("SCHEDULING_DELAY");
    expect(factors).toContain("NETWORK_MISMATCH");
    expect(factors).toContain("LANGUAGE_MISMATCH");
    expect(factors).toContain("GEOGRAPHIC_ACCESS");
    expect(factors).toContain("PRIOR_MISSED_APPOINTMENTS");
    expect(factors).toContain("PRIOR_FAILED_REFERRALS");
    expect(factors).toContain("INCOMPLETE_REFERRAL");
    expect(factors).toContain("UNRESOLVED_ADMIN");
    expect(out.explanation).toContain("REFERRAL_AGE".replace("REFERRAL_AGE", "Referral aging"));
  });

  it("handles edge cases: invalid referralDate returns UNKNOWN and sparse UNKNOWN inputs lower confidence", async () => {
    const invalidDateOut = await engine.scoreReferral({
      ...lowRiskBase,
      referralDate: new Date("invalid-date"),
    });
    expect(invalidDateOut.riskLevel).toBe(RiskLevel.UNKNOWN);
    expect(invalidDateOut.humanEscalationRecommended).toBe(true);
    expect(invalidDateOut.confidence).toBeLessThan(0.3);

    const sparseOut = await engine.scoreReferral({
      ...lowRiskBase,
      networkRequired: "UNKNOWN",
      eligibilityVerified: "UNKNOWN",
      member: {
        ...lowRiskBase.member,
        transportationAccess: "UNKNOWN",
        digitalAccessLevel: "UNKNOWN",
        historicalEngagementRate: null,
      },
    });
    expect(sparseOut.confidence).toBe(0.45);
    expect(sparseOut.uncertainty).toContain("UNKNOWN");
  });

  it("supports swapping DeterministicRiskEngine with an ML implementation via RiskScoringEngine", async () => {
    const mockMlEngine: RiskScoringEngine = {
      modelVersion: "careloop-ml-gradient-boost-v1",
      modelType: "ML",
      async scoreReferral(input) {
        return {
          riskLevel: input.member.priorNoShowCount > 0 ? RiskLevel.MEDIUM : RiskLevel.LOW,
          riskScore: 55,
          supportingSignals: [
            { factor: "PRIOR_MISSED_APPOINTMENTS", points: 20, signal: "ML feature importance 0.41" },
          ],
          explanation: "Calibrated ML propensity estimate",
          confidence: 0.89,
          uncertainty: "Out-of-sample AUC 0.81",
          calculatedAt: fixedNow.toISOString(),
          modelVersion: "careloop-ml-gradient-boost-v1",
          modelType: "ML",
          humanEscalationRecommended: false,
        };
      },
    };

    const res = await mockMlEngine.scoreReferral({
      ...lowRiskBase,
      member: { ...lowRiskBase.member, priorNoShowCount: 1 },
    });
    expect(res.modelType).toBe("ML");
    expect(res.riskScore).toBe(55);
  });
});
