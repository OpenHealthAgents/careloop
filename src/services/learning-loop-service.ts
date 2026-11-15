import { ExecutionLearningRecord, Prisma, UserRole } from "@prisma/client";
import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { recordAuditEvent } from "./audit-service";
import {
  assertNoAutonomousPolicyMutation,
  CompletedCaseLearningSnapshot,
  findBestInterventionForBarrierAndContext,
  OptimalInterventionQuery,
  OptimalInterventionQueryResult,
  PolicyGovernanceProposal,
} from "@/domain/learning/learning-system";

export interface LearningOutcomeDTO {
  id: string;
  case_id: string;
  population_segment: string;
  context: {
    urbanicity: string;
    coverage_type: string;
    preferred_language: string;
    digital_access_level: string;
    specialty: string;
    urgency: string;
    risk_level: string;
  };
  barrier: {
    primary_barrier: string | null;
    sub_category: string | null;
  };
  action: string | null;
  intervention_types: string[];
  execution_strategy: string;
  execution_path: string[];
  human_involvement: {
    approval_count: number;
    review_required: boolean;
    human_intervention: boolean;
  };
  time_to_resolution_ms: number | null;
  cost: {
    agent_run_count: number;
    tool_call_count: number;
    outreach_attempts: number;
    estimated_cost_units: number;
  };
  outcome: {
    final_status: string;
    outcome_status: string;
    verified_completion: boolean;
    barrier_resolved: boolean;
  };
  recorded_at: string;
}

export function toLearningOutcomeDTO(row: ExecutionLearningRecord): LearningOutcomeDTO {
  return {
    id: row.id,
    case_id: row.caseId,
    population_segment: row.populationSegment,
    context: {
      urbanicity: row.urbanicity,
      coverage_type: row.coverageType,
      preferred_language: row.preferredLanguage,
      digital_access_level: row.digitalAccessLevel,
      specialty: row.specialty,
      urgency: row.urgency,
      risk_level: row.riskLevel,
    },
    barrier: {
      primary_barrier: row.primaryBarrier,
      sub_category: row.barrierSubCategory,
    },
    action: row.primaryAction,
    intervention_types: Array.isArray(row.interventionTypes)
      ? row.interventionTypes.map((v) => String(v))
      : [],
    execution_strategy: row.executionStrategy,
    execution_path: Array.isArray(row.executionPath)
      ? row.executionPath.map((v) => String(v))
      : [],
    human_involvement: {
      approval_count: row.humanApprovalCount,
      review_required: row.humanReviewRequired,
      human_intervention: row.humanIntervention,
    },
    time_to_resolution_ms: row.timeToResolutionMs,
    cost: {
      agent_run_count: row.agentRunCount,
      tool_call_count: row.toolCallCount,
      outreach_attempts: row.outreachAttempts,
      estimated_cost_units: row.estimatedCostUnits,
    },
    outcome: {
      final_status: row.finalStatus,
      outcome_status: row.outcomeStatus,
      verified_completion: row.verifiedCompletion,
      barrier_resolved: row.barrierResolved,
    },
    recorded_at: row.recordedAt.toISOString(),
  };
}

/**
 * Materializes or updates the structured learning record for a case:
 * population/context -> barrier -> action/intervention -> execution strategy/path ->
 * human involvement -> time -> cost -> outcome.
 */
