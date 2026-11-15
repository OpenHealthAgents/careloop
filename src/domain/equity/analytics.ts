/**
 * Cohort-level Health Equity Analytics.
 *
 * GOVERNANCE RULE:
 * Protected/sensitive attributes (raceEthnicityCohort, preferredLanguage, ageGroupCohort, urbanicity)
 * are used ONLY for cohort disparity measurement, barrier distribution, and intervention evaluation.
 * They MUST NEVER be used as simplistic individual risk predictors or eligibility gates.
 */

export const MIN_RELIABLE_COHORT_SIZE = 5;

export type CohortDimension =
  | "preferredLanguage"
  | "urbanicity"
  | "coverageType"
  | "raceEthnicityCohort"
  | "ageGroupCohort";

export interface EquityCaseRecord {
  caseId: string;
  referralDate: Date;
  firstAppointmentAt?: Date | null;
  firstCompletedVisitAt: Date | null;
  status: string;
  primaryBarrierCategory: string | null;
  preferredLanguage: string;
  urbanicity: string;
  coverageType: string;
  raceEthnicityCohort: string | null;
  ageGroupCohort: string | null;
  interventions: Array<{ type: string; status: string }>;
  appointments?: Array<{ status: string }>;
  hasMatchedProvider?: boolean;
  matchedProviderVerifiedAvailability?: boolean;
  matchedProviderLanguageConcordant?: boolean;
}

export interface BarrierPrevalenceRow {
  category: string;
  count: number;
  pct: number;
}

export type DisparityTrendDirection =
  | "INCREASING"
  | "DECREASING"
  | "STABLE"
  | "INSUFFICIENT_DATA";

export interface CohortMetric {
  dimension: CohortDimension | string;
  cohort: string;
  totalCases: number;
  completedCases: number;
  completionRatePct: number;
  avgTimeToAppointmentDays: number | null;
  avgTimeToCareDays: number | null;
  interventionSuccessRatePct: number | null;
  appointmentCompletionRatePct: number | null;
  completedAppointments: number;
  finalizedAppointments: number;
  noShowRatePct: number | null;
  noShowAppointments: number;
  providerMatchedRatePct: number | null;
  verifiedProviderAccessRatePct: number | null;
  languageConcordantAccessRatePct: number | null;
  disparityGapPctPoints: number;
  disparityTrend: DisparityTrendDirection;
  earlierPeriodRatePct: number | null;
  recentPeriodRatePct: number | null;
  topBarrier: string;
  barrierPrevalence: BarrierPrevalenceRow[];
  isSmallSample: boolean;
  sampleCaution: string | null;
}

export interface InterventionEffectivenessRow {
  interventionType: string;
  totalUsed: number;
  completedCasesWithIntervention: number;
  completionRatePct: number;
  isSmallSample: boolean;
  sampleCaution: string | null;
}

export interface DisparityReducingInterventionRow {
  interventionType: string;
  underservedTotalWithIntervention: number;
  underservedCompletedWithIntervention: number;
  rateWithInterventionPct: number;
  underservedTotalWithoutIntervention: number;
  underservedCompletedWithoutIntervention: number;
  rateWithoutInterventionPct: number;
  liftPctPoints: number;
  isSmallSample: boolean;
  sampleCaution: string | null;
}

