import { StudyArm } from "./pilot-protocol";

export interface PilotCaseRecord {
  caseId: string;
  memberId: string;
  studyArm: StudyArm;
  referralDate: Date;
  scheduledStartAt: Date | null;
  firstCompletedVisitAt: Date | null;
  appointmentStatus: "COMPLETED" | "CONFIRMED" | "SCHEDULED" | "NO_SHOW" | "CANCELLED" | "NONE";
  coverageType: "MEDICAID" | "COMMERCIAL" | "MEDICARE_DUAL" | "UNINSURED";
  preferredLanguage: string;
  urbanicity: "URBAN" | "SUBURBAN" | "RURAL";
  raceEthnicity: string;
  primaryBarrier: string | null;
  outreachSent: boolean;
  memberResponded: boolean;
  outreachTouchCount: number;
  computeCostUSD: number;
  careManagerLaborMinutes: number;
  voucherCostUSD: number;
  providerInNetwork: boolean;
  verifiedByDualSource: boolean;
}

export interface ArmMetrics {
  totalReferrals: number;
  completedVisitsCount: number;
  completionRatePct: number;
  medianTimeToAppointmentDays: number | null;
  medianTimeToCompletionDays: number | null;
  scheduledCount: number;
  noShowCount: number;
  noShowRatePct: number;
  outreachSentCount: number;
  memberRespondedCount: number;
  engagementRatePct: number;
  avgTouchpointsToResponse: number;
  totalCostUSD: number;
  costPerCompletedVisitUSD: number;
  inNetworkRetentionPct: number;
  providerCapacityUtilizationPct: number;
}

export interface PrimaryEndpointComparative {
  metricName: string;
  interventionRatePct: number;
  controlRatePct: number;
  absoluteLiftPctPoints: number;
  relativeRiskRatio: number;
  oddsRatio: number;
  zStatistic: number;
  pValue: number;
  isStatisticallySignificant: boolean;
  confidenceInterval95: {
    lowerPctPoints: number;
    upperPctPoints: number;
  };
  medianDaysToCompletion: {
    intervention: number | null;
    control: number | null;
    daysSaved: number | null;
  };
}

export interface SecondaryMetricsComparative {
  timeToAppointmentDays: {
    intervention: number | null;
    control: number | null;
    daysSaved: number | null;
  };
  noShowRate: {
    interventionPct: number;
    controlPct: number;
    relativeReductionPct: number;
  };
  memberEngagement: {
    interventionPct: number;
    controlPct: number;
    liftPctPoints: number;
    avgTouchpointsIntervention: number;
    avgTouchpointsControl: number;
  };
  economicsAndCost: {
    interventionTotalCostUSD: number;
    controlTotalCostUSD: number;
    costPerCompletedVisitIntervention: number;
    costPerCompletedVisitControl: number;
    estimatedGrossSavingsUSD: number; // e.g. based on $2,400 avoided BH acute escalation per timely completed visit
    netRoiRatio: number;
  };
  providerUtilization: {
    interventionFillRatePct: number;
    controlFillRatePct: number;
    inNetworkRetentionInterventionPct: number;
    inNetworkRetentionControlPct: number;
  };
}

export interface EquityDisparityComparison {
  dimension: "Coverage (Medicaid vs Commercial)" | "Language (Spanish vs English)" | "Urbanicity (Rural vs Urban)";
  baselineControlGapPctPoints: number;
  interventionGapPctPoints: number;
  disparityReductionPctPoints: number;
  disparityReductionPercent: number;
  advantagedCohort: {
    name: string;
    controlRatePct: number;
    interventionRatePct: number;
  };
  disadvantagedCohort: {
    name: string;
    controlRatePct: number;
    interventionRatePct: number;
  };
}

export interface PilotMeasurementSummary {
  metadata: {
    totalEligiblePopulation: number;
    interventionArmSize: number;
    controlArmSize: number;
    studyDurationMonths: number;
    evaluationTimestamp: string;
  };
  arms: {
    intervention: ArmMetrics;
    control: ArmMetrics;
  };
  primaryEndpoint: PrimaryEndpointComparative;
  secondaryMetrics: SecondaryMetricsComparative;
  equityDisparities: EquityDisparityComparison[];
}