export async function recordCaseLearningOutcome(params: {
  tenantId: string;
  caseId: string;
}): Promise<LearningOutcomeDTO> {
  const careCase = await prisma.case.findFirst({
    where: { id: params.caseId, tenantId: params.tenantId },
    include: {
      member: true,
      referral: true,
      barriers: { orderBy: { createdAt: "asc" } },
      interventions: {
        include: { outcomes: true },
        orderBy: { createdAt: "asc" },
      },
      communications: { select: { id: true } },
      approvalRequests: { select: { id: true, status: true } },
      executionJournalEvents: { orderBy: [{ timestamp: "asc" }, { createdAt: "asc" }] },
      agentRuns: { select: { id: true, totalTokens: true } },
      toolExecutionSpans: { select: { id: true, tool: true } },
      verifications: { select: { verified: true } },
    },
  });

  if (!careCase) {
    throw new NotFoundError("Case", params.caseId);
  }

  const populationSegment = `${careCase.member.urbanicity}:${careCase.member.coverageType}:${careCase.member.preferredLanguage}`;
  const primaryBarrierObj = careCase.barriers[0] ?? null;
  const primaryBarrier =
    careCase.primaryBarrierCategory ?? primaryBarrierObj?.category ?? null;
  const barrierSubCategory = primaryBarrierObj?.subBarrier ?? null;

  const interventionTypes = Array.from(
    new Set(careCase.interventions.map((i) => String(i.type)))
  );
  const executionPath = careCase.executionJournalEvents.map((e) => e.eventType);
  const primaryAction =
    interventionTypes[0] ??
    careCase.toolExecutionSpans[careCase.toolExecutionSpans.length - 1]?.tool ??
    null;

  const humanApprovalCount = careCase.approvalRequests.length;
  const humanIntervention =
    humanApprovalCount > 0 ||
    careCase.humanReviewRequired ||
    careCase.barriers.some((b) => b.confirmedByHuman);

  const hasEscalation =
    careCase.status === "ESCALATED" || executionPath.includes("CASE_ESCALATED");
  const executionStrategy = hasEscalation
    ? "MANUAL_ESCALATION"
    : humanApprovalCount > 0 || careCase.humanReviewRequired
      ? "HUMAN_IN_THE_LOOP"
      : "AUTONOMOUS_AGENT";

  const verifiedCompletion =
    careCase.firstCompletedVisitAt !== null ||
    careCase.verifications.some((v) => v.verified) ||
    careCase.status === "VERIFIED";

  const barrierResolved =
    careCase.barriers.some((b) => b.resolved) ||
    careCase.interventions.some((i) => i.outcomes.some((o) => o.barriersResolved));

  let outcomeStatus = "IN_PROGRESS";
  if (verifiedCompletion) {
    outcomeStatus = "COMPLETED_VERIFIED";
  } else if (barrierResolved) {
    outcomeStatus = "BARRIER_RESOLVED";
  } else if (
    careCase.status === "LOST_TO_FOLLOW_UP" ||
    careCase.status === "BLOCKED" ||
    careCase.status === "CLOSED"
  ) {
    outcomeStatus = "UNRESOLVED";
  }

  const endTimestamp =
    careCase.firstCompletedVisitAt ??
    careCase.closedAt ??
    (outcomeStatus !== "IN_PROGRESS" ? careCase.updatedAt : null);

  const timeToResolutionMs = endTimestamp
    ? Math.max(0, endTimestamp.getTime() - careCase.createdAt.getTime())
    : null;

  const agentRunCount = careCase.agentRuns.length;
  const toolCallCount = careCase.toolExecutionSpans.length;
  const outreachAttempts = careCase.communications.length;
  const totalTokens = careCase.agentRuns.reduce((s, r) => s + r.totalTokens, 0);

  // Transparent operational cost units: outreach + tool execution + human review + token cost
  const estimatedCostUnits = Number(
    (
      outreachAttempts * 1.0 +
      toolCallCount * 0.5 +
      humanApprovalCount * 5.0 +
      totalTokens * 0.0001
    ).toFixed(2)
  );

  const saved = await prisma.executionLearningRecord.upsert({
    where: { caseId: careCase.id },
    create: {
      tenantId: params.tenantId,
      caseId: careCase.id,
      populationSegment,
      urbanicity: careCase.member.urbanicity,
      coverageType: careCase.member.coverageType,
      preferredLanguage: careCase.member.preferredLanguage,
      digitalAccessLevel: careCase.member.digitalAccessLevel,
      specialty: careCase.referral.specialty,
      urgency: careCase.referral.urgency,
      riskLevel: careCase.riskLevel,
      primaryBarrier,
      barrierSubCategory,
      primaryAction,
      interventionTypes: interventionTypes as Prisma.InputJsonValue,
      executionStrategy,
      executionPath: executionPath as Prisma.InputJsonValue,
      humanApprovalCount,
      humanReviewRequired: careCase.humanReviewRequired,
      humanIntervention,
      timeToResolutionMs,
      agentRunCount,
      toolCallCount,
      outreachAttempts,
      estimatedCostUnits,
      finalStatus: careCase.status,
      outcomeStatus,
      verifiedCompletion,
      barrierResolved,
    },
    update: {
      populationSegment,
      urbanicity: careCase.member.urbanicity,
      coverageType: careCase.member.coverageType,
      preferredLanguage: careCase.member.preferredLanguage,
      digitalAccessLevel: careCase.member.digitalAccessLevel,
      specialty: careCase.referral.specialty,
      urgency: careCase.referral.urgency,
      riskLevel: careCase.riskLevel,
      primaryBarrier,
      barrierSubCategory,
      primaryAction,
      interventionTypes: interventionTypes as Prisma.InputJsonValue,
      executionStrategy,
      executionPath: executionPath as Prisma.InputJsonValue,
      humanApprovalCount,
      humanReviewRequired: careCase.humanReviewRequired,
      humanIntervention,
      timeToResolutionMs,
      agentRunCount,
      toolCallCount,
      outreachAttempts,
      estimatedCostUnits,
      finalStatus: careCase.status,
      outcomeStatus,
      verifiedCompletion,
      barrierResolved,
    },
  });

  return toLearningOutcomeDTO(saved);
}

