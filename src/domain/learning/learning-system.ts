import { BarrierCategory, CaseStatus, InterventionType } from "@prisma/client";
import { AuthorizationError, ValidationError } from "@/lib/errors";

export interface CompletedCaseInitialContext {
  memberId: string;
  ageGroup?: string;
  coverageType: string;
  preferredLanguage: string;
  urbanicity: string;
  raceEthnicity?: string;
  digitalAccessLevel: string;
  specialty: string;
  behavioralHealthNeed: string;
  urgency: string;
  priorityScore: number;
  riskLevel: string;
}

export interface CompletedCaseBarrierData {
  primaryCategory: BarrierCategory | string;
  subBarrierCode: string | null;
  epistemicStatus: "FACT" | "INFERENCE";
  barrierSeverity?: string;
  confidence: number;
}

export interface CompletedCaseInterventionData {
  interventionType: InterventionType | string;
  catalogLabel: string;
  toolSelected: string;
  hypothesis: string;
}

export interface CompletedCaseExecutionPath {
  stateSequence: string[];
  toolSequence: string[];
  iterationsCount: number;
}

export interface CompletedCaseHumanInvolvement {
  reviewRequired: boolean;
  approvalCount: number;
  supervisorOverrides: number;
  humanIntervention: boolean;
  careManagerLaborMinutes: number;
}

export interface CompletedCaseTimeData {
  timeToAppointmentDays: number | null;
  timeToCompletionDays: number | null;
  totalElapsedMs: number;
}

export interface CompletedCaseCostData {
  computeTokens: number;
  computeCostUSD: number;
  voucherCostUSD: number;
  humanLaborCostUSD: number;
  totalCostUSD: number;
}

export interface CompletedCaseOutcomeData {
  verifiedCompletion: boolean;
  dualSourceVerified: boolean;
  verificationSignals: string[];
  noShowRecorded: boolean;
  finalStatus: CaseStatus | string;
  closureReason: string | null;
}

export interface CompletedCaseEquityCohort {
  cohortKey: string;
  coverageType: string;
  preferredLanguage: string;
  urbanicity: string;
  raceEthnicity: string;
}

export interface CompletedCaseLearningSnapshot {
  caseId: string;
  tenantId: string;
  capturedAt: string;
  initialContext: CompletedCaseInitialContext;
  barrier: CompletedCaseBarrierData;
  confidence: {
    barrierDetectionConfidence: number;
    interventionRecommendationConfidence: number;
  };
  intervention: CompletedCaseInterventionData;
  executionPath: CompletedCaseExecutionPath;
  humanInvolvement: CompletedCaseHumanInvolvement;
  time: CompletedCaseTimeData;
  cost: CompletedCaseCostData;
  outcome: CompletedCaseOutcomeData;
  equityCohort: CompletedCaseEquityCohort;
}

/**
 * ============================================================================
 * LEARNING ANALYTICS QUERY ENGINE
 * ============================================================================
 * Answers:
 * "For members with this barrier and context, which intervention has
 * historically produced the best completion outcome with the least friction?"
 * ============================================================================
 */

export interface OptimalInterventionQuery {
  barrierCategory: BarrierCategory | string;
  subBarrierCode?: string;
  context: {
    coverageType?: string;
    preferredLanguage?: string;
    urbanicity?: string;
    raceEthnicity?: string;
    urgency?: string;
    riskLevel?: string;
  };
}

export interface InterventionPerformanceSummary {
  interventionType: string;
  catalogLabel: string;
  toolSelected: string;
  sampleCount: number;
  verifiedCompletionRatePct: number;
  medianTimeToCareDays: number;
  avgHumanLaborMinutes: number;
  noShowRatePct: number;
  avgTotalCostUSD: number;
  frictionScore: number; // 0..100 (lower = less friction)
  compositeEfficiencyScore: number; // (Completion % * 100) / Friction Score (higher = better)
  confidenceTier: "HIGH" | "MEDIUM" | "EMERGING_LOW_SAMPLE";
  keyStrengths: string[];
  frictionBreakdown: {
    timeFriction: number;
    laborFriction: number;
    schedulingFriction: number;
  };
}

