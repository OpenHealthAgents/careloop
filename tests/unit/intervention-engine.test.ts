import { describe, expect, it } from "vitest";
import {
  BarrierCategory,
  InterventionExecutionMode,
  InterventionStatus,
  InterventionType,
  RiskLevel,
} from "@prisma/client";
import { AIPolicyViolationError, DeterministicAIProvider, enforceInterventionPolicy } from "@/ai";
import {
  canAutomaticallyExecuteIntervention,
  generateInterventionRecommendations,
} from "@/domain/interventions/intervention-engine";
import { assertAutomatedExecutionAllowed } from "@/domain/interventions/state-machine";
import { ValidationError } from "@/lib/errors";

describe("CareLoop Intervention Engine & Safety Safeguards", () => {
  it("maps every canonical barrier scenario to expected interventions with all 8 required fields", () => {
    const scenarios: Array<{
      category: BarrierCategory;
      code: string;
      expectedType: InterventionType;
      expectedModeOnLowRisk: InterventionExecutionMode;
    }> = [
      {
        category: "ACCESS",
        code: "unavailable appointments",
        expectedType: "ALTERNATIVE_PROVIDER_SEARCH",
        expectedModeOnLowRisk: "AUTOMATED",
      },
      {
        category: "COMMUNICATION",
        code: "language",
        expectedType: "LANGUAGE_COMPATIBLE_PROVIDER_SEARCH",
        expectedModeOnLowRisk: "AUTOMATED",
      },
      {
        category: "SOCIAL_LOGISTICAL",
        code: "work schedule",
        expectedType: "ASSISTED_SCHEDULING",
        expectedModeOnLowRisk: "HUMAN_ASSISTED",
      },
      {
        category: "SOCIAL_LOGISTICAL",
        code: "transportation",
        expectedType: "TRANSPORTATION_SUPPORT",
        expectedModeOnLowRisk: "HUMAN_ASSISTED",
      },
      {
        category: "ADMINISTRATIVE",
        code: "network confusion",
        expectedType: "BENEFIT_NETWORK_EXPLANATION",
        expectedModeOnLowRisk: "AUTOMATED",
      },
      {
        category: "BEHAVIORAL",
        code: "prior missed appointments",
        expectedType: "MISSED_APPOINTMENT_REENGAGEMENT",
        expectedModeOnLowRisk: "HUMAN_ASSISTED",
      },
      {
        category: "ADMINISTRATIVE",
        code: "incomplete referral",
        expectedType: "REFERRAL_COMPLETION_ASSISTANCE",
        expectedModeOnLowRisk: "HUMAN_ASSISTED",
      },
      {
        category: "UNKNOWN",
        code: "Barrier unknown",
        expectedType: "HUMAN_OUTREACH",
        expectedModeOnLowRisk: "HUMAN_ONLY",
      },
    ];

    for (const s of scenarios) {
      const recs = generateInterventionRecommendations({
        caseId: `case-${s.code}`,
        primaryBarrierCategory: s.category,
        primaryBarrierCode: s.code,
        riskTier: RiskLevel.LOW,
        preferredLanguage: "Spanish",
        digitalAccessLevel: "MEDIUM",
        transportationAccess: s.code === "transportation" ? "NONE" : "RELIABLE",
        consentSms: true,
        verifiedAvailableSlotsCount: 1,
        languageConcordantProvidersCount: 1,
      });

      expect(recs.length).toBeGreaterThanOrEqual(1);
      const top = recs[0];
      expect(top.intervention.type).toBe(s.expectedType);
      expect(top.automationEligibility.executionMode).toBe(s.expectedModeOnLowRisk);

      // All 8 mandatory fields must be populated
      expect(top.barrier.category).toBe(s.category);
      expect(top.barrier.code).toBe(s.code);
      expect(top.intervention.recommendedAction.length).toBeGreaterThan(5);
      expect(top.rationale.length).toBeGreaterThan(5);
      expect(top.confidence).toBeGreaterThan(0);
      expect(top.confidence).toBeLessThanOrEqual(1);
      expect(top.evidence.length).toBeGreaterThanOrEqual(1);
      expect(typeof top.automationEligibility.eligible).toBe("boolean");
      expect(top.requiredHumanInvolvement.length).toBeGreaterThan(5);
      expect(top.expectedOutcome.length).toBeGreaterThan(5);
    }
  });

  it("never classifies high-risk interventions or HIGH-risk cases as AUTOMATED or auto-eligible", () => {
    const highRiskRecs = generateInterventionRecommendations({
      caseId: "case-high",
      primaryBarrierCategory: "ACCESS",
      primaryBarrierCode: "unavailable appointments",
      riskTier: RiskLevel.HIGH,
      preferredLanguage: "English",
      digitalAccessLevel: "HIGH",
      transportationAccess: "RELIABLE",
      consentSms: true,
      verifiedAvailableSlotsCount: 0,
      languageConcordantProvidersCount: 1,
    });

    for (const rec of highRiskRecs) {
      expect(rec.isHighRisk).toBe(true);
      expect(rec.automationEligibility.eligible).toBe(false);
      expect(rec.automationEligibility.executionMode).not.toBe("AUTOMATED");
    }

    expect(
      canAutomaticallyExecuteIntervention({
        executionMode: InterventionExecutionMode.AUTOMATED,
        automationEligible: true,
        isHighRisk: true,
        caseRiskLevel: RiskLevel.LOW,
      }).allowed
    ).toBe(false);

    expect(
      canAutomaticallyExecuteIntervention({
        executionMode: InterventionExecutionMode.HUMAN_ONLY,
        automationEligible: false,
        isHighRisk: false,
        caseRiskLevel: RiskLevel.LOW,
      }).allowed
    ).toBe(false);

    expect(() =>
      assertAutomatedExecutionAllowed({
        status: InterventionStatus.RECOMMENDED,
        executionMode: InterventionExecutionMode.HUMAN_ASSISTED,
        automationEligible: false,
        isHighRisk: true,
        caseRiskLevel: RiskLevel.HIGH,
      })
    ).toThrow(ValidationError);
  });

  it("rejects AI policy violations attempting automated execution on HIGH risk or HUMAN_ONLY types", async () => {
    const ai = new DeterministicAIProvider("test-v1");
    const rec = await ai.recommendIntervention({
      caseId: "case-policy",
      primaryBarrierCategory: "ADMINISTRATIVE",
      primaryBarrierCode: "network confusion",
      riskTier: "HIGH",
      preferredLanguage: "English",
      digitalAccessLevel: "HIGH",
      transportationAccess: "RELIABLE",
      consentSms: false,
      verifiedAvailableSlotsCount: 2,
      languageConcordantProvidersCount: 2,
    });

    // Mutate to illegally request AUTOMATED on a HIGH risk case
    rec.proposedInterventions[0].executionMode = "AUTOMATED";
    rec.proposedInterventions[0].automationEligible = true;
    expect(() => enforceInterventionPolicy(rec, { riskTier: "HIGH" })).toThrow(
      AIPolicyViolationError
    );
  });
});