/**
 * Calculates median of an array of numbers, or null if empty.
 */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1));
}

/**
 * Calculates comprehensive metrics for a specific study arm.
 */
export function calculateArmMetrics(records: PilotCaseRecord[]): ArmMetrics {
  const totalReferrals = records.length;
  if (totalReferrals === 0) {
    return {
      totalReferrals: 0,
      completedVisitsCount: 0,
      completionRatePct: 0,
      medianTimeToAppointmentDays: null,
      medianTimeToCompletionDays: null,
      scheduledCount: 0,
      noShowCount: 0,
      noShowRatePct: 0,
      outreachSentCount: 0,
      memberRespondedCount: 0,
      engagementRatePct: 0,
      avgTouchpointsToResponse: 0,
      totalCostUSD: 0,
      costPerCompletedVisitUSD: 0,
      inNetworkRetentionPct: 0,
      providerCapacityUtilizationPct: 0,
    };
  }

  const completed = records.filter((r) => r.firstCompletedVisitAt !== null);
  const completedVisitsCount = completed.length;
  const completionRatePct = Number(((completedVisitsCount / totalReferrals) * 100).toFixed(1));

  // Time to appointment & completion
  const apptDays = records
    .filter((r) => r.scheduledStartAt !== null)
    .map((r) => Math.max(0, (r.scheduledStartAt!.getTime() - r.referralDate.getTime()) / 86400000));
  const compDays = completed.map(
    (r) => Math.max(0, (r.firstCompletedVisitAt!.getTime() - r.referralDate.getTime()) / 86400000)
  );

  const medianTimeToAppointmentDays = median(apptDays);
  const medianTimeToCompletionDays = median(compDays);

  // Scheduled & No-shows
  const scheduledRecords = records.filter(
    (r) => r.appointmentStatus !== "NONE" && r.scheduledStartAt !== null
  );
  const scheduledCount = scheduledRecords.length;
  const noShowCount = records.filter((r) => r.appointmentStatus === "NO_SHOW").length;
  const noShowRatePct = scheduledCount > 0 ? Number(((noShowCount / scheduledCount) * 100).toFixed(1)) : 0;

  // Engagement
  const outreachSentCount = records.filter((r) => r.outreachSent).length;
  const memberRespondedCount = records.filter((r) => r.memberResponded).length;
  const engagementRatePct =
    outreachSentCount > 0 ? Number(((memberRespondedCount / outreachSentCount) * 100).toFixed(1)) : 0;

  const responders = records.filter((r) => r.memberResponded);
  const totalTouches = responders.reduce((acc, r) => acc + r.outreachTouchCount, 0);
  const avgTouchpointsToResponse =
    responders.length > 0 ? Number((totalTouches / responders.length).toFixed(1)) : 0;

  // Costs: labor at $45/hr ($0.75/min), compute, vouchers
  const totalCostUSD = records.reduce((acc, r) => {
    const labor = r.careManagerLaborMinutes * 0.75;
    return acc + r.computeCostUSD + labor + r.voucherCostUSD;
  }, 0);
  const costPerCompletedVisitUSD =
    completedVisitsCount > 0 ? Number((totalCostUSD / completedVisitsCount).toFixed(2)) : 0;

  // Provider metrics
  const inNetworkCompleted = completed.filter((r) => r.providerInNetwork).length;
  const inNetworkRetentionPct =
    completedVisitsCount > 0 ? Number(((inNetworkCompleted / completedVisitsCount) * 100).toFixed(1)) : 0;

  const attendedOrHeld = records.filter(
    (r) => r.appointmentStatus === "COMPLETED" || r.appointmentStatus === "CONFIRMED"
  ).length;
  const providerCapacityUtilizationPct =
    scheduledCount > 0 ? Number(((attendedOrHeld / scheduledCount) * 100).toFixed(1)) : 0;

  return {
    totalReferrals,
    completedVisitsCount,
    completionRatePct,
    medianTimeToAppointmentDays,
    medianTimeToCompletionDays,
    scheduledCount,
    noShowCount,
    noShowRatePct,
    outreachSentCount,
    memberRespondedCount,
    engagementRatePct,
    avgTouchpointsToResponse,
    totalCostUSD: Number(totalCostUSD.toFixed(2)),
    costPerCompletedVisitUSD,
    inNetworkRetentionPct,
    providerCapacityUtilizationPct,
  };
}