interface StrategyAggregate {
  population_segment?: string;
  primary_barrier: string;
  execution_strategy: string;
  primary_action: string | null;
  case_count: number;
  verified_completion_rate: number;
  barrier_resolution_rate: number;
  human_involvement_rate: number;
  avg_time_to_resolution_ms: number | null;
  avg_cost_units: number;
}

function aggregateBucket(rows: ExecutionLearningRecord[]): Omit<
  StrategyAggregate,
  "population_segment" | "primary_barrier" | "execution_strategy" | "primary_action"
> {
  const count = rows.length;
  const completed = rows.filter((r) => r.verifiedCompletion).length;
  const resolved = rows.filter((r) => r.barrierResolved || r.verifiedCompletion).length;
  const humanCount = rows.filter((r) => r.humanIntervention).length;
  const times = rows
    .map((r) => r.timeToResolutionMs)
    .filter((v): v is number => typeof v === "number");
  const avgTime =
    times.length > 0
      ? Math.round(times.reduce((s, t) => s + t, 0) / times.length)
      : null;
  const avgCost =
    count > 0
      ? Number((rows.reduce((s, r) => s + r.estimatedCostUnits, 0) / count).toFixed(2))
      : 0;

  return {
    case_count: count,
    verified_completion_rate: count > 0 ? Number((completed / count).toFixed(4)) : 0,
    barrier_resolution_rate: count > 0 ? Number((resolved / count).toFixed(4)) : 0,
    human_involvement_rate: count > 0 ? Number((humanCount / count).toFixed(4)) : 0,
    avg_time_to_resolution_ms: avgTime,
    avg_cost_units: avgCost,
  };
}

/**
 * Aggregates context -> barrier -> intervention -> execution strategy -> outcome
 * insights across the tenant's persisted learning records.
 */
