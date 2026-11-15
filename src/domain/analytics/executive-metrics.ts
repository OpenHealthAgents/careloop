import {
  AppointmentStatus,
  VerificationSignalType,
  VerificationStatus,
} from "@prisma/client";
import {
  calculateReferralToCompletedRate,
  isVisitCompletionSignal,
} from "@/domain/completion/verifier";
import {
  computeCohortMetrics,
  computeInterventionEffectiveness,
  EquityCaseRecord,
} from "@/domain/equity/analytics";

export interface DashboardCaseRecord {
  caseId: string;
  externalReferralId: string;
  referralDate: Date;
  specialty: string;
  behavioralHealthNeed: string;
  eligibilityVerified: string;
  memberEligibilityStatus: string;
  memberId: string;
  memberName: string;
  geography: string;
  urbanicity: string;
  preferredLanguage: string;
  coverageType: string;
  raceEthnicityCohort: string | null;
  ageGroupCohort: string | null;
  status: string;
  riskLevel: string;
  priorityScore: number;
  humanReviewRequired: boolean;
  hasRiskAssessment: boolean;
  primaryBarrierCategory: string | null;
  primaryBarrierCode: string | null;
  matchedProviderId: string | null;
  matchedProviderName: string | null;
  matchedProviderAvailabilitySource: string | null;
  firstCompletedVisitAt: Date | null;
  interventions: Array<{
    id: string;
    type: string;
    status: string;
    epistemicOrigin: string;
    autoExecuted: boolean;
    outcomes: Array<{ barriersResolved: boolean; outcomeStatus: string }>;
  }>;
  appointments: Array<{
    id: string;
    providerId: string;
    scheduledStartAt: Date;
    status: AppointmentStatus;
    createdAt: Date;
  }>;
  verifications: Array<{
    id: string;
    signalType: VerificationSignalType;
    verified: boolean;
    verificationStatus?: VerificationStatus;
  }>;
  communicationsCount: number;
  caseNotesCount: number;
  unableToReach?: boolean;
}

export interface DashboardFilters {
  dateFrom?: string;
  dateTo?: string;
  geography?: string;
  referralType?: string;
  barrier?: string;
  intervention?: string;
  providerId?: string;
  populationDimension?:
    | "preferredLanguage"
    | "urbanicity"
    | "coverageType"
    | "raceEthnicityCohort"
    | "ageGroupCohort";
  cohortValue?: string;
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const raw = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return Number(raw.toFixed(1));
}

export function filterDashboardCases(
  records: DashboardCaseRecord[],
  filters?: DashboardFilters
): DashboardCaseRecord[] {
  if (!filters) return records;

  const fromDate = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00.000Z`) : null;
  const toDate = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999Z`) : null;

  return records.filter((c) => {
    if (fromDate && !Number.isNaN(fromDate.getTime()) && c.referralDate < fromDate) {
      return false;
    }
    if (toDate && !Number.isNaN(toDate.getTime()) && c.referralDate > toDate) {
      return false;
    }
    if (filters.geography && c.geography !== filters.geography) {
      return false;
    }
    if (filters.referralType && c.specialty !== filters.referralType) {
      return false;
    }
    if (filters.barrier && (c.primaryBarrierCategory ?? "UNKNOWN") !== filters.barrier) {
      return false;
    }
    if (
      filters.intervention &&
      !c.interventions.some((i) => i.type === filters.intervention && i.status !== "REJECTED")
    ) {
      return false;
    }
    if (
      filters.providerId &&
      c.matchedProviderId !== filters.providerId &&
      !c.appointments.some((a) => a.providerId === filters.providerId)
    ) {
      return false;
    }
    if (filters.populationDimension && filters.cohortValue) {
      const actualVal = c[filters.populationDimension] ?? "NOT AVAILABLE";
      if (actualVal !== filters.cohortValue) {
        return false;
      }
    }
    return true;
  });
}

