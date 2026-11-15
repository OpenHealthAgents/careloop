import {
  computeAgenticMetrics,
  computeExecutiveMetrics,
  DashboardCaseRecord,
  DashboardFilters,
  filterDashboardCases,
} from "@/domain/analytics/executive-metrics";
import {
  ActuarialAssumptions,
  computePayerValueRealization,
  PayerValueRealizationReport,
} from "@/domain/analytics/payer-roi-engine";
import {
  CohortDimension,
  compareCohorts,
  computeBarrierPrevalence,
  computeCohortMetrics,
  computeDisparityMonitoring,
  computeDisparityReducingInterventions,
  computeInterventionEffectiveness,
  EquityCaseRecord,
  MIN_RELIABLE_COHORT_SIZE,
} from "@/domain/equity/analytics";
import { prisma } from "@/lib/db";

export type { DashboardFilters };
export type { ActuarialAssumptions, PayerValueRealizationReport };

export async function getDashboardAnalytics(tenantId: string, filters?: DashboardFilters) {
  const [cases, providers, agentRuns, toolSpans, approvals] = await Promise.all([
    prisma.case.findMany({
      where: { tenantId },
      include: {
        referral: true,
        member: true,
        matchedProvider: {
          select: { id: true, name: true, availabilitySource: true },
        },
        riskAssessments: { select: { id: true } },
        verifications: true,
        interventions: {
          include: {
            outcomes: { select: { barriersResolved: true, outcomeStatus: true } },
          },
        },
        appointments: true,
        communications: {
          select: { deliveryStatus: true },
        },
        _count: {
          select: {
            communications: true,
            caseNotes: true,
          },
        },
      },
      orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
    }),
    prisma.provider.findMany({
      where: { tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.agentRun.findMany({
      where: { tenantId },
      select: {
        id: true,
        caseId: true,
        status: true,
        latencyMs: true,
        startedAt: true,
        completedAt: true,
      },
    }),
    prisma.toolExecutionSpan.findMany({
      where: { tenantId },
      select: { id: true, caseId: true, status: true },
    }),
    prisma.approvalRequest.findMany({
      where: { tenantId },
      select: { id: true, status: true },
    }),
  ]);

  const allRecords: DashboardCaseRecord[] = cases.map((c) => ({
    caseId: c.id,
    externalReferralId: c.referral.externalReferralId,
    referralDate: c.referral.referralDate,
    specialty: c.referral.specialty,
    behavioralHealthNeed: c.referral.behavioralHealthNeed,
    eligibilityVerified: c.referral.eligibilityVerified,
    memberEligibilityStatus: c.member.eligibilityStatus,
    memberId: c.memberId,
    memberName: `${c.member.firstName} ${c.member.lastName}`,
    geography: c.referral.geography,
    urbanicity: c.member.urbanicity,
    preferredLanguage: c.member.preferredLanguage,
    coverageType: c.member.coverageType,
    raceEthnicityCohort: c.member.raceEthnicityCohort,
    ageGroupCohort: c.member.ageGroupCohort,
    status: c.status,
    riskLevel: c.riskLevel,
    priorityScore: c.priorityScore,
    humanReviewRequired: c.humanReviewRequired,
    hasRiskAssessment: c.riskAssessments.length > 0,
    primaryBarrierCategory: c.primaryBarrierCategory,
    primaryBarrierCode: c.primaryBarrierCode,
    matchedProviderId: c.matchedProviderId,
    matchedProviderName: c.matchedProvider?.name ?? null,
    matchedProviderAvailabilitySource: c.matchedProvider?.availabilitySource ?? null,
    firstCompletedVisitAt: c.firstCompletedVisitAt,
    interventions: c.interventions.map((i) => ({
      id: i.id,
      type: i.type,
      status: i.status,
      epistemicOrigin: i.epistemicOrigin,
      autoExecuted: i.autoExecuted,
      outcomes: i.outcomes,
    })),
    appointments: c.appointments.map((a) => ({
      id: a.id,
      providerId: a.providerId,
      scheduledStartAt: a.scheduledStartAt,
      status: a.status,
      createdAt: a.createdAt,
    })),
    verifications: c.verifications.map((v) => ({
      id: v.id,
      signalType: v.signalType,
      verified: v.verified,
      verificationStatus: v.verificationStatus,
    })),
    communicationsCount: c._count.communications,
    caseNotesCount: c._count.caseNotes,
    unableToReach:
      c.status === "LOST_TO_FOLLOW_UP" ||
      (c.communications.length > 0 &&
        c.communications.some((comm) => comm.deliveryStatus === "NO_RESPONSE") &&
        !c.communications.some((comm) => comm.deliveryStatus === "RESPONDED")),
  }));

  const filteredRecords = filterDashboardCases(allRecords, filters);
  const filteredCaseIds = new Set(filteredRecords.map((r) => r.caseId));
  const metrics = computeExecutiveMetrics(filteredRecords);
  const agenticMetrics = computeAgenticMetrics({
    agentRuns: agentRuns.filter((r) => filteredCaseIds.has(r.caseId)),
    toolSpans: toolSpans.filter((s) => s.caseId !== null && filteredCaseIds.has(s.caseId)),
    approvals,
    interventions: filteredRecords.flatMap((r) => r.interventions),
  });

  const filterOptions = {
    geographies: Array.from(new Set(allRecords.map((r) => r.geography))).sort(),
    referralTypes: Array.from(new Set(allRecords.map((r) => r.specialty))).sort(),
    barriers: Array.from(
      new Set(allRecords.map((r) => r.primaryBarrierCategory ?? "UNKNOWN"))
    ).sort(),
    interventions: Array.from(
      new Set(allRecords.flatMap((r) => r.interventions.map((i) => i.type)))
    ).sort(),
    providers,
    languages: Array.from(new Set(allRecords.map((r) => r.preferredLanguage))).sort(),
    urbanicity: Array.from(new Set(allRecords.map((r) => r.urbanicity))).sort(),
    coverageTypes: Array.from(new Set(allRecords.map((r) => r.coverageType))).sort(),
  };

  return {
    ...metrics,
    agenticMetrics,
    filtersApplied: filters ?? {},
    filterOptions,
  };
}

export interface HealthEquityFilters {
  dateFrom?: string;
  dateTo?: string;
  compareA?: { dimension: CohortDimension; value: string };
  compareB?: { dimension: CohortDimension; value: string };
}

export async function getHealthEquityAnalytics(tenantId: string, filters?: HealthEquityFilters) {
  const cases = await prisma.case.findMany({
    where: { tenantId },
    include: {
      referral: true,
      member: true,
      matchedProvider: {
        select: {
          id: true,
          availabilitySource: true,
          languages: true,
        },
      },
      interventions: true,
      appointments: true,
    },
  });

  const fromDate = filters?.dateFrom ? new Date(`${filters.dateFrom}T00:00:00.000Z`) : null;
  const toDate = filters?.dateTo ? new Date(`${filters.dateTo}T23:59:59.999Z`) : null;

  const records: EquityCaseRecord[] = cases
    .filter((c) => {
      if (fromDate && !Number.isNaN(fromDate.getTime()) && c.referral.referralDate < fromDate) {
        return false;
      }
      if (toDate && !Number.isNaN(toDate.getTime()) && c.referral.referralDate > toDate) {
        return false;
      }
      return true;
    })
    .map((c) => {
      const validAppts = c.appointments
        .filter((a) => a.status !== "CANCELLED")
        .sort((a, b) => a.scheduledStartAt.getTime() - b.scheduledStartAt.getTime());
      return {
        caseId: c.id,
        referralDate: c.referral.referralDate,
        firstAppointmentAt: validAppts[0]?.scheduledStartAt ?? null,
        firstCompletedVisitAt: c.firstCompletedVisitAt,
      status: c.status,
      primaryBarrierCategory: c.primaryBarrierCategory,
      preferredLanguage: c.member.preferredLanguage,
      urbanicity: c.member.urbanicity,
      coverageType: c.member.coverageType,
      raceEthnicityCohort: c.member.raceEthnicityCohort,
      ageGroupCohort: c.member.ageGroupCohort,
      interventions: c.interventions.map((i) => ({ type: i.type, status: i.status })),
      appointments: c.appointments.map((a) => ({ status: a.status })),
      hasMatchedProvider: Boolean(c.matchedProviderId),
      matchedProviderVerifiedAvailability:
        c.matchedProvider?.availabilitySource === "VERIFIED_AVAILABILITY",
      matchedProviderLanguageConcordant: Boolean(
        c.matchedProvider?.languages.some(
          (lang) => lang.toLowerCase() === c.member.preferredLanguage.toLowerCase()
        )
      ),
      };
    });

  const byLanguage = computeCohortMetrics(records, "preferredLanguage");
  const byUrbanicity = computeCohortMetrics(records, "urbanicity");
  const byCoverage = computeCohortMetrics(records, "coverageType");
  const byAgeGroup = computeCohortMetrics(records, "ageGroupCohort");
  const byRaceEthnicity = computeCohortMetrics(records, "raceEthnicityCohort");

  const barrierPrevalence = computeBarrierPrevalence(records);
  const interventionEffectiveness = computeInterventionEffectiveness(records);
  const disparityReducingInterventions = computeDisparityReducingInterventions(records);

  const allCohorts = [
    ...byLanguage,
    ...byUrbanicity,
    ...byCoverage,
    ...byAgeGroup,
    ...byRaceEthnicity,
  ];
  const disparityMonitoring = computeDisparityMonitoring(allCohorts);

  // Put reliable cohorts first when ranking lowest completion & longest time-to-care, while surfacing sample sizes explicitly
  const lowestCompletionCohorts = [...allCohorts]
    .sort((a, b) => {
      if (a.isSmallSample !== b.isSmallSample) return a.isSmallSample ? 1 : -1;
      return a.completionRatePct - b.completionRatePct;
    })
    .slice(0, 6);

  const longestTimeToCareCohorts = [...allCohorts]
    .filter((c) => c.avgTimeToCareDays !== null)
    .sort((a, b) => {
      if (a.isSmallSample !== b.isSmallSample) return a.isSmallSample ? 1 : -1;
      return (b.avgTimeToCareDays ?? 0) - (a.avgTimeToCareDays ?? 0);
    })
    .slice(0, 6);

  const disparityTrends = allCohorts
    .filter((c) => c.disparityTrend !== "INSUFFICIENT_DATA")
    .sort((a, b) => a.disparityGapPctPoints - b.disparityGapPctPoints);

  // Default comparison: lowest vs highest completion cohort inside preferredLanguage (or first two options)
  const defaultSelA = filters?.compareA ?? {
    dimension: "preferredLanguage" as CohortDimension,
    value: byLanguage[0]?.cohort ?? "Spanish",
  };
  const defaultSelB = filters?.compareB ?? {
    dimension: "preferredLanguage" as CohortDimension,
    value: byLanguage[byLanguage.length - 1]?.cohort ?? "English",
  };
  const comparison = compareCohorts(records, defaultSelA, defaultSelB);

  const comparisonOptions = allCohorts.map((c) => ({
    key: `${c.dimension}::${c.cohort}`,
    dimension: c.dimension,
    cohort: c.cohort,
    totalCases: c.totalCases,
  }));

  const totalWithAccess = records.length;
  const providerAccessSummary = {
    totalCases: totalWithAccess,
    matchedProviderCases: records.filter((r) => r.hasMatchedProvider).length,
    matchedProviderRatePct:
      totalWithAccess > 0
        ? Number(
            (
              (records.filter((r) => r.hasMatchedProvider).length / totalWithAccess) *
              100
            ).toFixed(1)
          )
        : 0,
    verifiedAvailabilityRatePct:
      totalWithAccess > 0
        ? Number(
            (
              (records.filter((r) => r.matchedProviderVerifiedAvailability).length /
                totalWithAccess) *
              100
            ).toFixed(1)
          )
        : 0,
    languageConcordantAccessRatePct:
      totalWithAccess > 0
        ? Number(
            (
              (records.filter((r) => r.matchedProviderLanguageConcordant).length /
                totalWithAccess) *
              100
            ).toFixed(1)
          )
        : 0,
  };

  return {
    totalCases: records.length,
    minReliableCohortSize: MIN_RELIABLE_COHORT_SIZE,
    byLanguage,
    byUrbanicity,
    byCoverage,
    byAgeGroup,
    byRaceEthnicity,
    barrierPrevalence,
    interventionEffectiveness,
    disparityReducingInterventions,
    providerAccessSummary,
    disparityMonitoring,
    privacyProtections: {
      minCohortSize: MIN_RELIABLE_COHORT_SIZE,
      individualLevelDataExposed: false,
      smallCohortCautionApplied: true,
      smallCohortCount: allCohorts.filter((c) => c.isSmallSample).length,
    },
    insights: {
      lowestCompletionCohorts,
      mostCommonBarriers: barrierPrevalence.slice(0, 5),
      bestInterventions: interventionEffectiveness.slice(0, 5),
      disparityTrends,
      disparityReducingInterventions: disparityReducingInterventions.slice(0, 5),
      longestTimeToCareCohorts,
    },
    comparison,
    comparisonOptions,
    governanceNotice:
      "Protected attributes (language, urbanicity, age group, race/ethnicity) are aggregated at cohort level strictly for disparity measurement, barrier analysis, intervention evaluation, and equity monitoring—never as individual risk predictors or eligibility gates.",
  };
}

export async function getPayerRoiAnalytics(
  tenantId: string,
  customAssumptions?: Partial<ActuarialAssumptions>
): Promise<PayerValueRealizationReport> {
  const cases = await prisma.case.findMany({
    where: { tenantId },
    include: {
      referral: true,
      member: true,
      matchedProvider: {
        select: { id: true, name: true, availabilitySource: true },
      },
      riskAssessments: { select: { id: true } },
      verifications: true,
      interventions: {
        include: {
          outcomes: { select: { barriersResolved: true, outcomeStatus: true } },
        },
      },
      appointments: true,
      communications: {
        select: { deliveryStatus: true },
      },
      _count: {
        select: {
          communications: true,
          caseNotes: true,
        },
      },
    },
    orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
  });

  const records: DashboardCaseRecord[] = cases.map((c) => ({
    caseId: c.id,
    externalReferralId: c.referral.externalReferralId,
    referralDate: c.referral.referralDate,
    specialty: c.referral.specialty,
    behavioralHealthNeed: c.referral.behavioralHealthNeed,
    eligibilityVerified: c.referral.eligibilityVerified,
    memberEligibilityStatus: c.member.eligibilityStatus,
    memberId: c.memberId,
    memberName: `${c.member.firstName} ${c.member.lastName}`,
    geography: c.referral.geography,
    urbanicity: c.member.urbanicity,
    preferredLanguage: c.member.preferredLanguage,
    coverageType: c.member.coverageType,
    raceEthnicityCohort: c.member.raceEthnicityCohort,
    ageGroupCohort: c.member.ageGroupCohort,
    status: c.status,
    riskLevel: c.riskLevel,
    priorityScore: c.priorityScore,
    humanReviewRequired: c.humanReviewRequired,
    hasRiskAssessment: c.riskAssessments.length > 0,
    primaryBarrierCategory: c.primaryBarrierCategory,
    primaryBarrierCode: c.primaryBarrierCode,
    matchedProviderId: c.matchedProviderId,
    matchedProviderName: c.matchedProvider?.name ?? null,
    matchedProviderAvailabilitySource: c.matchedProvider?.availabilitySource ?? null,
    firstCompletedVisitAt: c.firstCompletedVisitAt,
    interventions: c.interventions.map((i) => ({
      id: i.id,
      type: i.type,
      status: i.status,
      epistemicOrigin: i.epistemicOrigin,
      autoExecuted: i.autoExecuted,
      outcomes: i.outcomes.map((o) => ({
        barriersResolved: o.barriersResolved,
        outcomeStatus: o.outcomeStatus,
      })),
    })),
    appointments: c.appointments.map((a) => ({
      id: a.id,
      providerId: a.providerId,
      scheduledStartAt: a.scheduledStartAt,
      status: a.status,
      createdAt: a.createdAt,
    })),
    verifications: c.verifications.map((v) => ({
      id: v.id,
      signalType: v.signalType,
      verified: v.verified,
      verificationStatus: v.verificationStatus,
    })),
    communicationsCount: c._count.communications,
    caseNotesCount: c._count.caseNotes,
  }));

  return computePayerValueRealization(records, customAssumptions);
}