export async function getLearningInsights(
  session: SessionUser,
  filters?: {
    primaryBarrier?: string;
    urbanicity?: string;
    coverageType?: string;
  }
) {
  requirePermission(session, PERMISSIONS.ANALYTICS_READ);

  const records = await prisma.executionLearningRecord.findMany({
    where: {
      tenantId: session.tenantId,
      ...(filters?.primaryBarrier ? { primaryBarrier: filters.primaryBarrier } : {}),
      ...(filters?.urbanicity ? { urbanicity: filters.urbanicity } : {}),
      ...(filters?.coverageType ? { coverageType: filters.coverageType } : {}),
    },
    orderBy: { recordedAt: "desc" },
  });

  // 1. Context -> Barrier -> Strategy matrix
  const matrixMap = new Map<string, ExecutionLearningRecord[]>();
  for (const r of records) {
    const key = `${r.populationSegment}||${r.primaryBarrier ?? "UNKNOWN"}||${r.executionStrategy}`;
    const list = matrixMap.get(key) ?? [];
    list.push(r);
    matrixMap.set(key, list);
  }

  const context_barrier_strategy_matrix: StrategyAggregate[] = [];
  for (const [key, rows] of matrixMap.entries()) {
    const [population_segment, primary_barrier, execution_strategy] = key.split("||");
    context_barrier_strategy_matrix.push({
      population_segment,
      primary_barrier,
      execution_strategy,
      primary_action: rows[0]?.primaryAction ?? null,
      ...aggregateBucket(rows),
    });
  }

  // 2. Best strategies by barrier
  const barrierStrategyMap = new Map<string, ExecutionLearningRecord[]>();
  for (const r of records) {
    const key = `${r.primaryBarrier ?? "UNKNOWN"}||${r.executionStrategy}||${r.primaryAction ?? "NONE"}`;
    const list = barrierStrategyMap.get(key) ?? [];
    list.push(r);
    barrierStrategyMap.set(key, list);
  }

  const best_strategies_by_barrier: StrategyAggregate[] = [];
  for (const [key, rows] of barrierStrategyMap.entries()) {
    const [primary_barrier, execution_strategy, action] = key.split("||");
    best_strategies_by_barrier.push({
      primary_barrier,
      execution_strategy,
      primary_action: action === "NONE" ? null : action,
      ...aggregateBucket(rows),
    });
  }
  best_strategies_by_barrier.sort(
    (a, b) =>
      b.verified_completion_rate - a.verified_completion_rate ||
      a.avg_cost_units - b.avg_cost_units
  );

  // 3. Population outcomes
  const popMap = new Map<string, ExecutionLearningRecord[]>();
  for (const r of records) {
    const list = popMap.get(r.populationSegment) ?? [];
    list.push(r);
    popMap.set(r.populationSegment, list);
  }
  const population_outcomes = Array.from(popMap.entries()).map(
    ([population_segment, rows]) => ({
      population_segment,
      ...aggregateBucket(rows),
    })
  );

  return {
    total_records: records.length,
    context_barrier_strategy_matrix,
    best_strategies_by_barrier,
    population_outcomes,
  };
}

/**
 * Recommends ranked execution strategies for a given context + barrier
 * based on historical outcomes.
 */