export function computeExecutiveMetrics(records: DashboardCaseRecord[]) {
  const totalReferrals = records.length;

  // Eligible referrals (exclude explicitly INELIGIBLE / INACTIVE referrals for north-star denominator)
  const eligibleRecords = records.filter(
    (c) =>
      c.eligibilityVerified !== "INELIGIBLE" &&
      c.memberEligibilityStatus !== "INACTIVE"
  );
  const hasVerifiedVisit = (c: DashboardCaseRecord) =>
    c.firstCompletedVisitAt !== null ||
    c.verifications.some(
      (v) =>
        v.verified &&
        (v.verificationStatus === undefined || v.verificationStatus === "VERIFIED") &&
        isVisitCompletionSignal(v.signalType)
    );

  const verifiedCompletedCases = records.filter(hasVerifiedVisit);
  const completedEligibleCases = eligibleRecords.filter(hasVerifiedVisit);
  const completedCount = verifiedCompletedCases.length;
  const referralToCompletedRatePct = calculateReferralToCompletedRate(
    eligibleRecords.length > 0 ? eligibleRecords.length : totalReferrals,
    eligibleRecords.length > 0 ? completedEligibleCases.length : completedCount
  );

  // Volume
  const membersPrioritized = new Set(
    records
      .filter((c) => c.hasRiskAssessment || c.riskLevel !== "UNKNOWN" || c.priorityScore !== 50)
      .map((c) => c.memberId)
  ).size;

  const allInterventions = records.flatMap((c) => c.interventions);
  const initiatedInterventions = allInterventions.filter(
    (i) => i.status !== "RECOMMENDED" && i.status !== "REJECTED"
  );

  // Conversion
  const matchedCases = records.filter((c) => c.matchedProviderId !== null);
  const casesWithAppointments = records.filter(
    (c) =>
      c.appointments.some((a) => a.status !== "CANCELLED") ||
      c.status === "APPOINTMENT_SCHEDULED" ||
      c.status === "APPOINTMENT_CONFIRMED" ||
      c.status === "APPOINTMENT_COMPLETED" ||
      c.status === "VERIFIED" ||
      c.status === "CLOSED" ||
      c.firstCompletedVisitAt !== null
  );
  const continuedEngagementCases = verifiedCompletedCases.filter(
    (c) =>
      c.verifications.some(
        (v) => v.verified && v.signalType === VerificationSignalType.SUBSEQUENT_TREATMENT_ENGAGEMENT
      ) || c.appointments.filter((a) => a.status === "COMPLETED").length >= 2
  );

  // Efficiency
  const daysToAppointmentList: number[] = [];
  for (const c of records) {
    const validAppts = c.appointments
      .filter((a) => a.status !== "CANCELLED")
      .sort((a, b) => a.scheduledStartAt.getTime() - b.scheduledStartAt.getTime());
    if (validAppts.length > 0) {
      daysToAppointmentList.push(
        Math.max(
          0,
          (validAppts[0].scheduledStartAt.getTime() - c.referralDate.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );
    }
  }
  const avgTimeToAppointmentDays =
    daysToAppointmentList.length > 0
      ? Number(
          (daysToAppointmentList.reduce((a, b) => a + b, 0) / daysToAppointmentList.length).toFixed(1)
        )
      : null;

  const completedDays = verifiedCompletedCases
    .filter((c) => c.firstCompletedVisitAt !== null)
    .map((c) =>
      Math.max(
        0,
        (c.firstCompletedVisitAt!.getTime() - c.referralDate.getTime()) / (1000 * 60 * 60 * 24)
      )
    );
  const avgDaysToCare =
    completedDays.length > 0
      ? Number((completedDays.reduce((a, b) => a + b, 0) / completedDays.length).toFixed(1))
      : null;
  const medianTimeToCareDays = median(completedDays);

  const evaluatedInterventions = allInterventions.filter(
    (i) => i.status === "COMPLETED" || i.status === "FAILED"
  );
  const successfulInterventions = evaluatedInterventions.filter(
    (i) => i.status === "COMPLETED" && (i.outcomes.length === 0 || i.outcomes.some((o) => o.barriersResolved))
  );
  const interventionSuccessRatePct = pct(
    successfulInterventions.length,
    evaluatedInterventions.length
  );

  // Source-reconcilable human coordination hours per completed case:
  // Derived strictly from audited non-auto interventions (0.5h), outbound/inbound outreach comms (0.25h),
  // case notes (0.25h), and human verifications (0.25h) across completed cases.
  let humanInterventionsCompletedCases = 0;
  let commsCompletedCases = 0;
  let notesCompletedCases = 0;
  let verifCompletedCases = 0;
  for (const c of verifiedCompletedCases) {
    humanInterventionsCompletedCases += c.interventions.filter(
      (i) => !i.autoExecuted && i.status !== "RECOMMENDED" && i.status !== "REJECTED"
    ).length;
    commsCompletedCases += c.communicationsCount;
    notesCompletedCases += c.caseNotesCount;
    verifCompletedCases += c.verifications.length;
  }
  const totalMeasuredHours =
    humanInterventionsCompletedCases * 0.5 +
    (commsCompletedCases + notesCompletedCases + verifCompletedCases) * 0.25;
  const humanHoursPerCompletedCase =
    completedCount > 0 ? Number((totalMeasuredHours / completedCount).toFixed(2)) : null;

  // Outcomes
  const allAppts = records.flatMap((c) => c.appointments);
  const finalizedAppts = allAppts.filter(
    (a) =>
      a.status === "SCHEDULED" ||
      a.status === "CONFIRMED" ||
      a.status === "COMPLETED" ||
      a.status === "NO_SHOW"
  );
  const completedAppts = allAppts.filter((a) => a.status === "COMPLETED");
  const noShowAppts = allAppts.filter((a) => a.status === "NO_SHOW");

  const appointmentCompletionRatePct = pct(completedAppts.length, finalizedAppts.length);
  const noShowRatePct = pct(noShowAppts.length, finalizedAppts.length);

  const missedCohort = records.filter(
    (c) =>
      c.appointments.some((a) => a.status === "NO_SHOW") ||
      c.interventions.some((i) => i.type === "MISSED_APPOINTMENT_REENGAGEMENT")
  );
  const reEngagedCohort = missedCohort.filter(
    (c) =>
      hasVerifiedVisit(c) ||
      c.appointments.some((a) => a.status === "SCHEDULED" || a.status === "CONFIRMED")
  );
  const reEngagementRatePct = pct(reEngagedCohort.length, missedCohort.length);

  const verifiedSlotMatches = matchedCases.filter(
    (c) => c.matchedProviderAvailabilitySource === "VERIFIED_AVAILABILITY"
  ).length;
  const providerMatchSuccessPct = pct(matchedCases.length, totalReferrals);

  const activeCasesCount = records.filter(
    (c) => c.status !== "CLOSED" && c.status !== "VERIFIED"
  ).length;
  const unableToReachCount = records.filter(
    (c) => c.status === "LOST_TO_FOLLOW_UP" || c.unableToReach === true
  ).length;
  const unableToReachRatePct = pct(unableToReachCount, totalReferrals);

  // Breakdowns
  const barrierMap = new Map<string, number>();
  const statusMap = new Map<string, number>();
  for (const c of records) {
    const bKey = c.primaryBarrierCategory ?? "UNKNOWN";
    barrierMap.set(bKey, (barrierMap.get(bKey) ?? 0) + 1);
    statusMap.set(c.status, (statusMap.get(c.status) ?? 0) + 1);
  }
  const barrierBreakdown = Array.from(barrierMap.entries())
    .map(([category, count]) => ({
      category,
      count,
      pct: pct(count, totalReferrals),
    }))
    .sort((a, b) => b.count - a.count);
  const statusBreakdown = Array.from(statusMap.entries()).map(([status, count]) => ({
    status,
    count,
  }));

  // Equity cohort aggregations
  const equityRecords: EquityCaseRecord[] = records.map((c) => ({
    caseId: c.caseId,
    referralDate: c.referralDate,
    firstCompletedVisitAt: c.firstCompletedVisitAt,
    status: c.status,
    primaryBarrierCategory: c.primaryBarrierCategory,
    preferredLanguage: c.preferredLanguage,
    urbanicity: c.urbanicity,
    coverageType: c.coverageType,
    raceEthnicityCohort: c.raceEthnicityCohort,
    ageGroupCohort: c.ageGroupCohort,
    interventions: c.interventions.map((i) => ({ type: i.type, status: i.status })),
  }));

  const byLanguage = computeCohortMetrics(equityRecords, "preferredLanguage");
  const byUrbanicity = computeCohortMetrics(equityRecords, "urbanicity");
  const byCoverage = computeCohortMetrics(equityRecords, "coverageType");
  const byRaceEthnicity = computeCohortMetrics(equityRecords, "raceEthnicityCohort");
  const interventionEffectiveness = computeInterventionEffectiveness(equityRecords);

  const allCohorts = [...byLanguage, ...byUrbanicity, ...byCoverage, ...byRaceEthnicity];
  const cohortTimes = allCohorts
    .map((c) => c.avgTimeToCareDays)
    .filter((d): d is number => d !== null);
  const disparityInTimeToCareDays =
    cohortTimes.length >= 2
      ? Number((Math.max(...cohortTimes) - Math.min(...cohortTimes)).toFixed(1))
      : null;

  const cohortRates = allCohorts
    .filter((c) => c.totalCases > 0)
    .map((c) => c.completionRatePct);
  const disparityInAppointmentCompletionPctPts =
    cohortRates.length >= 2
      ? Number((Math.max(...cohortRates) - Math.min(...cohortRates)).toFixed(1))
      : null;

  const highRiskOpen = records.filter(
    (c) => c.riskLevel === "HIGH" && c.status !== "VERIFIED" && c.status !== "CLOSED"
  ).length;
  const escalatedCount = records.filter(
    (c) => c.status === "ESCALATED" || c.status === "REQUIRES_HUMAN_REVIEW"
  ).length;
  const pendingAiReviews = allInterventions.filter((i) => i.status === "RECOMMENDED").length;
  const totalVerificationSignals = records.reduce(
    (sum, c) => sum + c.verifications.filter((v) => v.verified).length,
    0
  );

  return {
    northStar: {
      eligibleReferralsCount: eligibleRecords.length,
      completedEligibleCount: completedEligibleCases.length,
      ratePct: referralToCompletedRatePct,
      description:
        "Percentage of eligible behavioral-health referrals resulting in a verified completed behavioral-health visit.",
    },
    kpis: {
      totalReferrals,
      activeCasesCount,
      matchedCount: matchedCases.length,
      scheduledCount: casesWithAppointments.length,
      completedCount,
      referralToCompletedRatePct,
      avgDaysToCare,
      medianTimeToCareDays,
      highRiskOpen,
      escalatedCount,
      pendingAiReviews,
      noShowAppointments: noShowAppts.length,
      totalVerificationSignals,
    },
    volume: {
      referralsReceived: totalReferrals,
      eligibleReferrals: eligibleRecords.length,
      membersPrioritized,
      interventionsInitiated: initiatedInterventions.length,
      interventionsRecommendedTotal: allInterventions.length,
    },
    conversion: {
      referralsToAppointments: {
        numerator: casesWithAppointments.length,
        denominator: totalReferrals,
        pct: pct(casesWithAppointments.length, totalReferrals),
      },
      appointmentsToCompletedVisits: {
        numerator: completedCount,
        denominator: casesWithAppointments.length,
        pct: pct(completedCount, casesWithAppointments.length),
      },
      completedVisitsToContinuedEngagement: {
        numerator: continuedEngagementCases.length,
        denominator: completedCount,
        pct: pct(continuedEngagementCases.length, completedCount),
      },
    },
    efficiency: {
      avgTimeToAppointmentDays,
      avgDaysToCare,
      medianTimeToCareDays,
      interventionSuccessRatePct,
      interventionSuccessCount: successfulInterventions.length,
      interventionEvaluatedCount: evaluatedInterventions.length,
      humanHoursPerCompletedCase,
      humanHoursFormula:
        "0.5h per human-led intervention + 0.25h per outreach, case note, and verification across verified completed cases.",
      humanTouchpointTotals: {
        humanInterventions: humanInterventionsCompletedCases,
        communications: commsCompletedCases,
        caseNotes: notesCompletedCases,
        verifications: verifCompletedCases,
      },
    },
    outcomes: {
      referralCompletionRatePct: referralToCompletedRatePct,
      appointmentCompletionRatePct,
      appointmentCompletedCount: completedAppts.length,
      appointmentFinalizedCount: finalizedAppts.length,
      noShowRatePct,
      noShowCount: noShowAppts.length,
      reEngagementRatePct,
      reEngagedCount: reEngagedCohort.length,
      missedCohortCount: missedCohort.length,
      providerMatchSuccessPct,
      matchedCount: matchedCases.length,
      verifiedSlotMatchesCount: verifiedSlotMatches,
      unableToReachCount,
      unableToReachRatePct,
      escalationCount: escalatedCount,
      escalationRatePct: pct(escalatedCount, totalReferrals),
    },
    equity: {
      disparityInTimeToCareDays,
      disparityInAppointmentCompletionPctPts,
      byLanguage,
      byUrbanicity,
      byCoverage,
      byRaceEthnicity,
      interventionEffectiveness,
    },
    funnel: [
      { stage: "Referral Received", count: totalReferrals },
      { stage: "Provider Matched", count: matchedCases.length },
      { stage: "Appointment Scheduled", count: casesWithAppointments.length },
      { stage: "First Completed Visit Verified", count: completedCount },
    ],
    barrierBreakdown,
    statusBreakdown,
    priorityCases: records
      .filter((c) => c.status !== "CLOSED" && c.status !== "VERIFIED")
      .slice(0, 6)
      .map((c) => ({
        id: c.caseId,
        externalReferralId: c.externalReferralId,
        memberName: c.memberName,
        specialty: c.specialty,
        status: c.status,
        riskTier: c.riskLevel,
        priorityScore: c.priorityScore,
        primaryBarrierCategory: c.primaryBarrierCategory ?? "UNKNOWN",
        primaryBarrierCode: c.primaryBarrierCode ?? "Barrier unknown",
        humanReviewRequired: c.humanReviewRequired,
      })),
    reconciliationRows: records.map((c) => ({
      caseId: c.caseId,
      externalReferralId: c.externalReferralId,
      referralDate: c.referralDate.toISOString(),
      memberName: c.memberName,
      geography: c.geography,
      specialty: c.specialty,
      preferredLanguage: c.preferredLanguage,
      coverageType: c.coverageType,
      status: c.status,
      riskLevel: c.riskLevel,
      priorityScore: c.priorityScore,
      primaryBarrierCategory: c.primaryBarrierCategory ?? "UNKNOWN",
      matchedProviderName: c.matchedProviderName,
      interventionsCount: c.interventions.length,
      appointmentsCount: c.appointments.length,
      hasVerifiedVisit: hasVerifiedVisit(c),
      firstCompletedVisitAt: c.firstCompletedVisitAt?.toISOString() ?? null,
    })),
  };
}

export interface AgenticMetricsInput {
  agentRuns: Array<{
    id: string;
    caseId: string;
    status: string;
    latencyMs: number | null;
    startedAt: Date;
    completedAt: Date | null;
  }>;
  toolSpans: Array<{
    id: string;
    caseId: string | null;
    status: string;
  }>;
  approvals: Array<{
    id: string;
    status: string;
  }>;
  interventions: Array<{
    status: string;
    autoExecuted: boolean;
  }>;
}

export interface ExecutiveAgenticMetrics {
  agentRuns: number;
  successfulRuns: number;
  humanHandoffs: number;
  approvalRatePct: number;
  toolFailureRatePct: number;
  averageActionsPerCase: number;
  averageTimePerCaseMs: number;
  averageTimePerCaseSec: number;
  automationRatePct: number;
  objective: string;
}

/**
 * Compute executive agentic execution & human oversight metrics.
 * Do not optimize automation rate blindly: the objective is successful equitable care execution.
 */
export function computeAgenticMetrics(input: AgenticMetricsInput): ExecutiveAgenticMetrics {
  const agentRuns = input.agentRuns.length;
  const successfulRuns = input.agentRuns.filter((r) => r.status === "COMPLETED").length;
  const humanHandoffs = input.agentRuns.filter(
    (r) => r.status === "ESCALATED" || r.status === "AWAITING_APPROVAL"
  ).length;

  const decidedApprovals = input.approvals.filter(
    (a) => a.status === "APPROVED" || a.status === "REJECTED"
  );
  const approvedCount = input.approvals.filter((a) => a.status === "APPROVED").length;
  const approvalRatePct = pct(approvedCount, decidedApprovals.length);

  const totalToolCalls = input.toolSpans.length;
  const failedToolCalls = input.toolSpans.filter((s) => s.status === "FAILED").length;
  const toolFailureRatePct = pct(failedToolCalls, totalToolCalls);

  const casesWithAgentActivity = new Set([
    ...input.agentRuns.map((r) => r.caseId),
    ...input.toolSpans.map((s) => s.caseId).filter((id): id is string => id !== null),
  ]).size;
  const averageActionsPerCase =
    casesWithAgentActivity > 0
      ? Number((totalToolCalls / casesWithAgentActivity).toFixed(2))
      : 0;

  const caseDurationsMs = new Map<string, number>();
  for (const run of input.agentRuns) {
    const duration =
      typeof run.latencyMs === "number" && run.latencyMs >= 0
        ? run.latencyMs
        : run.completedAt
          ? Math.max(0, run.completedAt.getTime() - run.startedAt.getTime())
          : 0;
    if (duration > 0) {
      caseDurationsMs.set(run.caseId, (caseDurationsMs.get(run.caseId) ?? 0) + duration);
    }
  }
  const durationValues = Array.from(caseDurationsMs.values());
  const averageTimePerCaseMs =
    durationValues.length > 0
      ? Math.round(durationValues.reduce((a, b) => a + b, 0) / durationValues.length)
      : 0;
  const averageTimePerCaseSec = Number((averageTimePerCaseMs / 1000).toFixed(2));

  const executedInterventions = input.interventions.filter(
    (i) => i.status !== "RECOMMENDED" && i.status !== "REJECTED"
  );
  const autoExecutedCount = executedInterventions.filter((i) => i.autoExecuted).length;
  const automationRatePct =
    executedInterventions.length > 0
      ? pct(autoExecutedCount, executedInterventions.length)
      : pct(successfulRuns, agentRuns);

  return {
    agentRuns,
    successfulRuns,
    humanHandoffs,
    approvalRatePct,
    toolFailureRatePct,
    averageActionsPerCase,
    averageTimePerCaseMs,
    averageTimePerCaseSec,
    automationRatePct,
    objective:
      "Successful equitable care execution — do not optimize automation rate blindly.",
  };
}
