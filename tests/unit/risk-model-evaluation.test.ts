import { describe, expect, it } from "vitest";
import { evaluateRiskPrioritizationModel, RiskEvaluationSample } from "@/domain/risk/model-evaluation";
import {
  assertNoClinicalTreatmentDirective,
  rankCasesByAttentionPriority,
  stripSensitiveAttributesForRiskScoring,
  toRiskPrioritizationRecord,
} from "@/domain/risk/prioritization";
import { DeterministicRiskEngine, RiskScoringInput } from "@/domain/risk/risk-engine";
import { ValidationError } from "@/lib/errors";

describe("Risk Prioritization Governance & Model Evaluation", () => {
  const fixedNow = new Date("2026-11-12T12:00:00Z");
  const engine = new DeterministicRiskEngine("careloop-deterministic-risk-v2");

  const baseInput: RiskScoringInput = {
    referralId: "REF-EVAL-BASE",
    referralDate: new Date("2026-11-11T12:00:00Z"),
    urgency: "ROUTINE",
    specialty: "Outpatient Therapy",
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

  it("stores canonical risk_score, risk_band, factors, model_version, created_at and ranks highest-risk cases first", async () => {
    const lowOut = await engine.scoreReferral(baseInput);
    const highOut = await engine.scoreReferral({
      ...baseInput,
      referralId: "REF-EVAL-HIGH",
      referralDate: new Date("2026-10-15T12:00:00Z"),
      urgency: "EXPEDITED",
      eligibilityVerified: "UNVERIFIED",
      member: {
        ...baseInput.member,
        transportationAccess: "NONE",
        priorNoShowCount: 3,
      },
      matchingProvidersCount: 0,
      inNetworkProvidersCount: 0,
      verifiedAvailableSlotsCount: 0,
    });

    const lowRec = toRiskPrioritizationRecord({
      caseId: "case-low",
      referralId: "REF-EVAL-BASE",
      output: lowOut,
    });
    const highRec = toRiskPrioritizationRecord({
      caseId: "case-high",
      referralId: "REF-EVAL-HIGH",
      output: highOut,
    });

    expect(highRec.risk_band).toBe("HIGH");
    expect(highRec.risk_score).toBeGreaterThan(lowRec.risk_score);
    expect(highRec.factors.length).toBeGreaterThan(0);
    expect(highRec.model_version).toBe("careloop-deterministic-risk-v2");
    expect(highRec.created_at).toBe(fixedNow.toISOString());
    expect(highRec.determinesClinicalTreatment).toBe(false);

    const ranked = rankCasesByAttentionPriority([lowRec, highRec]);
    expect(ranked[0].caseId).toBe("case-high");
    expect(ranked[0].priorityRank).toBe(1);
    expect(ranked[1].caseId).toBe("case-low");
    expect(ranked[1].priorityRank).toBe(2);
  });

  it("blocks clinical treatment directives and strips sensitive demographic attributes from risk scoring", () => {
    expect(() =>
      assertNoClinicalTreatmentDirective({
        explanation: "Recommend antidepressant medication dosage adjustment.",
        supportingSignals: [],
      })
    ).toThrow(ValidationError);

    const stripped = stripSensitiveAttributesForRiskScoring({
      ...baseInput,
      raceEthnicity: "HISPANIC_OR_LATINO",
      gender: "FEMALE",
      member: {
        ...baseInput.member,
        race: "OTHER",
      },
    } as unknown as Record<string, unknown>);

    expect("raceEthnicity" in stripped).toBe(false);
    expect("gender" in stripped).toBe(false);
    expect("race" in (stripped.member as Record<string, unknown>)).toBe(false);
  });

  it("passes model evaluation metrics (AUC-ROC, Top-K precision, calibration, and zero counterfactual demographic delta)", async () => {
    const evaluationCohort: RiskEvaluationSample[] = [
      // 3 High-risk dropped off
      {
        id: "eval-1",
        actualDroppedOff: true,
        input: {
          ...baseInput,
          referralId: "REF-1",
          referralDate: new Date("2026-10-10T12:00:00Z"),
          urgency: "EXPEDITED",
          eligibilityVerified: "UNVERIFIED",
          raceEthnicity: "BLACK",
          gender: "FEMALE",
          member: { ...baseInput.member, priorNoShowCount: 3, transportationAccess: "NONE" },
          matchingProvidersCount: 0,
          inNetworkProvidersCount: 0,
          verifiedAvailableSlotsCount: 0,
        },
      },
      {
        id: "eval-2",
        actualDroppedOff: true,
        input: {
          ...baseInput,
          referralId: "REF-2",
          referralDate: new Date("2026-10-18T12:00:00Z"),
          preferredLanguage: "Spanish",
          languageConcordantProvidersCount: 0,
          raceEthnicity: "HISPANIC",
          gender: "MALE",
          member: { ...baseInput.member, priorNoShowCount: 2, digitalAccessLevel: "NONE" },
          verifiedAvailableSlotsCount: 0,
        },
      },
      {
        id: "eval-3",
        actualDroppedOff: true,
        input: {
          ...baseInput,
          referralId: "REF-3",
          referralDate: new Date("2026-10-20T12:00:00Z"),
          eligibilityVerified: "UNVERIFIED",
          raceEthnicity: "WHITE",
          member: { ...baseInput.member, priorFailedReferralsCount: 2, urbanicity: "RURAL" },
          matchingProvidersCount: 0,
          inNetworkProvidersCount: 0,
        },
      },
      // 1 Medium-risk completed
      {
        id: "eval-4",
        actualDroppedOff: false,
        input: {
          ...baseInput,
          referralId: "REF-4",
          referralDate: new Date("2026-11-01T12:00:00Z"),
          raceEthnicity: "ASIAN",
          member: { ...baseInput.member, priorNoShowCount: 1 },
        },
      },
      // 2 Low-risk completed
      {
        id: "eval-5",
        actualDroppedOff: false,
        input: {
          ...baseInput,
          referralId: "REF-5",
          raceEthnicity: "BLACK",
        },
      },
      {
        id: "eval-6",
        actualDroppedOff: false,
        input: {
          ...baseInput,
          referralId: "REF-6",
          raceEthnicity: "WHITE",
        },
      },
    ];

    const report = await evaluateRiskPrioritizationModel(engine, evaluationCohort, 3);

    expect(report.sampleCount).toBe(6);
    expect(report.aucRoc).toBeGreaterThanOrEqual(0.9);
    expect(report.precisionAtTopK).toBe(1);
    expect(report.recallAtTopK).toBe(1);
    expect(report.brierScore).toBeLessThan(0.2);
    expect(report.counterfactualFairnessMaxDelta).toBe(0);

    const highBand = report.calibrationByBand.find((b) => b.band === "HIGH");
    const lowBand = report.calibrationByBand.find((b) => b.band === "LOW");
    expect(highBand?.observedDropOffRate).toBe(1);
    expect(lowBand?.observedDropOffRate).toBe(0);
  });
});