/**
 * Executes statistical hypothesis testing between Intervention and Control arms.
 */
export function evaluatePrimaryEndpoint(
  intMetrics: ArmMetrics,
  ctrlMetrics: ArmMetrics
): PrimaryEndpointComparative {
  const p1 = intMetrics.completionRatePct / 100;
  const p2 = ctrlMetrics.completionRatePct / 100;
  const n1 = intMetrics.totalReferrals;
  const n2 = ctrlMetrics.totalReferrals;

  const absoluteLiftPctPoints = Number(((p1 - p2) * 100).toFixed(1));
  const relativeRiskRatio = p2 > 0 ? Number((p1 / p2).toFixed(2)) : 0;

  const odds1 = p1 / Math.max(0.0001, 1 - p1);
  const odds2 = p2 / Math.max(0.0001, 1 - p2);
  const oddsRatio = odds2 > 0 ? Number((odds1 / odds2).toFixed(2)) : 0;

  // Pooled proportion for z-statistic
  const pooledP = (intMetrics.completedVisitsCount + ctrlMetrics.completedVisitsCount) / (n1 + n2);
  const sePooled = Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2));
  const zStatistic = sePooled > 0 ? Number(((p1 - p2) / sePooled).toFixed(3)) : 0;

  // Two-sided p-value approximation
  const pValue = zStatistic > 0 ? Number((2 * (1 - normalCdf(Math.abs(zStatistic)))).toFixed(6)) : 1.0;

  // 95% Confidence Interval for difference
  const seDiff = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
  const marginOfErrorPct = 1.96 * seDiff * 100;
  const lowerPctPoints = Number((absoluteLiftPctPoints - marginOfErrorPct).toFixed(1));
  const upperPctPoints = Number((absoluteLiftPctPoints + marginOfErrorPct).toFixed(1));

  const daysSaved =
    ctrlMetrics.medianTimeToCompletionDays !== null && intMetrics.medianTimeToCompletionDays !== null
      ? Number((ctrlMetrics.medianTimeToCompletionDays - intMetrics.medianTimeToCompletionDays).toFixed(1))
      : null;

  return {
    metricName: "Referral to First Completed Behavioral-Health Visit",
    interventionRatePct: intMetrics.completionRatePct,
    controlRatePct: ctrlMetrics.completionRatePct,
    absoluteLiftPctPoints,
    relativeRiskRatio,
    oddsRatio,
    zStatistic,
    pValue,
    isStatisticallySignificant: pValue < 0.05,
    confidenceInterval95: {
      lowerPctPoints,
      upperPctPoints,
    },
    medianDaysToCompletion: {
      intervention: intMetrics.medianTimeToCompletionDays,
      control: ctrlMetrics.medianTimeToCompletionDays,
      daysSaved,
    },
  };
}

/**
 * Standard normal cumulative distribution function approximation.
 */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - prob : prob;
}

/**
 * Computes comparative secondary metrics.
 */
