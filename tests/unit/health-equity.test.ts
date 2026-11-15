import { describe, expect, it } from "vitest";
import {
  compareCohorts,
  computeBarrierPrevalence,
  computeCohortMetrics,
  computeDisparityReducingInterventions,
  computeInterventionEffectiveness,
  EquityCaseRecord,
} from "@/domain/equity/analytics";

describe("Health Equity Cohort Analytics", () => {
  const baseDate = new Date("2026-10-01T10:00:00.000Z");
  const dayMs = 24 * 60 * 60 * 1000;

  const sampleRecords: EquityCaseRecord[] = [
    {
      caseId: "c1",
      referralDate: baseDate,
      firstCompletedVisitAt: new Date(baseDate.getTime() + 4 * dayMs),
      status: "VERIFIED",
      primaryBarrierCategory: "COMMUNICATION",
      preferredLanguage: "Spanish",
      urbanicity: "RURAL",
      coverageType: "MEDICAID",
      raceEthnicityCohort: "HISPANIC_LATINO",
      ageGroupCohort: "25_44",
      interventions: [{ type: "LANGUAGE_COMPATIBLE_PROVIDER_SEARCH", status: "COMPLETED" }],
      appointments: [{ status: "COMPLETED" }],
      hasMatchedProvider: true,
      matchedProviderVerifiedAvailability: true,
      matchedProviderLanguageConcordant: true,
    },
    {
      caseId: "c2",
      referralDate: new Date(baseDate.getTime() + 2 * dayMs),
      firstCompletedVisitAt: null,
      status: "BLOCKED",
      primaryBarrierCategory: "ACCESS",
      preferredLanguage: "Spanish",
      urbanicity: "RURAL",
      coverageType: "MEDICAID",
      raceEthnicityCohort: "HISPANIC_LATINO",
      ageGroupCohort: "25_44",
      interventions: [{ type: "HUMAN_OUTREACH", status: "RECOMMENDED" }],
      appointments: [{ status: "NO_SHOW" }],
      hasMatchedProvider: false,
      matchedProviderVerifiedAvailability: false,
      matchedProviderLanguageConcordant: false,
    },
    {
      caseId: "c3",
      referralDate: new Date(baseDate.getTime() + 3 * dayMs),
      firstCompletedVisitAt: new Date(baseDate.getTime() + 5 * dayMs),
      status: "VERIFIED",
      primaryBarrierCategory: "ADMINISTRATIVE",
      preferredLanguage: "English",
      urbanicity: "URBAN",
      coverageType: "COMMERCIAL",
      raceEthnicityCohort: "WHITE",
      ageGroupCohort: "25_44",
      interventions: [{ type: "ASSISTED_SCHEDULING", status: "COMPLETED" }],
      appointments: [{ status: "COMPLETED" }],
      hasMatchedProvider: true,
      matchedProviderVerifiedAvailability: true,
      matchedProviderLanguageConcordant: true,
    },
    {
      caseId: "c4",
      referralDate: new Date(baseDate.getTime() + 5 * dayMs),
      firstCompletedVisitAt: new Date(baseDate.getTime() + 7 * dayMs),
      status: "VERIFIED",
      primaryBarrierCategory: "ADMINISTRATIVE",
      preferredLanguage: "English",
      urbanicity: "URBAN",
      coverageType: "COMMERCIAL",
      raceEthnicityCohort: "WHITE",
      ageGroupCohort: "45_64",
      interventions: [{ type: "ASSISTED_SCHEDULING", status: "COMPLETED" }],
      appointments: [{ status: "COMPLETED" }],
      hasMatchedProvider: true,
      matchedProviderVerifiedAvailability: true,
      matchedProviderLanguageConcordant: true,
    },
  ];

  it("computes completion rates, time-to-care, barrier distribution, no-show rates, provider access, and cohort disparities", () => {
    const byLang = computeCohortMetrics(sampleRecords, "preferredLanguage");
    const spanish = byLang.find((c) => c.cohort === "Spanish");
    const english = byLang.find((c) => c.cohort === "English");

    expect(spanish).toBeDefined();
    expect(english).toBeDefined();
    expect(spanish?.completionRatePct).toBe(50);
    expect(english?.completionRatePct).toBe(100);
    expect(spanish?.avgTimeToCareDays).toBe(4);
    expect(english?.avgTimeToCareDays).toBe(2);
    expect(spanish?.noShowRatePct).toBe(50);
    expect(english?.noShowRatePct).toBe(0);
    expect(spanish?.providerMatchedRatePct).toBe(50);
    expect(spanish?.verifiedProviderAccessRatePct).toBe(50);
    expect(spanish?.languageConcordantAccessRatePct).toBe(50);
    expect(english?.providerMatchedRatePct).toBe(100);
    expect(spanish?.disparityGapPctPoints).toBeLessThan(0);

    const barriers = computeBarrierPrevalence(sampleRecords);
    expect(barriers.some((b) => b.category === "ADMINISTRATIVE")).toBe(true);
    expect(barriers.some((b) => b.category === "ACCESS")).toBe(true);

    const effectiveness = computeInterventionEffectiveness(sampleRecords);
    expect(effectiveness.length).toBeGreaterThanOrEqual(2);

    const disparityReducing = computeDisparityReducingInterventions(sampleRecords);
    expect(Array.isArray(disparityReducing)).toBe(true);

    const comparison = compareCohorts(
      sampleRecords,
      { dimension: "preferredLanguage", value: "Spanish" },
      { dimension: "preferredLanguage", value: "English" }
    );
    expect(comparison.deltas.completionRateDiffPctPts).toBe(-50);
    expect(comparison.deltas.noShowRateDiffPctPts).toBe(50);
  });
});
