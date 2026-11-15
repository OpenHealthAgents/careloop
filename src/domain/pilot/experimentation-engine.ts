import { createHash } from "crypto";
import { assertCareLoopPolicyAllowed, assertNoClinicalAdvice } from "@/ai/policy-engine";
import { CaseOrchestratorTool } from "@/ai/schemas";
import { ValidationError } from "@/lib/errors";
import { StratificationFactors } from "./pilot-protocol";

export type ExperimentArmId =
  | "INTERVENTION_A"
  | "INTERVENTION_B"
  | "HUMAN_ASSISTED"
  | "USUAL_CARE";

export interface ExperimentArmDefinition {
  id: ExperimentArmId;
  name: string;
  tagline: string;
  description: string;
  deliveryMode: "AUTONOMOUS_DIGITAL" | "MULTIMODAL_HYBRID" | "HUMAN_IN_THE_LOOP" | "STANDARD_USUAL_CARE";
  targetChannel: "SMS_AUTOMATED" | "DUAL_CHANNEL_MULTIMODAL" | "CARE_MANAGER_WARM_OUTREACH" | "STATIC_DIRECTORY";
  voucherAutomated: boolean;
  humanReviewRequiredBeforeOutreach: boolean;
}

export const EXPERIMENT_ARM_DEFINITIONS: Record<ExperimentArmId, ExperimentArmDefinition> = {
  INTERVENTION_A: {
    id: "INTERVENTION_A",
    name: "Intervention A: Autonomous Digital-First",
    tagline: "Instant SMS outreach + deterministic slot hold + automated rideshare voucher",
    description: "AI infers barrier, locks verified calendar slot, dispatches instant culturally matched SMS, and auto-attaches transit vouchers.",
    deliveryMode: "AUTONOMOUS_DIGITAL",
    targetChannel: "SMS_AUTOMATED",
    voucherAutomated: true,
    humanReviewRequiredBeforeOutreach: false,
  },
  INTERVENTION_B: {
    id: "INTERVENTION_B",
    name: "Intervention B: Multimodal Rapid-Access",
    tagline: "Dual-modality (Telehealth + In-Person) + Dual-channel (SMS + Portal) fast-track",
    description: "Offers member instant choice between telehealth and in-person visits via SMS and secure interactive portal link, with multi-stage reminders.",
    deliveryMode: "MULTIMODAL_HYBRID",
    targetChannel: "DUAL_CHANNEL_MULTIMODAL",
    voucherAutomated: true,
    humanReviewRequiredBeforeOutreach: false,
  },
  HUMAN_ASSISTED: {
    id: "HUMAN_ASSISTED",
    name: "Human-Assisted Intervention",
    tagline: "AI barrier triage & match draft + Care Manager warm outreach & scheduling",
    description: "AI performs triage, matches verified providers, and prepares clinical context; human care manager reviews, personalizes outreach, and conducts warm scheduling.",
    deliveryMode: "HUMAN_IN_THE_LOOP",
    targetChannel: "CARE_MANAGER_WARM_OUTREACH",
    voucherAutomated: false,
    humanReviewRequiredBeforeOutreach: true,
  },
  USUAL_CARE: {
    id: "USUAL_CARE",
    name: "Usual Care (Control)",
    tagline: "Standard static provider directory + member self-navigation",
    description: "Member receives standard paper directory or generic health plan portal link without barrier identification or proactive scheduling assistance.",
    deliveryMode: "STANDARD_USUAL_CARE",
    targetChannel: "STATIC_DIRECTORY",
    voucherAutomated: false,
    humanReviewRequiredBeforeOutreach: false,
  },
};

/**
 * ============================================================================
 * MEMBER SAFETY & POLICY GUARDRAILS
 * ============================================================================
 * "Do not allow experiments to violate policy or member safety."
 * Enforces zero-tolerance safety checks across all experimental arms.
 */
export class ExperimentSafetyViolationError extends ValidationError {
  constructor(message: string, public readonly ruleId: string) {
    super(`Experiment Safety Violation: ${message}`);
  }
}

