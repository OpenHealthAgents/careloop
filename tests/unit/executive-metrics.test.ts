import { describe, expect, it } from "vitest";
import { AppointmentStatus, VerificationSignalType, VerificationStatus } from "@prisma/client";
import {
  computeExecutiveMetrics,
  DashboardCaseRecord,
  filterDashboardCases,
} from "@/domain/analytics/executive-metrics";

describe("Executive Dashboard Metrics & Filter Reconciliation", () => {
  const sampleRecords: DashboardCaseRecord[] = [
    {
      caseId: "c1",
      externalReferralId: "REF-1",
      referralDate: new Date("2026-10-01T10:00:00Z"),
      specialty: "Outpatient Behavioral Health",
      behavioralHealthNeed: "Therapy",
      eligibilityVerified: "VERIFIED",
      memberEligibilityStatus: "ACTIVE",
      memberId: "m1",
      memberName: "Elena Navarro",
      geography: "Central Metro",
      urbanicity: "URBAN",
      preferredLanguage: "Spanish",
      coverageType: "MEDICAID",
      raceEthnicityCohort: "Hispanic / Latino",
      ageGroupCohort: "25-34",
      status: "CLOSED",
      riskLevel: "HIGH",
      priorityScore: 86,
      humanReviewRequired: false,
      hasRiskAssessment: true,
      primaryBarrierCategory: "COMMUNICATION",
      primaryBarrierCode: "language",
      matchedProviderId: "p1",
      matchedProviderName: "Dr. Rivera",
      matchedProviderAvailabilitySource: "VERIFIED_AVAILABILITY",
      firstCompletedVisitAt: new Date("2026-10-06T10:00:00Z"),
      interventions: [
        {
          id: "i1",
          type: "LANGUAGE_COMPATIBLE_PROVIDER_SEARCH",
          status: "COMPLETED",
          epistemicOrigin: "AI_RECOMMENDATION",
          autoExecuted: false,
          outcomes: [{ barriersResolved: true, outcomeStatus: "COMPLETED" }],
        },
      ],
      appointments: [
        {
          id: "a1",
          providerId: "p1",
          scheduledStartAt: new Date("2026-10-04T10:00:00Z"),
          status: AppointmentStatus.COMPLETED,
          createdAt: new Date("2026-10-02T10:00:00Z"),
        },
      ],
      verifications: [
        {
          id: "v1",
          signalType: VerificationSignalType.CLAIM_RECEIVED,
          verified: true,
          verificationStatus: VerificationStatus.VERIFIED,
        },
        {
          id: "v2",
          signalType: VerificationSignalType.SUBSEQUENT_TREATMENT_ENGAGEMENT,
          verified: true,
          verificationStatus: VerificationStatus.VERIFIED,
        },
      ],
      communicationsCount: 2,
      caseNotesCount: 1,
    },
    {
      caseId: "c2",
      externalReferralId: "REF-2",
      referralDate: new Date("2026-10-10T10:00:00Z"),
      specialty: "Psychiatry",
      behavioralHealthNeed: "Evaluation",
      eligibilityVerified: "VERIFIED",
      memberEligibilityStatus: "ACTIVE",
      memberId: "m2",
      memberName: "Marcus Vance",
      geography: "Rural East",
      urbanicity: "RURAL",
      preferredLanguage: "English",
      coverageType: "MEDICARE",
      raceEthnicityCohort: "Black",
      ageGroupCohort: "50-64",
      status: "REQUIRES_HUMAN_REVIEW",
      riskLevel: "HIGH",
      priorityScore: 82,
      humanReviewRequired: true,
      hasRiskAssessment: true,
      primaryBarrierCategory: "SOCIAL_LOGISTICAL",
      primaryBarrierCode: "transportation",
      matchedProviderId: "p2",
      matchedProviderName: "Clinic North",
      matchedProviderAvailabilitySource: "DIRECTORY_INFORMATION",
      firstCompletedVisitAt: null,
      interventions: [
        {
          id: "i2",
          type: "MISSED_APPOINTMENT_REENGAGEMENT",
          status: "IN_PROGRESS",
          epistemicOrigin: "AI_RECOMMENDATION",
          autoExecuted: false,
          outcomes: [],
        },
      ],
      appointments: [
        {
          id: "a2",
          providerId: "p2",
          scheduledStartAt: new Date("2026-10-14T10:00:00Z"),
          status: AppointmentStatus.NO_SHOW,
          createdAt: new Date("2026-10-11T10:00:00Z"),
        },
      ],
      verifications: [
        {
          id: "v3",
          signalType: VerificationSignalType.APPOINTMENT_SCHEDULED,
          verified: true,
          verificationStatus: VerificationStatus.VERIFIED,
        },
      ],
      communicationsCount: 1,
      caseNotesCount: 0,
    },
    {
      caseId: "c3",
      externalReferralId: "REF-3-INELIGIBLE",
      referralDate: new Date("2026-10-12T10:00:00Z"),
      specialty: "Psychiatry",
      behavioralHealthNeed: "Evaluation",
      eligibilityVerified: "INELIGIBLE",
      memberEligibilityStatus: "INACTIVE",
      memberId: "m3",
      memberName: "Ineligible Member",
      geography: "Rural East",
      urbanicity: "RURAL",
      preferredLanguage: "English",
      coverageType: "MEDICARE",
      raceEthnicityCohort: null,
      ageGroupCohort: null,
      status: "BLOCKED",
      riskLevel: "MEDIUM",
      priorityScore: 55,
      humanReviewRequired: false,
      hasRiskAssessment: true,
      primaryBarrierCategory: "ADMINISTRATIVE",
      primaryBarrierCode: "authorization requirement",
      matchedProviderId: null,
      matchedProviderName: null,
      matchedProviderAvailabilitySource: null,
      firstCompletedVisitAt: null,
      interventions: [],
      appointments: [],
      verifications: [],
      communicationsCount: 0,
      caseNotesCount: 0,
    },
  ];

  it("computes reconciled Volume, Conversion, Efficiency, Outcomes, Equity, and North-Star metrics", () => {
    const res = computeExecutiveMetrics(sampleRecords);

    // North-star excludes INELIGIBLE/INACTIVE REF-3 from eligible denominator (1 completed / 2 eligible = 50%)
    expect(res.northStar.eligibleReferralsCount).toBe(2);
    expect(res.northStar.completedEligibleCount).toBe(1);
    expect(res.northStar.ratePct).toBe(50);

    // Volume
    expect(res.volume.referralsReceived).toBe(3);
    expect(res.volume.membersPrioritized).toBe(3);
    expect(res.volume.interventionsInitiated).toBe(2);

    // Conversion
    expect(res.conversion.referralsToAppointments).toEqual({
      numerator: 2,
      denominator: 3,
      pct: 66.7,
    });
    expect(res.conversion.appointmentsToCompletedVisits).toEqual({
      numerator: 1,
      denominator: 2,
      pct: 50,
    });
    expect(res.conversion.completedVisitsToContinuedEngagement).toEqual({
      numerator: 1,
      denominator: 1,
      pct: 100,
    });

    // Efficiency: c1 has 1 human intervention (0.5h) + 2 comms (0.5h) + 1 note (0.25h) + 2 verifications (0.5h) = 1.75h
    expect(res.efficiency.avgTimeToAppointmentDays).toBe(3.5);
    expect(res.efficiency.avgDaysToCare).toBe(5);
    expect(res.efficiency.interventionSuccessRatePct).toBe(100);
    expect(res.efficiency.humanHoursPerCompletedCase).toBe(1.75);

    // Outcomes
    expect(res.outcomes.appointmentCompletionRatePct).toBe(50);
    expect(res.outcomes.noShowRatePct).toBe(50);
    expect(res.outcomes.reEngagementRatePct).toBe(0);
    expect(res.outcomes.providerMatchSuccessPct).toBe(66.7);

    // Equity disparities
    expect(res.equity.disparityInAppointmentCompletionPctPts).toBe(100);
    expect(res.reconciliationRows).toHaveLength(3);
  });

  it("filters deterministically across date, geography, referralType, barrier, intervention, provider, and cohort", () => {
    expect(filterDashboardCases(sampleRecords, { geography: "Central Metro" })).toHaveLength(1);
    expect(filterDashboardCases(sampleRecords, { barrier: "SOCIAL_LOGISTICAL" })).toHaveLength(1);
    expect(
      filterDashboardCases(sampleRecords, {
        intervention: "LANGUAGE_COMPATIBLE_PROVIDER_SEARCH",
      })
    ).toHaveLength(1);
    expect(filterDashboardCases(sampleRecords, { providerId: "p2" })).toHaveLength(1);
    expect(
      filterDashboardCases(sampleRecords, {
        populationDimension: "urbanicity",
        cohortValue: "RURAL",
      })
    ).toHaveLength(2);
    expect(
      filterDashboardCases(sampleRecords, {
        dateFrom: "2026-10-09",
        dateTo: "2026-10-15",
      })
    ).toHaveLength(2);
  });
});
