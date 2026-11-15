import { BarrierCategory, InterventionType, Prisma } from "@prisma/client";
import { INTERVENTION_CATALOG } from "@/domain/interventions/catalog";
import {
  InterventionBarrierSignal,
  InterventionExperimentSpec,
  selectInterventionForBarrier,
} from "@/domain/interventions/selection-and-experiments";
import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { recordAuditEvent } from "./audit-service";
import { getCaseDetail } from "./case-service";

export interface PersistedInterventionExperiment {
  experimentId: string;
  spec: InterventionExperimentSpec;
  status: string;
  createdAt: string;
}

export interface InterventionEffectivenessRow {
  interventionType: InterventionType;
  barrierCategory: BarrierCategory | "UNSPECIFIED";
  totalExperiments: number;
  evaluatedExperiments: number;
  effectiveExperiments: number;
  barriersResolvedCount: number;
  effectivenessRate: number;
}

export interface InterventionEffectivenessReport {
  tenantId: string;
  totalExperiments: number;
  evaluatedExperiments: number;
  overallEffectivenessRate: number;
  byIntervention: InterventionEffectivenessRow[];
}

const EFFECTIVE_OUTCOME_STATUSES = new Set([
  "RESOLVED",
  "EFFECTIVE",
  "SUCCEEDED",
  "COMPLETED",
]);