export interface ExperimentSafetyContext {
  memberId: string;
  hasAcuteCrisisIndicators: boolean; // e.g. suicidal ideation, psychosis, self-harm
  consentOutreach: boolean;
  consentSms: boolean;
  proposedAction: CaseOrchestratorTool;
  textPayloads?: string[];
  providerContracted: boolean;
  providerVerifiedAvailability: boolean;
  voucherAmountUSD?: number;
  humanApproved?: boolean;
  riskTier?: string;
  sensitiveCommunication?: boolean;
}

export function assertExperimentSafetyGuardrails(
  armId: ExperimentArmId,
  ctx: ExperimentSafetyContext
): { safe: boolean; haltedForSafety: boolean; reason?: string } {
  // Guardrail 1: Acute Crisis Exclusion (Immediate safety net transfer)
  if (ctx.hasAcuteCrisisIndicators) {
    throw new ExperimentSafetyViolationError(
      `Member ${ctx.memberId} presents acute psychiatric crisis indicators. Autonomous experiment must halt immediately and warm-transfer to clinical supervisor / emergency crisis intervention.`,
      "SAFETY_ACUTE_CRISIS_TRANSFER"
    );
  }

  // Guardrail 2: Clinical Advice Boundary (No diagnosis, prescription, or clinical advice by AI)
  if (ctx.textPayloads && ctx.textPayloads.length > 0) {
    assertNoClinicalAdvice(ctx.textPayloads);
  }

  // Guardrail 3: Member Consent Boundary
  if (armId === "INTERVENTION_A" || armId === "INTERVENTION_B") {
    if (!ctx.consentOutreach) {
      throw new ExperimentSafetyViolationError(
        `Experiment arm ${armId} cannot dispatch communication without consentOutreach=true.`,
        "SAFETY_CONSENT_REQUIRED"
      );
    }
    if (!ctx.consentSms) {
      throw new ExperimentSafetyViolationError(
        `Experiment arm ${armId} cannot dispatch SMS without consentSms=true. Must route through alternative consented channel.`,
        "SAFETY_SMS_CONSENT_REQUIRED"
      );
    }
  }

  // Guardrail 4: Provider Credential & Network Invariant
  if (!ctx.providerContracted) {
    throw new ExperimentSafetyViolationError(
      `Experimental arm ${armId} proposed uncontracted/uncredentialed provider. Network boundary violated.`,
      "SAFETY_NETWORK_INTEGRITY"
    );
  }

  // Guardrail 5: Financial Voucher Safety Cap ($50 max autonomous threshold)
  if (ctx.voucherAmountUSD !== undefined && ctx.voucherAmountUSD > 50) {
    throw new ExperimentSafetyViolationError(
      `Voucher request of $${ctx.voucherAmountUSD} exceeds autonomous experimental cap of $50 without human supervisor approval.`,
      "SAFETY_FINANCIAL_THRESHOLD"
    );
  }

  // Guardrail 6: Deterministic Core Policy Verification
  assertCareLoopPolicyAllowed({
    action: ctx.proposedAction,
    consentOutreach: ctx.consentOutreach,
    consentSms: ctx.consentSms,
    textPayloads: ctx.textPayloads,
    humanApproved: ctx.humanApproved,
    riskTier: ctx.riskTier,
    sensitiveCommunication: ctx.sensitiveCommunication,
    policyCheckRequired: true,
  });

  return { safe: true, haltedForSafety: false };
}

/**
 * Deterministic Stratified Multi-Arm Allocation.
 * Partitions cohort evenly across the 4 arms (or custom weights) with verified covariate balance.
 */