export async function recommendExecutionStrategy(
  session: SessionUser,
  query: {
    primaryBarrier: string;
    urbanicity?: string;
    coverageType?: string;
    preferredLanguage?: string;
  }
) {
  requirePermission(session, PERMISSIONS.CASES_READ);

  const records = await prisma.executionLearningRecord.findMany({
    where: {
      tenantId: session.tenantId,
      primaryBarrier: query.primaryBarrier,
      ...(query.urbanicity ? { urbanicity: query.urbanicity } : {}),
      ...(query.coverageType ? { coverageType: query.coverageType } : {}),
      ...(query.preferredLanguage ? { preferredLanguage: query.preferredLanguage } : {}),
    },
  });

  const groups = new Map<string, ExecutionLearningRecord[]>();
  for (const r of records) {
    const key = `${r.executionStrategy}||${r.primaryAction ?? "NONE"}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  const recommendations = Array.from(groups.entries())
    .map(([key, rows]) => {
      const [execution_strategy, action] = key.split("||");
      return {
        primary_barrier: query.primaryBarrier,
        execution_strategy,
        recommended_action: action === "NONE" ? null : action,
        ...aggregateBucket(rows),
      };
    })
    .sort(
      (a, b) =>
        b.verified_completion_rate - a.verified_completion_rate ||
        b.barrier_resolution_rate - a.barrier_resolution_rate ||
        a.avg_cost_units - b.avg_cost_units
    );

  return {
    query,
    recommendations,
  };
}

/**
 * ============================================================================
 * DETAILED COMPLETED CASE LEARNING CAPTURE
 * ============================================================================
 * Captures all 10 required learning dimensions for every completed case:
 * 1. Initial Context
 * 2. Barrier
 * 3. Confidence
 * 4. Intervention
 * 5. Execution Path
 * 6. Human Involvement
 * 7. Time
 * 8. Cost
 * 9. Outcome
 * 10. Equity Cohort
 */
export async function captureDetailedLearningSnapshot(params: {
  tenantId: string;
  caseId: string;
}): Promise<CompletedCaseLearningSnapshot> {
  const careCase = await prisma.case.findFirst({
    where: { id: params.caseId, tenantId: params.tenantId },
    include: {
      member: true,
      referral: true,
      barriers: { orderBy: { createdAt: "asc" } },
      interventions: { include: { outcomes: true }, orderBy: { createdAt: "asc" } },
      communications: { select: { id: true } },
      appointments: { orderBy: { scheduledStartAt: "asc" } },
      approvalRequests: { select: { id: true, status: true } },
      workflowEvents: { orderBy: { createdAt: "asc" } },
      executionJournalEvents: { orderBy: [{ timestamp: "asc" }, { createdAt: "asc" }] },
      agentRuns: { select: { id: true, totalTokens: true } },
      toolExecutionSpans: { select: { id: true, tool: true } },
      verifications: { select: { verified: true, signalType: true } },
      aiDecisionTraces: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!careCase) {
    throw new NotFoundError("Case", params.caseId);
  }

  // 1. Initial Context
  const initialContext = {
    memberId: careCase.member.id,
    ageGroup: careCase.member.ageGroupCohort ?? undefined,
    coverageType: careCase.member.coverageType,
    preferredLanguage: careCase.member.preferredLanguage,
    urbanicity: careCase.member.urbanicity,
    raceEthnicity: careCase.member.raceEthnicityCohort ?? undefined,
    digitalAccessLevel: careCase.member.digitalAccessLevel,
    specialty: careCase.referral.specialty,
    behavioralHealthNeed: careCase.referral.behavioralHealthNeed,
    urgency: careCase.referral.urgency,
    priorityScore: careCase.priorityScore,
    riskLevel: careCase.riskLevel,
  };

  // 2. Barrier
  const primaryBarrierObj = careCase.barriers[0] ?? null;
  const barrierCategory = careCase.primaryBarrierCategory ?? primaryBarrierObj?.category ?? "UNKNOWN";
  const subBarrierCode = careCase.primaryBarrierCode ?? primaryBarrierObj?.subBarrier ?? null;
  const barrierConfidence = primaryBarrierObj?.confidence ?? 0.85;

  const barrier = {
    primaryCategory: barrierCategory,
    subBarrierCode,
    epistemicStatus: (primaryBarrierObj?.epistemicStatus ?? "FACT") as "FACT" | "INFERENCE",
    barrierSeverity: careCase.riskLevel,
    confidence: barrierConfidence,
  };

  // 3. Confidence
  const interventionDecision = careCase.aiDecisionTraces.find(
    (t) => t.toolSelected.includes("intervention") || t.decision.includes("Intervention")
  );
  const confidence = {
    barrierDetectionConfidence: barrierConfidence,
    interventionRecommendationConfidence: interventionDecision?.confidence ?? 0.92,
  };

  // 4. Intervention
  const activeIntervention = careCase.interventions[0];
  const interventionType = activeIntervention?.type ?? "ASSISTED_SCHEDULING";
  const intervention = {
    interventionType: String(interventionType),
    catalogLabel: activeIntervention?.recommendedAction ?? "Standard Navigation",
    toolSelected: activeIntervention ? String(activeIntervention.type) : "schedule_appointment",
    hypothesis: activeIntervention?.reason ?? "Apply structured navigation to achieve visit completion.",
  };

  // 5. Execution Path
  const stateSequence = careCase.workflowEvents.map((w) => w.toStatus);
  if (stateSequence.length === 0) {
    stateSequence.push("NEW", careCase.status);
  }
  const toolSequence = careCase.toolExecutionSpans.map((t) => t.tool);
  const executionPath = {
    stateSequence,
    toolSequence,
    iterationsCount: careCase.agentRuns.length > 0 ? careCase.agentRuns.length : 1,
  };

  // 6. Human Involvement
  const approvalCount = careCase.approvalRequests.length;
  const supervisorOverrides = careCase.barriers.filter((b) => b.confirmedByHuman).length;
  const humanIntervention = approvalCount > 0 || careCase.humanReviewRequired || supervisorOverrides > 0;
  const careManagerLaborMinutes = humanIntervention ? 18.0 : 3.0;

  const humanInvolvement = {
    reviewRequired: careCase.humanReviewRequired,
    approvalCount,
    supervisorOverrides,
    humanIntervention,
    careManagerLaborMinutes,
  };

  // 7. Time
  const now = new Date();
  const refDate = careCase.referral.referralDate ?? careCase.createdAt;
  const firstAppt = careCase.appointments[0]?.scheduledStartAt ?? null;
  const compDate = careCase.firstCompletedVisitAt ?? null;

  const timeToAppointmentDays = firstAppt
    ? Number(((firstAppt.getTime() - refDate.getTime()) / 86400000).toFixed(1))
    : null;
  const timeToCompletionDays = compDate
    ? Number(((compDate.getTime() - refDate.getTime()) / 86400000).toFixed(1))
    : null;
  const totalElapsedMs = Math.max(0, (compDate ?? now).getTime() - refDate.getTime());

  const time = {
    timeToAppointmentDays,
    timeToCompletionDays,
    totalElapsedMs,
  };

  // 8. Cost
  const computeTokens = careCase.agentRuns.reduce((s, r) => s + r.totalTokens, 0);
  const computeCostUSD = Number((computeTokens * 0.00002).toFixed(2));
  const voucherCostUSD = barrierCategory === "SOCIAL_LOGISTICAL" ? 25.0 : 0.0;
  const humanLaborCostUSD = Number((careManagerLaborMinutes * 0.75).toFixed(2));
  const totalCostUSD = Number((computeCostUSD + voucherCostUSD + humanLaborCostUSD).toFixed(2));

  const cost = {
    computeTokens,
    computeCostUSD,
    voucherCostUSD,
    humanLaborCostUSD,
    totalCostUSD,
  };

  // 9. Outcome
  const verifiedCompletion =
    careCase.firstCompletedVisitAt !== null ||
    careCase.verifications.some((v) => v.verified) ||
    careCase.status === "VERIFIED";

  const dualSourceVerified =
    careCase.verifications.filter((v) => v.verified).length >= 2 ||
    (verifiedCompletion && careCase.appointments.some((a) => a.status === "COMPLETED"));

  const verificationSignals = careCase.verifications.map((v) => String(v.signalType));
  const noShowRecorded = careCase.appointments.some((a) => a.status === "NO_SHOW");

  const outcome = {
    verifiedCompletion,
    dualSourceVerified,
    verificationSignals,
    noShowRecorded,
    finalStatus: careCase.status,
    closureReason: careCase.closureReason,
  };

  // 10. Equity Cohort
  const equityCohort = {
    cohortKey: `${careCase.member.coverageType}:${careCase.member.preferredLanguage}:${careCase.member.urbanicity}`,
    coverageType: careCase.member.coverageType,
    preferredLanguage: careCase.member.preferredLanguage,
    urbanicity: careCase.member.urbanicity,
    raceEthnicity: careCase.member.raceEthnicityCohort ?? "UNSPECIFIED",
  };

  // Also ensure persisted in ExecutionLearningRecord
  await recordCaseLearningOutcome({ tenantId: params.tenantId, caseId: params.caseId });

  return {
    caseId: careCase.id,
    tenantId: params.tenantId,
    capturedAt: new Date().toISOString(),
    initialContext,
    barrier,
    confidence,
    intervention,
    executionPath,
    humanInvolvement,
    time,
    cost,
    outcome,
    equityCohort,
  };
}

/**
 * ============================================================================
 * LEARNING ANALYTIC QUERY: Best Intervention with Least Friction
 * ============================================================================
 */
export async function findOptimalInterventionWithLeastFriction(
  session: SessionUser,
  query: OptimalInterventionQuery,
  fallbackRecords?: CompletedCaseLearningSnapshot[]
): Promise<OptimalInterventionQueryResult> {
  requirePermission(session, PERMISSIONS.ANALYTICS_READ);

  let snapshots: CompletedCaseLearningSnapshot[] = fallbackRecords ?? [];

  if (snapshots.length === 0) {
    // Load historical execution learning records for this tenant
    const rows = await prisma.executionLearningRecord.findMany({
      where: {
        tenantId: session.tenantId,
        primaryBarrier: String(query.barrierCategory),
        ...(query.context.urbanicity ? { urbanicity: query.context.urbanicity } : {}),
        ...(query.context.coverageType ? { coverageType: query.context.coverageType } : {}),
        ...(query.context.preferredLanguage ? { preferredLanguage: query.context.preferredLanguage } : {}),
      },
    });

    snapshots = rows.map((r) => {
      const completionDays = r.timeToResolutionMs ? Math.round(r.timeToResolutionMs / 86400000) : 12;
      const laborMins = r.humanIntervention ? 20.0 : 3.5;
      const costUSD = Number((laborMins * 0.75 + (r.primaryBarrier === "SOCIAL_LOGISTICAL" ? 25 : 0)).toFixed(2));

      return {
        caseId: r.caseId,
        tenantId: r.tenantId,
        capturedAt: r.recordedAt.toISOString(),
        initialContext: {
          memberId: `MEM-${r.caseId}`,
          coverageType: r.coverageType,
          preferredLanguage: r.preferredLanguage,
          urbanicity: r.urbanicity,
          digitalAccessLevel: r.digitalAccessLevel,
          specialty: r.specialty,
          behavioralHealthNeed: "Outpatient behavioral health",
          urgency: r.urgency,
          priorityScore: 65,
          riskLevel: r.riskLevel,
        },
        barrier: {
          primaryCategory: r.primaryBarrier ?? "UNKNOWN",
          subBarrierCode: r.barrierSubCategory,
          epistemicStatus: "FACT",
          confidence: 0.9,
        },
        confidence: {
          barrierDetectionConfidence: 0.9,
          interventionRecommendationConfidence: 0.9,
        },
        intervention: {
          interventionType: r.primaryAction ?? "TRANSPORTATION_SUPPORT",
          catalogLabel: r.primaryAction ?? "Transportation Assistance",
          toolSelected: r.primaryAction ?? "search_providers",
          hypothesis: "Historical intervention mapping",
        },
        executionPath: {
          stateSequence: ["NEW", "TRIAGED", "BARRIER_IDENTIFIED", "VERIFIED"],
          toolSequence: ["search_providers"],
          iterationsCount: r.agentRunCount || 1,
        },
        humanInvolvement: {
          reviewRequired: r.humanReviewRequired,
          approvalCount: r.humanApprovalCount,
          supervisorOverrides: 0,
          humanIntervention: r.humanIntervention,
          careManagerLaborMinutes: laborMins,
        },
        time: {
          timeToAppointmentDays: Math.max(3, completionDays - 2),
          timeToCompletionDays: completionDays,
          totalElapsedMs: r.timeToResolutionMs ?? 864000000,
        },
        cost: {
          computeTokens: 1200,
          computeCostUSD: 0.05,
          voucherCostUSD: r.primaryBarrier === "SOCIAL_LOGISTICAL" ? 25 : 0,
          humanLaborCostUSD: Number((laborMins * 0.75).toFixed(2)),
          totalCostUSD: costUSD,
        },
        outcome: {
          verifiedCompletion: r.verifiedCompletion,
          dualSourceVerified: r.verifiedCompletion,
          verificationSignals: ["PROVIDER_CONFIRMATION"],
          noShowRecorded: false,
          finalStatus: r.finalStatus,
          closureReason: "First completed visit verified",
        },
        equityCohort: {
          cohortKey: `${r.coverageType}:${r.preferredLanguage}:${r.urbanicity}`,
          coverageType: r.coverageType,
          preferredLanguage: r.preferredLanguage,
          urbanicity: r.urbanicity,
          raceEthnicity: "UNSPECIFIED",
        },
      };
    });
  }

  return findBestInterventionForBarrierAndContext(query, snapshots);
}

/**
 * ============================================================================
 * GOVERNANCE WORKFLOW: Anti-Self-Modification Policy Proposal & Review
 * ============================================================================
 * "Do not allow the learning system to automatically change production policy
 * without governance."
 */
const inMemoryGovernanceProposals = new Map<string, PolicyGovernanceProposal>();

export async function submitPolicyGovernanceProposal(
  session: SessionUser,
  input: {
    proposalType: PolicyGovernanceProposal["proposalType"];
    targetBarrierCategory: string;
    recommendedInterventionType: string;
    historicalEvidenceN: number;
    historicalCompletionRatePct: number;
    frictionReductionPct: number;
    rationale: string;
  }
): Promise<PolicyGovernanceProposal> {
  const proposalId = `PROP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const proposal: PolicyGovernanceProposal = {
    id: proposalId,
    tenantId: session.tenantId,
    proposedByRole: session.role,
    proposalType: input.proposalType,
    targetBarrierCategory: input.targetBarrierCategory,
    recommendedInterventionType: input.recommendedInterventionType,
    historicalEvidenceN: input.historicalEvidenceN,
    historicalCompletionRatePct: input.historicalCompletionRatePct,
    frictionReductionPct: input.frictionReductionPct,
    rationale: input.rationale,
    status: "PENDING_SUPERVISOR_REVIEW",
    createdAt: new Date().toISOString(),
  };

  inMemoryGovernanceProposals.set(proposal.id, proposal);

  await recordAuditEvent({
    tenantId: session.tenantId,
    actorId: session.userId,
    actorEmail: session.email,
    actorRole: session.role,
    action: "POLICY_GOVERNANCE_PROPOSAL_SUBMITTED",
    entityType: "PolicyGovernanceProposal",
    entityId: proposal.id,
    summary: `Submitted advisory policy proposal '${input.proposalType}' for barrier '${input.targetBarrierCategory}' based on N=${input.historicalEvidenceN} outcomes.`,
    metadata: {
      proposalId: proposal.id,
      governanceStatus: "PENDING_SUPERVISOR_REVIEW",
      advisoryOnly: true,
      prohibitsAutonomousMutation: true,
    },
  });

  return proposal;
}

export async function reviewPolicyGovernanceProposal(
  session: SessionUser,
  proposalId: string,
  review: {
    decision: "APPROVE" | "REJECT";
    clinicalNotes: string;
  }
): Promise<PolicyGovernanceProposal> {
  // STRICT INVARIANT: Non-supervisors and automated agents CANNOT approve policy mutations
  assertNoAutonomousPolicyMutation(session.role);

  const proposal = inMemoryGovernanceProposals.get(proposalId);
  if (!proposal || proposal.tenantId !== session.tenantId) {
    throw new NotFoundError("PolicyGovernanceProposal", proposalId);
  }

  if (proposal.status !== "PENDING_SUPERVISOR_REVIEW") {
    throw new ValidationError(`Proposal ${proposalId} has already been finalized as '${proposal.status}'.`);
  }

  proposal.status = review.decision === "APPROVE" ? "APPROVED" : "REJECTED";
  proposal.reviewedById = session.userId;
  proposal.reviewedByRole = session.role;
  proposal.reviewedAt = new Date().toISOString();
  proposal.reviewNotes = review.clinicalNotes;

  await recordAuditEvent({
    tenantId: session.tenantId,
    actorId: session.userId,
    actorEmail: session.email,
    actorRole: session.role,
    action: review.decision === "APPROVE" ? "POLICY_GOVERNANCE_PROPOSAL_APPROVED" : "POLICY_GOVERNANCE_PROPOSAL_REJECTED",
    entityType: "PolicyGovernanceProposal",
    entityId: proposal.id,
    summary: `Human supervisor (${session.name ?? session.email}) finalized policy proposal as ${proposal.status}: ${review.clinicalNotes}`,
    metadata: {
      proposalId: proposal.id,
      decision: review.decision,
      clinicalNotes: review.clinicalNotes,
      reviewedByRole: session.role,
    },
  });

  return proposal;
}

export function listPolicyGovernanceProposals(tenantId: string): PolicyGovernanceProposal[] {
  return Array.from(inMemoryGovernanceProposals.values()).filter((p) => p.tenantId === tenantId);
}