export async function createInterventionExperiment(params: {
  session: SessionUser;
  caseId: string;
  barrier: InterventionBarrierSignal;
  subBarrier?: string;
  evidenceSignals?: string[];
  correlationId?: string;
}): Promise<PersistedInterventionExperiment> {
  requirePermission(params.session, PERMISSIONS.INTERVENTIONS_EXECUTE);

  const careCase = await getCaseDetail(params.session.tenantId, params.caseId);
  const spec = selectInterventionForBarrier({
    caseId: careCase.id,
    barrier: params.barrier,
    subBarrier: params.subBarrier,
  });

  const catalogItem = INTERVENTION_CATALOG[spec.interventionType];
  const isHighRisk =
    catalogItem.isHighRiskByDefault || careCase.riskLevel === "HIGH";

  const created = await prisma.intervention.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: careCase.id,
      type: spec.interventionType,
      reason: spec.hypothesis,
      triggeringBarrierCategory: spec.barrierCategory,
      triggeringBarrierCode: spec.subBarrier ?? spec.barrier,
      recommendedAction: `${catalogItem.defaultAction} [tool=${spec.tool}]`,
      executionMode: catalogItem.executionMode,
      automationEligible: !isHighRisk && catalogItem.automationEligible,
      isHighRisk,
      requiredHumanInvolvement: catalogItem.requiredHumanInvolvement,
      expectedOutcome: spec.expectedOutcome,
      status: "RECOMMENDED",
      evidence: {
        experiment: true,
        tool: spec.tool,
        successMetric: spec.successMetric,
        hypothesis: spec.hypothesis,
        signals: params.evidenceSignals ?? [],
      } as Prisma.InputJsonValue,
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "INTERVENTION_EXPERIMENT_CREATED",
    entityType: "Intervention",
    entityId: created.id,
    correlationId: params.correlationId,
    summary: `Created intervention experiment '${spec.interventionType}' -> tool '${spec.tool}' for barrier '${spec.barrier}'`,
    metadata: {
      caseId: careCase.id,
      tool: spec.tool,
      barrier: spec.barrier,
      successMetric: spec.successMetric,
    },
  });

  return {
    experimentId: created.id,
    spec,
    status: created.status,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function recordExperimentOutcome(params: {
  session: SessionUser;
  interventionId: string;
  outcomeStatus: string;
  summary: string;
  barriersResolved: boolean;
  followUpRequired?: boolean;
  evidence?: unknown;
  correlationId?: string;
}) {
  requirePermission(params.session, PERMISSIONS.INTERVENTIONS_EXECUTE);

  const intervention = await prisma.intervention.findFirst({
    where: {
      id: params.interventionId,
      tenantId: params.session.tenantId,
    },
  });
  if (!intervention) {
    throw new NotFoundError("Intervention", params.interventionId);
  }

  const normalizedStatus = params.outcomeStatus.trim().toUpperCase();
  const isCompleted =
    params.barriersResolved || EFFECTIVE_OUTCOME_STATUSES.has(normalizedStatus);

  const outcome = await prisma.interventionOutcome.create({
    data: {
      tenantId: params.session.tenantId,
      interventionId: intervention.id,
      outcomeStatus: normalizedStatus,
      summary: params.summary,
      barriersResolved: params.barriersResolved,
      followUpRequired: params.followUpRequired ?? false,
      evidence: (params.evidence ?? {}) as Prisma.InputJsonValue,
      recordedById: params.session.userId,
    },
  });

  await prisma.intervention.update({
    where: { id: intervention.id },
    data: {
      status: isCompleted ? "COMPLETED" : "FAILED",
      completedAt: new Date(),
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "INTERVENTION_EXPERIMENT_OUTCOME_RECORDED",
    entityType: "InterventionOutcome",
    entityId: outcome.id,
    correlationId: params.correlationId,
    summary: `Recorded experiment outcome '${normalizedStatus}' (barriersResolved=${String(params.barriersResolved)}) for intervention ${intervention.id}`,
    metadata: {
      interventionId: intervention.id,
      caseId: intervention.caseId,
      outcomeStatus: normalizedStatus,
      barriersResolved: params.barriersResolved,
    },
  });

  return outcome;
}

export async function getInterventionEffectivenessMetrics(
  session: SessionUser,
  filters?: {
    interventionType?: InterventionType;
    barrierCategory?: BarrierCategory;
  }
): Promise<InterventionEffectivenessReport> {
  requirePermission(session, PERMISSIONS.ANALYTICS_READ);

  const rows = await prisma.intervention.findMany({
    where: {
      tenantId: session.tenantId,
      ...(filters?.interventionType ? { type: filters.interventionType } : {}),
      ...(filters?.barrierCategory
        ? { triggeringBarrierCategory: filters.barrierCategory }
        : {}),
    },
    include: {
      outcomes: {
        orderBy: { recordedAt: "desc" },
        take: 1,
      },
    },
  });

  const grouped = new Map<
    string,
    {
      interventionType: InterventionType;
      barrierCategory: BarrierCategory | "UNSPECIFIED";
      totalExperiments: number;
      evaluatedExperiments: number;
      effectiveExperiments: number;
      barriersResolvedCount: number;
    }
  >();

  let totalEvaluated = 0;
  let totalEffective = 0;

  for (const row of rows) {
    const barrierCategory = row.triggeringBarrierCategory ?? "UNSPECIFIED";
    const key = `${row.type}::${barrierCategory}`;
    const bucket = grouped.get(key) ?? {
      interventionType: row.type,
      barrierCategory,
      totalExperiments: 0,
      evaluatedExperiments: 0,
      effectiveExperiments: 0,
      barriersResolvedCount: 0,
    };

    bucket.totalExperiments += 1;
    const latestOutcome = row.outcomes[0];
    if (latestOutcome) {
      bucket.evaluatedExperiments += 1;
      totalEvaluated += 1;
      const isEffective =
        latestOutcome.barriersResolved ||
        EFFECTIVE_OUTCOME_STATUSES.has(latestOutcome.outcomeStatus.toUpperCase());
      if (isEffective) {
        bucket.effectiveExperiments += 1;
        totalEffective += 1;
      }
      if (latestOutcome.barriersResolved) {
        bucket.barriersResolvedCount += 1;
      }
    }

    grouped.set(key, bucket);
  }

  const byIntervention: InterventionEffectivenessRow[] = Array.from(grouped.values()).map(
    (b) => ({
      ...b,
      effectivenessRate:
        b.evaluatedExperiments > 0
          ? Number((b.effectiveExperiments / b.evaluatedExperiments).toFixed(4))
          : 0,
    })
  );

  return {
    tenantId: session.tenantId,
    totalExperiments: rows.length,
    evaluatedExperiments: totalEvaluated,
    overallEffectivenessRate:
      totalEvaluated > 0 ? Number((totalEffective / totalEvaluated).toFixed(4)) : 0,
    byIntervention,
  };
}