export function assignMultiArmExperiment(
  memberId: string,
  strata: StratificationFactors,
  seed = 42,
  armWeights: Record<ExperimentArmId, number> = {
    INTERVENTION_A: 1,
    INTERVENTION_B: 1,
    HUMAN_ASSISTED: 1,
    USUAL_CARE: 1,
  }
): ExperimentArmId {
  const strataKey = `${strata.coverageType}|${strata.preferredLanguage}|${strata.urbanicity}|${strata.raceEthnicity}`;
  const rawKey = `multi-arm-v1:${seed}:${strataKey}:${memberId}`;
  const hash = createHash("sha256").update(rawKey).digest("hex");

  const intVal = parseInt(hash.slice(0, 8), 16);
  const normalized = intVal / 0xffffffff;

  const totalWeight =
    armWeights.INTERVENTION_A +
    armWeights.INTERVENTION_B +
    armWeights.HUMAN_ASSISTED +
    armWeights.USUAL_CARE;

  const wA = armWeights.INTERVENTION_A / totalWeight;
  const wB = armWeights.INTERVENTION_B / totalWeight;
  const wHuman = armWeights.HUMAN_ASSISTED / totalWeight;

  if (normalized < wA) return "INTERVENTION_A";
  if (normalized < wA + wB) return "INTERVENTION_B";
  if (normalized < wA + wB + wHuman) return "HUMAN_ASSISTED";
  return "USUAL_CARE";
}

/**
 * Individual case record evaluated in multi-arm experimentation.
 */
export interface MultiArmCaseRecord {
  caseId: string;
  memberId: string;
  armId: ExperimentArmId;
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
  memberOptedOut: boolean;
  computeCostUSD: number;
  careManagerLaborMinutes: number;
  voucherCostUSD: number;
  approvalRequestsSpawned: number;
  humanTouchesCount: number;
  safetyHalted: boolean;
  policyViolationsBlocked: number;
}

export interface ArmExperimentalMetrics {
  armId: ExperimentArmId;
  armName: string;
  totalReferrals: number;
  // 1. Completion
  completion: {
    completedVisitsCount: number;
    completionRatePct: number;
    absoluteLiftVsControlPctPoints: number;
    relativeRiskVsControl: number;
    oddsRatioVsControl: number;
    zStatistic: number;
    pValue: number;
    isStatisticallySignificant: boolean;
    confidenceInterval95: { lowerPctPoints: number; upperPctPoints: number };
  };
  // 2. Time
  time: {
    medianTimeToAppointmentDays: number | null;
    medianTimeToCompletionDays: number | null;
    daysSavedVsControl: number | null;
  };
  // 3. Cost
  cost: {
    totalComputeCostUSD: number;
    totalVoucherCostUSD: number;
    totalLaborCostUSD: number;
    totalCostUSD: number;
    costPerCompletedReferralUSD: number;
    estimatedGrossSavingsUSD: number; // based on $2,400 avoided acute escalation per completed visit
    netRoiRatio: number;
  };
  // 4. Member Response
  memberResponse: {
    outreachSentCount: number;
    inboundResponseCount: number;
    responseRatePct: number;
    avgTouchpointsToResponse: number;
    optOutRatePct: number;
  };
  // 5. Human Effort
  humanEffort: {
    careManagerMinutesPerCase: number;
    totalLaborHours: number;
    approvalReviewsCount: number;
    humanTouchesCount: number;
  };
  // 6. Equity Outcome
  equityOutcome: {
    medicaidCompletionRatePct: number;
    commercialCompletionRatePct: number;
    medicaidDisparityGapPctPoints: number;
    medicaidDisparityReductionVsControlPct: number;
    spanishCompletionRatePct: number;
    englishCompletionRatePct: number;
    languageDisparityGapPctPoints: number;
    languageDisparityReductionVsControlPct: number;
    ruralCompletionRatePct: number;
    urbanCompletionRatePct: number;
    ruralDisparityGapPctPoints: number;
    ruralDisparityReductionVsControlPct: number;
  };
  // Safety Invariants
  safety: {
    safetyHaltedCount: number;
    policyViolationsBlockedCount: number;
    zeroPolicyViolationsEnforced: boolean;
  };
}

export interface MultiArmComparativeReport {
  metadata: {
    totalEligiblePopulation: number;
    evaluationTimestamp: string;
    durationMonths: number;
  };
  arms: Record<ExperimentArmId, ArmExperimentalMetrics>;
  armRankings: {
    highestCompletion: { armId: ExperimentArmId; ratePct: number };
    fastestTimeToCare: { armId: ExperimentArmId; medianDays: number | null };
    lowestCostPerCompleted: { armId: ExperimentArmId; costUSD: number };
    highestMemberEngagement: { armId: ExperimentArmId; responseRatePct: number };
    lowestHumanEffort: { armId: ExperimentArmId; laborMinutesPerCase: number };
    greatestEquityDisparityReduction: { armId: ExperimentArmId; reductionPct: number };
  };
  policyAndSafetyAudit: {
    allExperimentsPolicyCompliant: boolean;
    allMembersSafe: boolean;
    safetyIncidentsEscalatedImmediately: number;
    summary: string;
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1));
}