export interface OptimalInterventionQueryResult {
  query: OptimalInterventionQuery;
  matchingHistoricalCasesCount: number;
  bestIntervention: InterventionPerformanceSummary;
  rankedAlternatives: InterventionPerformanceSummary[];
  clinicalRationale: string;
  governanceStatus: "ADVISORY_PROPOSAL_ONLY";
  prohibitsAutonomousMutation: true;
}

/**
 * Computes a standardized Friction Score (0..100) where 0 is zero friction and 100 is maximum friction.
 * Friction is composed of:
 * - Time-to-care delay (35% weight)
 * - Human labor minutes required (35% weight)
 * - Clinic no-show / reschedule rate (30% weight)
 */
export function calculateFrictionScore(params: {
  medianTimeToCareDays: number;
  avgLaborMinutes: number;
  noShowRatePct: number;
}): {
  compositeScore: number;
  breakdown: { timeFriction: number; laborFriction: number; schedulingFriction: number };
} {
  // Normalize time: 0 days = 0, 40+ days = 100
  const timeFriction = Math.min(100, Math.max(0, (params.medianTimeToCareDays / 40) * 100));
  // Normalize labor: 0 mins = 0, 30+ mins = 100
  const laborFriction = Math.min(100, Math.max(0, (params.avgLaborMinutes / 30) * 100));
  // No-show rate is already 0..100
  const schedulingFriction = Math.min(100, Math.max(0, params.noShowRatePct));

  const composite = 0.35 * timeFriction + 0.35 * laborFriction + 0.30 * schedulingFriction;

  return {
    compositeScore: Number(composite.toFixed(1)),
    breakdown: {
      timeFriction: Number(timeFriction.toFixed(1)),
      laborFriction: Number(laborFriction.toFixed(1)),
      schedulingFriction: Number(schedulingFriction.toFixed(1)),
    },
  };
}

/**
 * Evaluates historical snapshots and returns the intervention producing the
 * best completion outcome with the least friction.
 */