export function evaluateSecondaryMetrics(
  intMetrics: ArmMetrics,
  ctrlMetrics: ArmMetrics
): SecondaryMetricsComparative {
  const apptDaysSaved =
    ctrlMetrics.medianTimeToAppointmentDays !== null && intMetrics.medianTimeToAppointmentDays !== null
      ? Number((ctrlMetrics.medianTimeToAppointmentDays - intMetrics.medianTimeToAppointmentDays).toFixed(1))
      : null;

  const relativeNoShowReduction =
    ctrlMetrics.noShowRatePct > 0
      ? Number((((ctrlMetrics.noShowRatePct - intMetrics.noShowRatePct) / ctrlMetrics.noShowRatePct) * 100).toFixed(1))
      : 0;

  const engagementLift = Number((intMetrics.engagementRatePct - ctrlMetrics.engagementRatePct).toFixed(1));

  // Economic analysis: Assume $2,400 in avoided emergency/acute behavioral health utilization per verified completed referral
  const grossSavingsPerVisit = 2400;
  const additionalCompletedVisits = Math.max(0, intMetrics.completedVisitsCount - ctrlMetrics.completedVisitsCount);
  const estimatedGrossSavingsUSD = Number((additionalCompletedVisits * grossSavingsPerVisit).toFixed(2));
  const netRoiRatio =
    intMetrics.totalCostUSD > 0
      ? Number(((estimatedGrossSavingsUSD - intMetrics.totalCostUSD) / intMetrics.totalCostUSD).toFixed(2))
      : 0;

  return {
    timeToAppointmentDays: {
      intervention: intMetrics.medianTimeToAppointmentDays,
      control: ctrlMetrics.medianTimeToAppointmentDays,
      daysSaved: apptDaysSaved,
    },
    noShowRate: {
      interventionPct: intMetrics.noShowRatePct,
      controlPct: ctrlMetrics.noShowRatePct,
      relativeReductionPct: relativeNoShowReduction,
    },
    memberEngagement: {
      interventionPct: intMetrics.engagementRatePct,
      controlPct: ctrlMetrics.engagementRatePct,
      liftPctPoints: engagementLift,
      avgTouchpointsIntervention: intMetrics.avgTouchpointsToResponse,
      avgTouchpointsControl: ctrlMetrics.avgTouchpointsToResponse,
    },
    economicsAndCost: {
      interventionTotalCostUSD: intMetrics.totalCostUSD,
      controlTotalCostUSD: ctrlMetrics.totalCostUSD,
      costPerCompletedVisitIntervention: intMetrics.costPerCompletedVisitUSD,
      costPerCompletedVisitControl: ctrlMetrics.costPerCompletedVisitUSD,
      estimatedGrossSavingsUSD,
      netRoiRatio,
    },
    providerUtilization: {
      interventionFillRatePct: intMetrics.providerCapacityUtilizationPct,
      controlFillRatePct: ctrlMetrics.providerCapacityUtilizationPct,
      inNetworkRetentionInterventionPct: intMetrics.inNetworkRetentionPct,
      inNetworkRetentionControlPct: ctrlMetrics.inNetworkRetentionPct,
    },
  };
}

/**
 * Computes health equity disparity reductions between arms.
 */