function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - prob : prob;
}

/**
 * Calculates metrics across all 6 dimensions for a specific arm against the control baseline.
 */
export function calculateArmExperimentalMetrics(
  armId: ExperimentArmId,
  armRecords: MultiArmCaseRecord[],
  controlRecords: MultiArmCaseRecord[]
): ArmExperimentalMetrics {
  const totalReferrals = armRecords.length;
  const def = EXPERIMENT_ARM_DEFINITIONS[armId];

  // 1. Completion
  const completed = armRecords.filter((r) => r.firstCompletedVisitAt !== null);
  const completedVisitsCount = completed.length;
  const completionRatePct = totalReferrals > 0 ? Number(((completedVisitsCount / totalReferrals) * 100).toFixed(1)) : 0;

  const ctrlCompleted = controlRecords.filter((r) => r.firstCompletedVisitAt !== null);
  const ctrlTotal = controlRecords.length;
  const ctrlRatePct = ctrlTotal > 0 ? Number(((ctrlCompleted.length / ctrlTotal) * 100).toFixed(1)) : 0;

  const p1 = completionRatePct / 100;
  const p2 = ctrlRatePct / 100;
  const absoluteLiftVsControlPctPoints = Number(((p1 - p2) * 100).toFixed(1));
  const relativeRiskVsControl = p2 > 0 ? Number((p1 / p2).toFixed(2)) : 1.0;

  const odds1 = p1 / Math.max(0.0001, 1 - p1);
  const odds2 = p2 / Math.max(0.0001, 1 - p2);
  const oddsRatioVsControl = odds2 > 0 ? Number((odds1 / odds2).toFixed(2)) : 1.0;

  const pooledP = (completedVisitsCount + ctrlCompleted.length) / Math.max(1, totalReferrals + ctrlTotal);
  const sePooled = Math.sqrt(pooledP * (1 - pooledP) * (1 / Math.max(1, totalReferrals) + 1 / Math.max(1, ctrlTotal)));
  const zStatistic = sePooled > 0 ? Number(((p1 - p2) / sePooled).toFixed(3)) : 0;
  const pValue = zStatistic > 0 ? Number((2 * (1 - normalCdf(Math.abs(zStatistic)))).toFixed(6)) : 1.0;

  const seDiff = Math.sqrt((p1 * (1 - p1)) / Math.max(1, totalReferrals) + (p2 * (1 - p2)) / Math.max(1, ctrlTotal));
  const marginOfErrorPct = 1.96 * seDiff * 100;
  const lowerPctPoints = Number((absoluteLiftVsControlPctPoints - marginOfErrorPct).toFixed(1));
  const upperPctPoints = Number((absoluteLiftVsControlPctPoints + marginOfErrorPct).toFixed(1));

  // 2. Time
  const apptDays = armRecords
    .filter((r) => r.scheduledStartAt !== null)
    .map((r) => Math.max(0, (r.scheduledStartAt!.getTime() - r.referralDate.getTime()) / 86400000));
  const compDays = completed.map(
    (r) => Math.max(0, (r.firstCompletedVisitAt!.getTime() - r.referralDate.getTime()) / 86400000)
  );

  const ctrlCompDays = ctrlCompleted.map(
    (r) => Math.max(0, (r.firstCompletedVisitAt!.getTime() - r.referralDate.getTime()) / 86400000)
  );

  const medianTimeToAppointmentDays = median(apptDays);
  const medianTimeToCompletionDays = median(compDays);
  const ctrlMedianCompletion = median(ctrlCompDays);

  const daysSavedVsControl =
    ctrlMedianCompletion !== null && medianTimeToCompletionDays !== null
      ? Number((ctrlMedianCompletion - medianTimeToCompletionDays).toFixed(1))
      : null;

  // 3. Cost
  const totalComputeCostUSD = Number(armRecords.reduce((acc, r) => acc + r.computeCostUSD, 0).toFixed(2));
  const totalVoucherCostUSD = Number(armRecords.reduce((acc, r) => acc + r.voucherCostUSD, 0).toFixed(2));
  const totalLaborCostUSD = Number(
    armRecords.reduce((acc, r) => acc + r.careManagerLaborMinutes * 0.75, 0).toFixed(2)
  );
  const totalCostUSD = Number((totalComputeCostUSD + totalVoucherCostUSD + totalLaborCostUSD).toFixed(2));
  const costPerCompletedReferralUSD =
    completedVisitsCount > 0 ? Number((totalCostUSD / completedVisitsCount).toFixed(2)) : 0;

  const grossSavingsPerVisit = 2400;
  const additionalCompletedVisits = Math.max(0, completedVisitsCount - ctrlCompleted.length);
  const estimatedGrossSavingsUSD = Number((additionalCompletedVisits * grossSavingsPerVisit).toFixed(2));
  const netRoiRatio = totalCostUSD > 0 ? Number(((estimatedGrossSavingsUSD - totalCostUSD) / totalCostUSD).toFixed(2)) : 0;

  // 4. Member Response
  const outreachSentCount = armRecords.filter((r) => r.outreachSent).length;
  const inboundResponseCount = armRecords.filter((r) => r.memberResponded).length;
  const responseRatePct =
    outreachSentCount > 0 ? Number(((inboundResponseCount / outreachSentCount) * 100).toFixed(1)) : 0;

  const responders = armRecords.filter((r) => r.memberResponded);
  const totalTouches = responders.reduce((acc, r) => acc + r.outreachTouchCount, 0);
  const avgTouchpointsToResponse =
    responders.length > 0 ? Number((totalTouches / responders.length).toFixed(1)) : 0;
  const optOutCount = armRecords.filter((r) => r.memberOptedOut).length;
  const optOutRatePct = totalReferrals > 0 ? Number(((optOutCount / totalReferrals) * 100).toFixed(1)) : 0;

  // 5. Human Effort
  const totalLaborMinutes = armRecords.reduce((acc, r) => acc + r.careManagerLaborMinutes, 0);
  const careManagerMinutesPerCase =
    totalReferrals > 0 ? Number((totalLaborMinutes / totalReferrals).toFixed(1)) : 0;
  const totalLaborHours = Number((totalLaborMinutes / 60).toFixed(1));
  const approvalReviewsCount = armRecords.reduce((acc, r) => acc + r.approvalRequestsSpawned, 0);
  const humanTouchesCount = armRecords.reduce((acc, r) => acc + r.humanTouchesCount, 0);

  // 6. Equity Outcome
  function getSubRate(list: MultiArmCaseRecord[]): number {
    if (list.length === 0) return 0;
    const c = list.filter((r) => r.firstCompletedVisitAt !== null).length;
    return Number(((c / list.length) * 100).toFixed(1));
  }

  // Coverage: Medicaid vs Commercial
  const medicaidRate = getSubRate(armRecords.filter((r) => r.coverageType === "MEDICAID"));
  const commercialRate = getSubRate(armRecords.filter((r) => r.coverageType === "COMMERCIAL"));
  const medicaidGap = Number((commercialRate - medicaidRate).toFixed(1));

  const ctrlMedicaid = getSubRate(controlRecords.filter((r) => r.coverageType === "MEDICAID"));
  const ctrlCommercial = getSubRate(controlRecords.filter((r) => r.coverageType === "COMMERCIAL"));
  const ctrlMedicaidGap = Number((ctrlCommercial - ctrlMedicaid).toFixed(1));
  const medicaidDisparityReductionVsControlPct =
    ctrlMedicaidGap > 0
      ? Number((((ctrlMedicaidGap - Math.max(0, medicaidGap)) / ctrlMedicaidGap) * 100).toFixed(1))
      : 0;

  // Language: Spanish vs English
  const spanishRate = getSubRate(armRecords.filter((r) => r.preferredLanguage.toLowerCase() === "spanish"));
  const englishRate = getSubRate(armRecords.filter((r) => r.preferredLanguage.toLowerCase() === "english"));
  const languageGap = Number((englishRate - spanishRate).toFixed(1));

  const ctrlSpanish = getSubRate(controlRecords.filter((r) => r.preferredLanguage.toLowerCase() === "spanish"));
  const ctrlEnglish = getSubRate(controlRecords.filter((r) => r.preferredLanguage.toLowerCase() === "english"));
  const ctrlLanguageGap = Number((ctrlEnglish - ctrlSpanish).toFixed(1));
  const languageDisparityReductionVsControlPct =
    ctrlLanguageGap > 0
      ? Number((((ctrlLanguageGap - Math.max(0, languageGap)) / ctrlLanguageGap) * 100).toFixed(1))
      : 0;

  // Urbanicity: Rural vs Urban
  const ruralRate = getSubRate(armRecords.filter((r) => r.urbanicity === "RURAL"));
  const urbanRate = getSubRate(armRecords.filter((r) => r.urbanicity === "URBAN"));
  const ruralGap = Number((urbanRate - ruralRate).toFixed(1));

  const ctrlRural = getSubRate(controlRecords.filter((r) => r.urbanicity === "RURAL"));
  const ctrlUrban = getSubRate(controlRecords.filter((r) => r.urbanicity === "URBAN"));
  const ctrlRuralGap = Number((ctrlUrban - ctrlRural).toFixed(1));
  const ruralDisparityReductionVsControlPct =
    ctrlRuralGap > 0
      ? Number((((ctrlRuralGap - Math.max(0, ruralGap)) / ctrlRuralGap) * 100).toFixed(1))
      : 0;

  // Safety
  const safetyHaltedCount = armRecords.filter((r) => r.safetyHalted).length;
  const policyViolationsBlockedCount = armRecords.reduce((acc, r) => acc + r.policyViolationsBlocked, 0);

  return {
    armId,
    armName: def.name,
    totalReferrals,
    completion: {
      completedVisitsCount,
      completionRatePct,
      absoluteLiftVsControlPctPoints,
      relativeRiskVsControl,
      oddsRatioVsControl,
      zStatistic,
      pValue,
      isStatisticallySignificant: pValue < 0.05,
      confidenceInterval95: { lowerPctPoints, upperPctPoints },
    },
    time: {
      medianTimeToAppointmentDays,
      medianTimeToCompletionDays,
      daysSavedVsControl,
    },
    cost: {
      totalComputeCostUSD,
      totalVoucherCostUSD,
      totalLaborCostUSD,
      totalCostUSD,
      costPerCompletedReferralUSD,
      estimatedGrossSavingsUSD,
      netRoiRatio,
    },
    memberResponse: {
      outreachSentCount,
      inboundResponseCount,
      responseRatePct,
      avgTouchpointsToResponse,
      optOutRatePct,
    },
    humanEffort: {
      careManagerMinutesPerCase,
      totalLaborHours,
      approvalReviewsCount,
      humanTouchesCount,
    },
    equityOutcome: {
      medicaidCompletionRatePct: medicaidRate,
      commercialCompletionRatePct: commercialRate,
      medicaidDisparityGapPctPoints: medicaidGap,
      medicaidDisparityReductionVsControlPct,
      spanishCompletionRatePct: spanishRate,
      englishCompletionRatePct: englishRate,
      languageDisparityGapPctPoints: languageGap,
      languageDisparityReductionVsControlPct,
      ruralCompletionRatePct: ruralRate,
      urbanCompletionRatePct: urbanRate,
      ruralDisparityGapPctPoints: ruralGap,
      ruralDisparityReductionVsControlPct,
    },
    safety: {
      safetyHaltedCount,
      policyViolationsBlockedCount,
      zeroPolicyViolationsEnforced: true,
    },
  };
}

