import { describe, expect, it } from "vitest";
import {
  computePayerValueRealization,
  DEFAULT_ACTUARIAL_ASSUMPTIONS,
} from "@/domain/analytics/payer-roi-engine";
import { DashboardCaseRecord } from "@/domain/analytics/executive-metrics";
import { AppointmentStatus } from "@prisma/client";

describe("Payer Actuarial ROI & Quality Value Realization Engine (Unit Tests)", () => {
  const baseDate = new Date("2026-10-01T10:00:00Z");
  const dayMs = 24 * 60 * 60 * 1000;

  const createMockCase = (id: string, completedDaysAfterReferral: number | null, isSvi: boolean = false): DashboardCaseRecord => ({
    caseId: `case-${id}`,
    externalReferralId: `REF-${id}`,
    referralDate: baseDate,
    specialty: "Outpatient Behavioral Health",
    behavioralHealthNeed: "Depression and Anxiety",
    eligibilityVerified: "VERIFIED",
    memberEligibilityStatus: "ACTIVE",
    memberId: `mem-${id}`,
    memberName: `Member ${id}`,
    geography: "Metro East",
    urbanicity: isSvi ? "RURAL" : "URBAN",
    preferredLanguage: isSvi ? "Spanish" : "English",
    coverageType: isSvi ? "MEDICAID" : "COMMERCIAL",
    raceEthnicityCohort: isSvi ? "HISPANIC_LATINO" : "WHITE_NON_HISPANIC",
    ageGroupCohort: "25_44",
    status: completedDaysAfterReferral !== null ? "VERIFIED" : "IN_PROGRESS",
    riskLevel: "MEDIUM",
    priorityScore: 75,
    humanReviewRequired: false,
    hasRiskAssessment: true,
    primaryBarrierCategory: isSvi ? "SOCIAL_LOGISTICAL" : "ACCESS",
    primaryBarrierCode: isSvi ? "TRANSPORTATION" : "PROVIDER_SHORTAGE",
    matchedProviderId: "prov-1",
    matchedProviderName: "Dr. Therapist",
    matchedProviderAvailabilitySource: "VERIFIED_AVAILABILITY",
    firstCompletedVisitAt:
      completedDaysAfterReferral !== null
        ? new Date(baseDate.getTime() + completedDaysAfterReferral * dayMs)
        : null,
    interventions: [
      {
        id: `inv-${id}`,
        type: isSvi ? "TRANSPORTATION_SUPPORT" : "ASSISTED_SCHEDULING",
        status: completedDaysAfterReferral !== null ? "COMPLETED" : "IN_PROGRESS",
        epistemicOrigin: "AI_RECOMMENDATION",
        autoExecuted: true,
        outcomes: [{ barriersResolved: completedDaysAfterReferral !== null, outcomeStatus: "SUCCESS" }],
      },
    ],
    appointments: [
      {
        id: `appt-${id}`,
        providerId: "prov-1",
        scheduledStartAt: new Date(baseDate.getTime() + 5 * dayMs),
        status: completedDaysAfterReferral !== null ? AppointmentStatus.COMPLETED : AppointmentStatus.REQUESTED,
        createdAt: baseDate,
      },
    ],
    verifications: [],
    communicationsCount: 2,
    caseNotesCount: 1,
  });

  it("calculates positive ROI, medical spend avoidance, and staff capacity savings on completed cohort", () => {
    // Cohort of 100 referrals: 65 completed (65%), 35 in-progress
    const cases: DashboardCaseRecord[] = [
      // 30 completed within 5 days (HEDIS FUH-7 compliant)
      ...Array.from({ length: 30 }, (_, i) => createMockCase(`fuh7-${i}`, 4, i % 2 === 0)),
      // 25 completed within 18 days (HEDIS FUH-30 compliant)
      ...Array.from({ length: 25 }, (_, i) => createMockCase(`fuh30-${i}`, 15, i % 2 === 0)),
      // 10 completed within 35 days
      ...Array.from({ length: 10 }, (_, i) => createMockCase(`late-${i}`, 35, i % 2 === 0)),
      // 35 uncompleted
      ...Array.from({ length: 35 }, (_, i) => createMockCase(`uncomp-${i}`, null, i % 2 === 0)),
    ];

    const report = computePayerValueRealization(cases);

    expect(report.totalReferralsEvaluated).toBe(100);
    expect(report.verifiedCompletedVisits).toBe(65);
    expect(report.overallCompletionRatePct).toBe(65.0);
    expect(report.completionRateLiftPercentagePoints).toBeGreaterThan(30.0);

    // Medical spend avoidance
    expect(report.avoidedPsychiatricEdEncountersCount).toBeGreaterThan(0);
    expect(report.avoidedPsychiatricEdSpendUSD).toBeGreaterThan(0);
    expect(report.avoidedInpatientAdmissionsCount).toBeGreaterThan(0);
    expect(report.avoidedInpatientSpendUSD).toBeGreaterThan(0);
    expect(report.totalMedicalSpendAvoidedUSD).toBeGreaterThan(25000);

    // Operational staff capacity
    expect(report.staffHoursSaved).toBeGreaterThan(40);
    expect(report.staffLaborCostSavingsUSD).toBeGreaterThan(1500);
    expect(report.careManagerCapacityMultiplier).toBe(4.4); // 42 min vs 9.5 min

    // Financial ROI
    expect(report.grossEconomicValueUSD).toBeGreaterThan(report.estimatedPlatformInvestmentUSD);
    expect(report.netPayerSavingsUSD).toBeGreaterThan(0);
    expect(report.returnOnInvestmentRatio).toBeGreaterThan(4.0); // > 4x ROI

    // Cost per completed visit
    expect(report.costPerCompletedVisitComparison.careLoopCostPerCompletedVisitUSD).toBeLessThan(150);
    expect(report.costPerCompletedVisitComparison.usualCareCostPerCompletedVisitUSD).toBe(465);
    expect(report.costPerCompletedVisitComparison.savingsPerCompletedVisitUSD).toBeGreaterThan(300);

    // HEDIS Scorecard
    expect(report.hedisScorecard.fuh7DayComplianceRatePct).toBe(30.0); // 30/100
    expect(report.hedisScorecard.fuh30DayComplianceRatePct).toBe(55.0); // (30+25)/100
    expect(report.hedisScorecard.fum30DayFollowUpEdVisitPct).toBeGreaterThan(50);
    expect(report.hedisScorecard.ietInitiationRatePct).toBeGreaterThan(50);

    // CMS Health Equity Index
    expect(report.cmsHealthEquityIndex.disparityImpactRatio).toBeGreaterThan(0.70);
    expect(report.cmsHealthEquityIndex.projectedAnnualDisparityDividendUSD).toBeGreaterThan(10000);
  });

  it("handles empty cohort safely without division by zero", () => {
    const report = computePayerValueRealization([]);

    expect(report.totalReferralsEvaluated).toBe(0);
    expect(report.verifiedCompletedVisits).toBe(0);
    expect(report.overallCompletionRatePct).toBe(0);
    expect(report.netPayerSavingsUSD).toBe(0);
    expect(report.returnOnInvestmentRatio).toBe(1.0);
    expect(report.hedisScorecard.qualityRatingTier).toBe("NEEDS_IMPROVEMENT");
  });

  it("supports custom payer actuarial assumptions overrides", () => {
    const cases = [createMockCase("1", 5), createMockCase("2", 10)];
    const report = computePayerValueRealization(cases, {
      costPerPsychiatricEdVisit: 2400,
      costPerInpatientPsychiatricStay: 19500,
      careManagerHourlyRate: 55.0,
    });

    expect(report.actuarialAssumptionsUsed.costPerPsychiatricEdVisit).toBe(2400);
    expect(report.actuarialAssumptionsUsed.costPerInpatientPsychiatricStay).toBe(19500);
    expect(report.actuarialAssumptionsUsed.careManagerHourlyRate).toBe(55.0);
  });
});