export function evaluateEquityDisparities(records: PilotCaseRecord[]): EquityDisparityComparison[] {
  function getRate(subset: PilotCaseRecord[]): number {
    if (subset.length === 0) return 0;
    const completed = subset.filter((r) => r.firstCompletedVisitAt !== null).length;
    return Number(((completed / subset.length) * 100).toFixed(1));
  }

  const int = records.filter((r) => r.studyArm === "INTERVENTION");
  const ctrl = records.filter((r) => r.studyArm === "USUAL_CARE_CONTROL");

  // 1. Coverage: Medicaid vs Commercial
  const ctrlMedicaid = getRate(ctrl.filter((r) => r.coverageType === "MEDICAID"));
  const ctrlCommercial = getRate(ctrl.filter((r) => r.coverageType === "COMMERCIAL"));
  const intMedicaid = getRate(int.filter((r) => r.coverageType === "MEDICAID"));
  const intCommercial = getRate(int.filter((r) => r.coverageType === "COMMERCIAL"));

  const baselineCoverageGap = Number((ctrlCommercial - ctrlMedicaid).toFixed(1));
  const intCoverageGap = Number((intCommercial - intMedicaid).toFixed(1));
  const coverageReductionPoints = Number((baselineCoverageGap - intCoverageGap).toFixed(1));
  const coverageReductionPct =
    baselineCoverageGap > 0 ? Number(((coverageReductionPoints / baselineCoverageGap) * 100).toFixed(1)) : 0;

  // 2. Language: Spanish vs English
  const ctrlSpanish = getRate(ctrl.filter((r) => r.preferredLanguage.toLowerCase() === "spanish"));
  const ctrlEnglish = getRate(ctrl.filter((r) => r.preferredLanguage.toLowerCase() === "english"));
  const intSpanish = getRate(int.filter((r) => r.preferredLanguage.toLowerCase() === "spanish"));
  const intEnglish = getRate(int.filter((r) => r.preferredLanguage.toLowerCase() === "english"));

  const baselineLanguageGap = Number((ctrlEnglish - ctrlSpanish).toFixed(1));
  const intLanguageGap = Number((intEnglish - intSpanish).toFixed(1));
  const languageReductionPoints = Number((baselineLanguageGap - intLanguageGap).toFixed(1));
  const languageReductionPct =
    baselineLanguageGap > 0 ? Number(((languageReductionPoints / baselineLanguageGap) * 100).toFixed(1)) : 0;

  // 3. Urbanicity: Rural vs Urban
  const ctrlRural = getRate(ctrl.filter((r) => r.urbanicity === "RURAL"));
  const ctrlUrban = getRate(ctrl.filter((r) => r.urbanicity === "URBAN"));
  const intRural = getRate(int.filter((r) => r.urbanicity === "RURAL"));
  const intUrban = getRate(int.filter((r) => r.urbanicity === "URBAN"));

  const baselineUrbanicityGap = Number((ctrlUrban - ctrlRural).toFixed(1));
  const intUrbanicityGap = Number((intUrban - intRural).toFixed(1));
  const urbanicityReductionPoints = Number((baselineUrbanicityGap - intUrbanicityGap).toFixed(1));
  const urbanicityReductionPct =
    baselineUrbanicityGap > 0 ? Number(((urbanicityReductionPoints / baselineUrbanicityGap) * 100).toFixed(1)) : 0;

  return [
    {
      dimension: "Coverage (Medicaid vs Commercial)",
      baselineControlGapPctPoints: baselineCoverageGap,
      interventionGapPctPoints: intCoverageGap,
      disparityReductionPctPoints: coverageReductionPoints,
      disparityReductionPercent: coverageReductionPct,
      advantagedCohort: {
        name: "Commercial Insurance",
        controlRatePct: ctrlCommercial,
        interventionRatePct: intCommercial,
      },
      disadvantagedCohort: {
        name: "Medicaid Managed Care",
        controlRatePct: ctrlMedicaid,
        interventionRatePct: intMedicaid,
      },
    },
    {
      dimension: "Language (Spanish vs English)",
      baselineControlGapPctPoints: baselineLanguageGap,
      interventionGapPctPoints: intLanguageGap,
      disparityReductionPctPoints: languageReductionPoints,
      disparityReductionPercent: languageReductionPct,
      advantagedCohort: {
        name: "English Primary",
        controlRatePct: ctrlEnglish,
        interventionRatePct: intEnglish,
      },
      disadvantagedCohort: {
        name: "Spanish Primary",
        controlRatePct: ctrlSpanish,
        interventionRatePct: intSpanish,
      },
    },
    {
      dimension: "Urbanicity (Rural vs Urban)",
      baselineControlGapPctPoints: baselineUrbanicityGap,
      interventionGapPctPoints: intUrbanicityGap,
      disparityReductionPctPoints: urbanicityReductionPoints,
      disparityReductionPercent: urbanicityReductionPct,
      advantagedCohort: {
        name: "Urban Metropolitan",
        controlRatePct: ctrlUrban,
        interventionRatePct: intUrban,
      },
      disadvantagedCohort: {
        name: "Rural District",
        controlRatePct: ctrlRural,
        interventionRatePct: intRural,
      },
    },
  ];
}

/**
 * Main pilot measurement aggregator.
 */
export function generatePilotMeasurementReport(
  records: PilotCaseRecord[],
  durationMonths = 6
): PilotMeasurementSummary {
  const intRecords = records.filter((r) => r.studyArm === "INTERVENTION");
  const ctrlRecords = records.filter((r) => r.studyArm === "USUAL_CARE_CONTROL");

  const intMetrics = calculateArmMetrics(intRecords);
  const ctrlMetrics = calculateArmMetrics(ctrlRecords);

  const primaryEndpoint = evaluatePrimaryEndpoint(intMetrics, ctrlMetrics);
  const secondaryMetrics = evaluateSecondaryMetrics(intMetrics, ctrlMetrics);
  const equityDisparities = evaluateEquityDisparities(records);

  return {
    metadata: {
      totalEligiblePopulation: records.length,
      interventionArmSize: intRecords.length,
      controlArmSize: ctrlRecords.length,
      studyDurationMonths: durationMonths,
      evaluationTimestamp: new Date().toISOString(),
    },
    arms: {
      intervention: intMetrics,
      control: ctrlMetrics,
    },
    primaryEndpoint,
    secondaryMetrics,
    equityDisparities,
  };
}