export interface CohortComparisonResult {
  cohortA: CohortMetric | null;
  cohortB: CohortMetric | null;
  deltas: {
    completionRateDiffPctPts: number | null;
    avgTimeToAppointmentDiffDays: number | null;
    avgTimeToCareDiffDays: number | null;
    appointmentCompletionDiffPctPts: number | null;
    noShowRateDiffPctPts: number | null;
  };
  interventionComparison: Array<{
    interventionType: string;
    cohortARatePct: number | null;
    cohortASample: number;
    cohortBRatePct: number | null;
    cohortBSample: number;
  }>;
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function smallSampleCaution(n: number): { isSmallSample: boolean; sampleCaution: string | null } {
  if (n < MIN_RELIABLE_COHORT_SIZE) {
    return {
      isSmallSample: true,
      sampleCaution: `Small sample (n=${n} < ${MIN_RELIABLE_COHORT_SIZE}): interpret cautiously; avoid generalized conclusions.`,
    };
  }
  return { isSmallSample: false, sampleCaution: null };
}

function medianOrMeanDays(records: EquityCaseRecord[]): number | null {
  const durations = records
    .filter((r) => r.firstCompletedVisitAt !== null)
    .map((r) => {
      const diffMs = r.firstCompletedVisitAt!.getTime() - r.referralDate.getTime();
      return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
    });
  if (durations.length === 0) return null;
  const sum = durations.reduce((acc, d) => acc + d, 0);
  return Number((sum / durations.length).toFixed(1));
}

export function computeBarrierPrevalence(records: EquityCaseRecord[]): BarrierPrevalenceRow[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    const key = r.primaryBarrierCategory ?? "UNKNOWN";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({
      category,
      count,
      pct: pct(count, records.length),
    }))
    .sort((a, b) => b.count - a.count);
}

function computeAppointmentStats(records: EquityCaseRecord[]) {
  const appts = records.flatMap((r) => r.appointments ?? []);
  const finalized = appts.filter(
    (a) =>
      a.status === "SCHEDULED" ||
      a.status === "CONFIRMED" ||
      a.status === "COMPLETED" ||
      a.status === "NO_SHOW"
  );
  const completed = finalized.filter((a) => a.status === "COMPLETED").length;
  const noShows = finalized.filter((a) => a.status === "NO_SHOW").length;

  return {
    finalizedCount: finalized.length,
    completedCount: completed,
    noShowCount: noShows,
    appointmentCompletionRatePct: finalized.length > 0 ? pct(completed, finalized.length) : null,
    noShowRatePct: finalized.length > 0 ? pct(noShows, finalized.length) : null,
  };
}

function computeDisparityTrend(
  cohortRecords: EquityCaseRecord[],
  allRecords: EquityCaseRecord[]
): {
  disparityTrend: DisparityTrendDirection;
  earlierPeriodRatePct: number | null;
  recentPeriodRatePct: number | null;
} {
  if (allRecords.length < 4 || cohortRecords.length < 2) {
    return {
      disparityTrend: "INSUFFICIENT_DATA",
      earlierPeriodRatePct: null,
      recentPeriodRatePct: null,
    };
  }

  const sortedAll = [...allRecords].sort(
    (a, b) => a.referralDate.getTime() - b.referralDate.getTime()
  );
  const midpointIdx = Math.floor(sortedAll.length / 2);
  const midpointMs = sortedAll[midpointIdx].referralDate.getTime();

  const earlierAll = sortedAll.slice(0, midpointIdx);
  const recentAll = sortedAll.slice(midpointIdx);

  const earlierCohort = cohortRecords.filter((r) => r.referralDate.getTime() < midpointMs);
  const recentCohort = cohortRecords.filter((r) => r.referralDate.getTime() >= midpointMs);

  if (earlierCohort.length === 0 || recentCohort.length === 0 || earlierAll.length === 0 || recentAll.length === 0) {
    return {
      disparityTrend: "INSUFFICIENT_DATA",
      earlierPeriodRatePct: null,
      recentPeriodRatePct: null,
    };
  }

  const earlierCohortRate = pct(
    earlierCohort.filter((r) => r.firstCompletedVisitAt !== null).length,
    earlierCohort.length
  );
  const recentCohortRate = pct(
    recentCohort.filter((r) => r.firstCompletedVisitAt !== null).length,
    recentCohort.length
  );

  const earlierOverallRate = pct(
    earlierAll.filter((r) => r.firstCompletedVisitAt !== null).length,
    earlierAll.length
  );
  const recentOverallRate = pct(
    recentAll.filter((r) => r.firstCompletedVisitAt !== null).length,
    recentAll.length
  );

  // Measure absolute gap magnitude change relative to overall population
  const earlierGapMagnitude = Math.max(0, earlierOverallRate - earlierCohortRate);
  const recentGapMagnitude = Math.max(0, recentOverallRate - recentCohortRate);
  const gapDelta = recentGapMagnitude - earlierGapMagnitude;

  let disparityTrend: DisparityTrendDirection = "STABLE";
  if (gapDelta >= 5) {
    disparityTrend = "INCREASING";
  } else if (gapDelta <= -5) {
    disparityTrend = "DECREASING";
  }

  return {
    disparityTrend,
    earlierPeriodRatePct: earlierCohortRate,
    recentPeriodRatePct: recentCohortRate,
  };
}