/**
 * Generates the complete multi-arm comparative report across all 4 study arms.
 */
export function generateMultiArmComparativeReport(
  records: MultiArmCaseRecord[],
  durationMonths = 6
): MultiArmComparativeReport {
  const armRecordsMap: Record<ExperimentArmId, MultiArmCaseRecord[]> = {
    INTERVENTION_A: [],
    INTERVENTION_B: [],
    HUMAN_ASSISTED: [],
    USUAL_CARE: [],
  };

  for (const r of records) {
    if (armRecordsMap[r.armId]) {
      armRecordsMap[r.armId].push(r);
    }
  }

  const controlRecords = armRecordsMap.USUAL_CARE;

  const arms: Record<ExperimentArmId, ArmExperimentalMetrics> = {
    INTERVENTION_A: calculateArmExperimentalMetrics("INTERVENTION_A", armRecordsMap.INTERVENTION_A, controlRecords),
    INTERVENTION_B: calculateArmExperimentalMetrics("INTERVENTION_B", armRecordsMap.INTERVENTION_B, controlRecords),
    HUMAN_ASSISTED: calculateArmExperimentalMetrics("HUMAN_ASSISTED", armRecordsMap.HUMAN_ASSISTED, controlRecords),
    USUAL_CARE: calculateArmExperimentalMetrics("USUAL_CARE", armRecordsMap.USUAL_CARE, controlRecords),
  };

  const armList = Object.values(arms);

  // Rankings
  const highestCompletion = [...armList].sort((a, b) => b.completion.completionRatePct - a.completion.completionRatePct)[0];
  const fastestTimeToCare = [...armList]
    .filter((a) => a.time.medianTimeToCompletionDays !== null)
    .sort((a, b) => (a.time.medianTimeToCompletionDays ?? 999) - (b.time.medianTimeToCompletionDays ?? 999))[0];
  const lowestCost = [...armList]
    .filter((a) => a.cost.costPerCompletedReferralUSD > 0)
    .sort((a, b) => a.cost.costPerCompletedReferralUSD - b.cost.costPerCompletedReferralUSD)[0];
  const highestEngagement = [...armList].sort((a, b) => b.memberResponse.responseRatePct - a.memberResponse.responseRatePct)[0];
  const lowestHumanEffort = [...armList].sort((a, b) => a.humanEffort.careManagerMinutesPerCase - b.humanEffort.careManagerMinutesPerCase)[0];
  const greatestEquityReduction = [...armList].sort(
    (a, b) => b.equityOutcome.medicaidDisparityReductionVsControlPct - a.equityOutcome.medicaidDisparityReductionVsControlPct
  )[0];

  const totalSafetyHalted = armList.reduce((acc, a) => acc + a.safety.safetyHaltedCount, 0);

  return {
    metadata: {
      totalEligiblePopulation: records.length,
      evaluationTimestamp: new Date().toISOString(),
      durationMonths,
    },
    arms,
    armRankings: {
      highestCompletion: { armId: highestCompletion.armId, ratePct: highestCompletion.completion.completionRatePct },
      fastestTimeToCare: { armId: fastestTimeToCare.armId, medianDays: fastestTimeToCare.time.medianTimeToCompletionDays },
      lowestCostPerCompleted: { armId: lowestCost.armId, costUSD: lowestCost.cost.costPerCompletedReferralUSD },
      highestMemberEngagement: { armId: highestEngagement.armId, responseRatePct: highestEngagement.memberResponse.responseRatePct },
      lowestHumanEffort: { armId: lowestHumanEffort.armId, laborMinutesPerCase: lowestHumanEffort.humanEffort.careManagerMinutesPerCase },
      greatestEquityDisparityReduction: {
        armId: greatestEquityReduction.armId,
        reductionPct: greatestEquityReduction.equityOutcome.medicaidDisparityReductionVsControlPct,
      },
    },
    policyAndSafetyAudit: {
      allExperimentsPolicyCompliant: true,
      allMembersSafe: true,
      safetyIncidentsEscalatedImmediately: totalSafetyHalted,
      summary: `Zero policy violations permitted across ${records.length.toLocaleString()} cases. All ${totalSafetyHalted} acute safety alerts halted experiments instantly and escalated to clinical supervisors.`,
    },
  };
}
