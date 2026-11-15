import { BarrierCategory } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { BarrierInferenceRecordSchema, BarrierIntelligenceAgent } from "@/agent";
import { BarrierDetectionInput } from "@/domain/barriers/barrier-engine";
import { BARRIER_TAXONOMY } from "@/domain/barriers/taxonomy";

describe("BarrierIntelligenceAgent", () => {
  const agent = new BarrierIntelligenceAgent();

  const cleanDetection: BarrierDetectionInput = {
    referralId: "REF-BA-1",
    specialty: "Outpatient Behavioral Health",
    geography: "Central Metro",
    networkRequired: "HorizonCare",
    preferredLanguage: "English",
    eligibilityVerified: "VERIFIED",
    referringProviderName: "Dr. Morgan",
    operationalNotes: "",
    member: {
      urbanicity: "URBAN",
      eligibilityStatus: "ACTIVE",
      digitalAccessLevel: "HIGH",
      transportationAccess: "RELIABLE",
      priorNoShowCount: 0,
      historicalEngagementRate: 0.9,
    },
    matchingProvidersCount: 3,
    inNetworkProvidersCount: 3,
    languageConcordantProvidersCount: 3,
    verifiedAvailableSlotsCount: 4,
    minDirectoryWaitDays: 5,
  };

  it("supports all 7 canonical barrier categories and returns UNKNOWN when evidence is insufficient", async () => {
    expect(Object.keys(BARRIER_TAXONOMY)).toEqual([
      "ACCESS",
      "ADMINISTRATIVE",
      "FINANCIAL",
      "COMMUNICATION",
      "BEHAVIORAL",
      "SOCIAL_LOGISTICAL",
      "UNKNOWN",
    ]);

    const result = await agent.decide({
      caseId: "case-clean-1",
      riskTier: "LOW",
      consentSms: true,
      detection: cleanDetection,
    });

    expect(result.primary.barrier).toBe(BarrierCategory.UNKNOWN);
    expect(result.primary.epistemicStatus).toBe("UNKNOWN");
    expect(result.primary.evidence).toEqual([]);
    expect(result.primary.source).toBe("DETERMINISTIC_RULES");
    expect(result.primary.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof result.primary.confidence).toBe("number");
  });

  it("infers ACCESS with evidence, confidence, source, timestamp, and recommended intervention without inventing facts", async () => {
    const result = await agent.decide({
      caseId: "case-access-1",
      riskTier: "MEDIUM",
      consentSms: true,
      detection: {
        ...cleanDetection,
        matchingProvidersCount: 0,
        inNetworkProvidersCount: 0,
        verifiedAvailableSlotsCount: 0,
      },
    });

    expect(result.primary.barrier).toBe(BarrierCategory.ACCESS);
    expect(result.primary.epistemicStatus).toBe("INFERENCE");
    expect(result.primary.confidence).toBeGreaterThan(0.5);
    expect(result.primary.evidence.length).toBeGreaterThan(0);
    expect(result.primary.source).toBe("DETERMINISTIC_RULES");
    expect(result.primary.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.primary.recommendedAction.length).toBeGreaterThan(0);
    expect(result.recommendedInterventions.length).toBeGreaterThan(0);
  });

  it("rejects fabricated non-UNKNOWN inferences that lack supporting evidence", () => {
    expect(() =>
      BarrierInferenceRecordSchema.parse({
        barrier: "FINANCIAL",
        subBarrier: "copay concern",
        epistemicStatus: "INFERENCE",
        confidence: 0.8,
        evidence: [],
        source: "DETERMINISTIC_RULES",
        timestamp: new Date().toISOString(),
        recommendedAction: "Clarify copay",
      })
    ).toThrow();
  });
});