function computeProviderAccessStats(groupRecords: EquityCaseRecord[]): {
  providerMatchedRatePct: number | null;
  verifiedProviderAccessRatePct: number | null;
  languageConcordantAccessRatePct: number | null;
} {
  const withAccessSignals = groupRecords.filter(
    (r) => r.hasMatchedProvider !== undefined
  );
  if (withAccessSignals.length === 0) {
    return {
      providerMatchedRatePct: null,
      verifiedProviderAccessRatePct: null,
      languageConcordantAccessRatePct: null,
    };
  }
  const matched = withAccessSignals.filter((r) => r.hasMatchedProvider).length;
  const verified = withAccessSignals.filter((r) => r.matchedProviderVerifiedAvailability).length;
  const languageConcordant = withAccessSignals.filter(
    (r) => r.matchedProviderLanguageConcordant
  ).length;
  return {
    providerMatchedRatePct: pct(matched, withAccessSignals.length),
    verifiedProviderAccessRatePct: pct(verified, withAccessSignals.length),
    languageConcordantAccessRatePct: pct(languageConcordant, withAccessSignals.length),
  };
}

export function computeCohortMetrics(
  records: EquityCaseRecord[],
  dimension: CohortDimension
): CohortMetric[] {
  const overallCompleted = records.filter((r) => r.firstCompletedVisitAt !== null).length;
  const overallRate = records.length > 0 ? (overallCompleted / records.length) * 100 : 0;

  const groups = new Map<string, EquityCaseRecord[]>();
  for (const rec of records) {
    const raw = rec[dimension];
    const key = raw && raw.trim() !== "" ? raw : "NOT AVAILABLE";
    const list = groups.get(key) ?? [];
    list.push(rec);
    groups.set(key, list);
  }

  const metrics: CohortMetric[] = [];
  for (const [cohort, groupRecords] of groups.entries()) {
    const completedCases = groupRecords.filter((r) => r.firstCompletedVisitAt !== null).length;
    const rate = groupRecords.length > 0 ? (completedCases / groupRecords.length) * 100 : 0;
    const barrierPrevalence = computeBarrierPrevalence(groupRecords);
    const apptStats = computeAppointmentStats(groupRecords);
    const providerAccess = computeProviderAccessStats(groupRecords);
    const trend = computeDisparityTrend(groupRecords, records);
    const caution = smallSampleCaution(groupRecords.length);

    const apptDays = groupRecords
      .filter((r) => r.firstAppointmentAt !== null && r.firstAppointmentAt !== undefined)
      .map((r) =>
        Math.max(
          0,
          (r.firstAppointmentAt!.getTime() - r.referralDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      );
    const avgTimeToAppointmentDays =
      apptDays.length > 0
        ? Number((apptDays.reduce((a, b) => a + b, 0) / apptDays.length).toFixed(1))
        : null;

    const evaluatedInterventions = groupRecords.flatMap((r) =>
      r.interventions.filter((i) => i.status === "COMPLETED" || i.status === "FAILED")
    );
    const completedInterventions = evaluatedInterventions.filter((i) => i.status === "COMPLETED");
    const interventionSuccessRatePct =
      evaluatedInterventions.length > 0
        ? pct(completedInterventions.length, evaluatedInterventions.length)
        : null;

    metrics.push({
      dimension,
      cohort,
      totalCases: groupRecords.length,
      completedCases,
      completionRatePct: Number(rate.toFixed(1)),
      avgTimeToAppointmentDays,
      avgTimeToCareDays: medianOrMeanDays(groupRecords),
      interventionSuccessRatePct,
      appointmentCompletionRatePct: apptStats.appointmentCompletionRatePct,
      completedAppointments: apptStats.completedCount,
      finalizedAppointments: apptStats.finalizedCount,
      noShowRatePct: apptStats.noShowRatePct,
      noShowAppointments: apptStats.noShowCount,
      providerMatchedRatePct: providerAccess.providerMatchedRatePct,
      verifiedProviderAccessRatePct: providerAccess.verifiedProviderAccessRatePct,
      languageConcordantAccessRatePct: providerAccess.languageConcordantAccessRatePct,
      disparityGapPctPoints: Number((rate - overallRate).toFixed(1)),
      disparityTrend: trend.disparityTrend,
      earlierPeriodRatePct: trend.earlierPeriodRatePct,
      recentPeriodRatePct: trend.recentPeriodRatePct,
      topBarrier: barrierPrevalence[0]?.category ?? "UNKNOWN",
      barrierPrevalence,
      isSmallSample: caution.isSmallSample,
      sampleCaution: caution.sampleCaution,
    });
  }

  return metrics.sort((a, b) => a.completionRatePct - b.completionRatePct);
}

export function computeInterventionEffectiveness(
  records: EquityCaseRecord[]
): InterventionEffectivenessRow[] {
  const stats = new Map<string, { total: number; completed: number }>();

  for (const rec of records) {
    const seenTypes = new Set<string>();
    const isCompleted = rec.firstCompletedVisitAt !== null;
    for (const inv of rec.interventions) {
      if (inv.status === "REJECTED") continue;
      if (seenTypes.has(inv.type)) continue;
      seenTypes.add(inv.type);
      const curr = stats.get(inv.type) ?? { total: 0, completed: 0 };
      curr.total += 1;
      if (isCompleted) curr.completed += 1;
      stats.set(inv.type, curr);
    }
  }

  return Array.from(stats.entries())
    .map(([interventionType, s]) => {
      const caution = smallSampleCaution(s.total);
      return {
        interventionType,
        totalUsed: s.total,
        completedCasesWithIntervention: s.completed,
        completionRatePct: s.total > 0 ? Number(((s.completed / s.total) * 100).toFixed(1)) : 0,
        isSmallSample: caution.isSmallSample,
        sampleCaution: caution.sampleCaution,
      };
    })
    .sort((a, b) => b.completionRatePct - a.completionRatePct);
}

/**
 * Evaluates which interventions yield completion lift within underserved cohorts
 * (cohorts currently trailing overall completion average across language/urbanicity/coverage).
 */
export function computeDisparityReducingInterventions(
  records: EquityCaseRecord[],
  underservedCaseIds?: Set<string>
): DisparityReducingInterventionRow[] {
  let targetRecords: EquityCaseRecord[];

  if (underservedCaseIds) {
    targetRecords = records.filter((r) => underservedCaseIds.has(r.caseId));
  } else {
    const dims: CohortDimension[] = ["preferredLanguage", "urbanicity", "coverageType"];
    const trailingCohortKeys = new Set<string>();
    for (const dim of dims) {
      for (const c of computeCohortMetrics(records, dim)) {
        if (c.disparityGapPctPoints < 0) {
          trailingCohortKeys.add(`${dim}:${c.cohort}`);
        }
      }
    }
    targetRecords = records.filter((r) =>
      dims.some((dim) => trailingCohortKeys.has(`${dim}:${r[dim] || "NOT AVAILABLE"}`))
    );
  }

  if (targetRecords.length === 0) return [];

  const allTypes = Array.from(
    new Set(
      targetRecords.flatMap((r) =>
        r.interventions.filter((i) => i.status !== "REJECTED").map((i) => i.type)
      )
    )
  );

  return allTypes
    .map((interventionType) => {
      const withInv = targetRecords.filter((r) =>
        r.interventions.some((i) => i.type === interventionType && i.status !== "REJECTED")
      );
      const withoutInv = targetRecords.filter(
        (r) => !r.interventions.some((i) => i.type === interventionType && i.status !== "REJECTED")
      );

      const withCompleted = withInv.filter((r) => r.firstCompletedVisitAt !== null).length;
      const withoutCompleted = withoutInv.filter((r) => r.firstCompletedVisitAt !== null).length;

      const rateWith = pct(withCompleted, withInv.length);
      const rateWithout = pct(withoutCompleted, withoutInv.length);
      const caution = smallSampleCaution(withInv.length);

      return {
        interventionType,
        underservedTotalWithIntervention: withInv.length,
        underservedCompletedWithIntervention: withCompleted,
        rateWithInterventionPct: rateWith,
        underservedTotalWithoutIntervention: withoutInv.length,
        underservedCompletedWithoutIntervention: withoutCompleted,
        rateWithoutInterventionPct: rateWithout,
        liftPctPoints: Number((rateWith - rateWithout).toFixed(1)),
        isSmallSample: caution.isSmallSample,
        sampleCaution: caution.sampleCaution,
      };
    })
    .sort((a, b) => b.liftPctPoints - a.liftPctPoints);
}

export function compareCohorts(
  records: EquityCaseRecord[],
  selectorA: { dimension: CohortDimension; value: string },
  selectorB: { dimension: CohortDimension; value: string }
): CohortComparisonResult {
  const metricsA = computeCohortMetrics(records, selectorA.dimension);
  const metricsB = computeCohortMetrics(records, selectorB.dimension);
  const cohortA = metricsA.find((m) => m.cohort === selectorA.value) ?? null;
  const cohortB = metricsB.find((m) => m.cohort === selectorB.value) ?? null;

  const recordsA = records.filter(
    (r) => (r[selectorA.dimension] || "NOT AVAILABLE") === selectorA.value
  );
  const recordsB = records.filter(
    (r) => (r[selectorB.dimension] || "NOT AVAILABLE") === selectorB.value
  );

  const effA = computeInterventionEffectiveness(recordsA);
  const effB = computeInterventionEffectiveness(recordsB);
  const allInvTypes = Array.from(
    new Set([...effA.map((e) => e.interventionType), ...effB.map((e) => e.interventionType)])
  );

  const interventionComparison = allInvTypes.map((interventionType) => {
    const aRow = effA.find((e) => e.interventionType === interventionType);
    const bRow = effB.find((e) => e.interventionType === interventionType);
    return {
      interventionType,
      cohortARatePct: aRow ? aRow.completionRatePct : null,
      cohortASample: aRow ? aRow.totalUsed : 0,
      cohortBRatePct: bRow ? bRow.completionRatePct : null,
      cohortBSample: bRow ? bRow.totalUsed : 0,
    };
  });

  return {
    cohortA,
    cohortB,
    deltas: {
      completionRateDiffPctPts:
        cohortA && cohortB
          ? Number((cohortA.completionRatePct - cohortB.completionRatePct).toFixed(1))
          : null,
      avgTimeToAppointmentDiffDays:
        cohortA?.avgTimeToAppointmentDays !== null &&
        cohortA?.avgTimeToAppointmentDays !== undefined &&
        cohortB?.avgTimeToAppointmentDays !== null &&
        cohortB?.avgTimeToAppointmentDays !== undefined
          ? Number((cohortA.avgTimeToAppointmentDays - cohortB.avgTimeToAppointmentDays).toFixed(1))
          : null,
      avgTimeToCareDiffDays:
        cohortA?.avgTimeToCareDays !== null &&
        cohortA?.avgTimeToCareDays !== undefined &&
        cohortB?.avgTimeToCareDays !== null &&
        cohortB?.avgTimeToCareDays !== undefined
          ? Number((cohortA.avgTimeToCareDays - cohortB.avgTimeToCareDays).toFixed(1))
          : null,
      appointmentCompletionDiffPctPts:
        cohortA?.appointmentCompletionRatePct !== null &&
        cohortA?.appointmentCompletionRatePct !== undefined &&
        cohortB?.appointmentCompletionRatePct !== null &&
        cohortB?.appointmentCompletionRatePct !== undefined
          ? Number(
              (cohortA.appointmentCompletionRatePct - cohortB.appointmentCompletionRatePct).toFixed(1)
            )
          : null,
      noShowRateDiffPctPts:
        cohortA?.noShowRatePct !== null &&
        cohortA?.noShowRatePct !== undefined &&
        cohortB?.noShowRatePct !== null &&
        cohortB?.noShowRatePct !== undefined
          ? Number((cohortA.noShowRatePct - cohortB.noShowRatePct).toFixed(1))
          : null,
    },
    interventionComparison,
  };
}

export interface DisparityMonitorMetric {
  status: "OK" | "ALERT" | "INSUFFICIENT_DATA";
  maxGap: number | null;
  threshold: number;
  unit: "pct_pts" | "days";
  lowestCohort: string | null;
  highestCohort: string | null;
}

export interface DisparityMonitoringSummary {
  disparityInAccess: DisparityMonitorMetric;
  disparityInCompletion: DisparityMonitorMetric;
  disparityInTimeToCare: DisparityMonitorMetric;
  disparityInInterventionSuccess: DisparityMonitorMetric;
}

/**
 * Monitor disparities across reliable cohorts (n >= MIN_RELIABLE_COHORT_SIZE)
 * for access, completion, time-to-care, and intervention success.
 */
export function computeDisparityMonitoring(allCohorts: CohortMetric[]): DisparityMonitoringSummary {
  const reliable = allCohorts.filter((c) => !c.isSmallSample);

  function evaluateRange(
    rows: Array<{ label: string; value: number }>,
    threshold: number,
    unit: "pct_pts" | "days"
  ): DisparityMonitorMetric {
    if (rows.length < 2) {
      return {
        status: "INSUFFICIENT_DATA",
        maxGap: null,
        threshold,
        unit,
        lowestCohort: null,
        highestCohort: null,
      };
    }
    const sorted = [...rows].sort((a, b) => a.value - b.value);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const maxGap = Number((max.value - min.value).toFixed(1));
    return {
      status: maxGap > threshold ? "ALERT" : "OK",
      maxGap,
      threshold,
      unit,
      lowestCohort: min.label,
      highestCohort: max.label,
    };
  }

  return {
    disparityInAccess: evaluateRange(
      reliable
        .filter((c) => c.providerMatchedRatePct !== null)
        .map((c) => ({ label: `${c.dimension}:${c.cohort}`, value: c.providerMatchedRatePct! })),
      15,
      "pct_pts"
    ),
    disparityInCompletion: evaluateRange(
      reliable.map((c) => ({ label: `${c.dimension}:${c.cohort}`, value: c.completionRatePct })),
      15,
      "pct_pts"
    ),
    disparityInTimeToCare: evaluateRange(
      reliable
        .filter((c) => c.avgTimeToCareDays !== null)
        .map((c) => ({ label: `${c.dimension}:${c.cohort}`, value: c.avgTimeToCareDays! })),
      3,
      "days"
    ),
    disparityInInterventionSuccess: evaluateRange(
      reliable
        .filter((c) => c.interventionSuccessRatePct !== null)
        .map((c) => ({
          label: `${c.dimension}:${c.cohort}`,
          value: c.interventionSuccessRatePct!,
        })),
      15,
      "pct_pts"
    ),
  };
}