export function findBestInterventionForBarrierAndContext(
  query: OptimalInterventionQuery,
  historicalRecords: CompletedCaseLearningSnapshot[]
): OptimalInterventionQueryResult {
  // Filter historical records matching barrier and context
  const matching = historicalRecords.filter((r) => {
    if (r.barrier.primaryCategory !== query.barrierCategory) return false;
    if (query.subBarrierCode && r.barrier.subBarrierCode && r.barrier.subBarrierCode !== query.subBarrierCode) {
      return false;
    }
    if (query.context.coverageType && r.initialContext.coverageType !== query.context.coverageType) {
      return false;
    }
    if (
      query.context.preferredLanguage &&
      r.initialContext.preferredLanguage.toLowerCase() !== query.context.preferredLanguage.toLowerCase()
    ) {
      return false;
    }
    if (query.context.urbanicity && r.initialContext.urbanicity !== query.context.urbanicity) {
      return false;
    }
    return true;
  });

  if (matching.length === 0) {
    throw new ValidationError(
      `Insufficient historical learning records matching barrier '${query.barrierCategory}' and context.`
    );
  }

  // Group by intervention type
  const groups = new Map<string, CompletedCaseLearningSnapshot[]>();
  for (const r of matching) {
    const key = r.intervention.interventionType;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  const summaries: InterventionPerformanceSummary[] = [];

  for (const [interventionType, cases] of groups.entries()) {
    const n = cases.length;
    const completedCases = cases.filter((c) => c.outcome.verifiedCompletion);
    const completionRatePct = Number(((completedCases.length / n) * 100).toFixed(1));

    const daysToCare = completedCases
      .map((c) => c.time.timeToCompletionDays)
      .filter((d): d is number => d !== null);
    const medianDays = daysToCare.length > 0 ? getMedian(daysToCare) : 35;

    const totalLabor = cases.reduce((acc, c) => acc + c.humanInvolvement.careManagerLaborMinutes, 0);
    const avgLaborMinutes = Number((totalLabor / n).toFixed(1));

    const noShowCases = cases.filter((c) => c.outcome.noShowRecorded);
    const noShowRatePct = Number(((noShowCases.length / n) * 100).toFixed(1));

    const totalCost = cases.reduce((acc, c) => acc + c.cost.totalCostUSD, 0);
    const avgTotalCostUSD = Number((totalCost / n).toFixed(2));

    const friction = calculateFrictionScore({
      medianTimeToCareDays: medianDays,
      avgLaborMinutes,
      noShowRatePct,
    });

    // Efficiency Score = (Completion Rate * 100) / max(10, Friction Score)
    const compositeEfficiencyScore = Number(
      ((completionRatePct * 100) / Math.max(10, friction.compositeScore)).toFixed(1)
    );

    const confidenceTier = n >= 30 ? "HIGH" : n >= 10 ? "MEDIUM" : "EMERGING_LOW_SAMPLE";

    const keyStrengths: string[] = [];
    if (completionRatePct >= 60) keyStrengths.push("High verified visit completion");
    if (medianDays <= 14) keyStrengths.push("Rapid access velocity (< 14 days)");
    if (avgLaborMinutes <= 5) keyStrengths.push("Low human staff friction");
    if (noShowRatePct <= 12) keyStrengths.push("Low clinic no-show rate");

    const sampleCase = cases[0];

    summaries.push({
      interventionType,
      catalogLabel: sampleCase.intervention.catalogLabel,
      toolSelected: sampleCase.intervention.toolSelected,
      sampleCount: n,
      verifiedCompletionRatePct: completionRatePct,
      medianTimeToCareDays: medianDays,
      avgHumanLaborMinutes: avgLaborMinutes,
      noShowRatePct,
      avgTotalCostUSD,
      frictionScore: friction.compositeScore,
      compositeEfficiencyScore,
      confidenceTier,
      keyStrengths,
      frictionBreakdown: friction.breakdown,
    });
  }

  // Sort primarily by composite efficiency score (highest completion with least friction)
  summaries.sort((a, b) => b.compositeEfficiencyScore - a.compositeEfficiencyScore);

  const best = summaries[0];
  const alternatives = summaries.slice(1);

  const rationale = `Based on ${matching.length} historical cases with barrier '${query.barrierCategory}', '${best.catalogLabel}' achieved the highest efficiency score (${best.compositeEfficiencyScore}) with a ${best.verifiedCompletionRatePct}% completion rate and an average friction score of ${best.frictionScore}/100 (${best.medianTimeToCareDays} days to care, ${best.avgHumanLaborMinutes} min labor).`;

  return {
    query,
    matchingHistoricalCasesCount: matching.length,
    bestIntervention: best,
    rankedAlternatives: alternatives,
    clinicalRationale: rationale,
    governanceStatus: "ADVISORY_PROPOSAL_ONLY",
    prohibitsAutonomousMutation: true,
  };
}

function getMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1));
}

/**
 * ============================================================================
 * GOVERNANCE & ANTI-SELF-MODIFICATION INVARIANTS
 * ============================================================================
 * "Do not allow the learning system to automatically change production policy
 * without governance."
 * ============================================================================
 */

export class PolicyGovernanceViolationError extends ValidationError {
  constructor(message: string) {
    super(`Policy Governance Rejection: ${message}`);
  }
}

export interface PolicyGovernanceProposal {
  id: string;
  tenantId: string;
  proposedByRole: string;
  proposalType: "INTERVENTION_MAPPING_OPTIMIZATION" | "PRIORITIZATION_WEIGHT_TUNE" | "PROMPT_VERSION_UPDATE";
  targetBarrierCategory: string;
  recommendedInterventionType: string;
  historicalEvidenceN: number;
  historicalCompletionRatePct: number;
  frictionReductionPct: number;
  rationale: string;
  status: "PENDING_SUPERVISOR_REVIEW" | "APPROVED" | "REJECTED";
  reviewedById?: string;
  reviewedByRole?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
}

/**
 * Invariant Guard: Blocks any autonomous AI agent or background process from
 * directly mutating production policies without human clinical governance.
 */
export function assertNoAutonomousPolicyMutation(actorRole: string): void {
  const privilegedGovernanceRoles = new Set(["ADMIN", "CLINICAL_SUPERVISOR"]);
  if (!privilegedGovernanceRoles.has(actorRole)) {
    throw new PolicyGovernanceViolationError(
      `Role '${actorRole}' is prohibited from mutating production policies. The learning system outputs are advisory proposals only and require human clinical supervisor governance.`
    );
  }
}
