import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { recordAuditEvent } from "./audit-service";

export interface TenantRetentionPolicy {
  auditLogRetentionDays: number;
  clinicalOperationalRetentionDays: number;
  aiTraceRetentionDays: number;
  communicationRetentionDays: number;
  sessionMaxAgeHours: number;
}

export const DEFAULT_RETENTION_POLICY: TenantRetentionPolicy = {
  auditLogRetentionDays: 2555,
  clinicalOperationalRetentionDays: 2555,
  aiTraceRetentionDays: 1095,
  communicationRetentionDays: 1095,
  sessionMaxAgeHours: 12,
};

export async function getTenantRetentionPolicy(tenantId: string): Promise<TenantRetentionPolicy> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, settings: true },
  });
  if (!tenant) {
    throw new NotFoundError("Tenant", tenantId);
  }

  const settings = (tenant.settings as Record<string, unknown>) ?? {};
  const asPositiveInt = (val: unknown, fallback: number) =>
    typeof val === "number" && Number.isFinite(val) && val > 0 ? Math.floor(val) : fallback;

  return {
    auditLogRetentionDays: asPositiveInt(
      settings.auditLogRetentionDays,
      DEFAULT_RETENTION_POLICY.auditLogRetentionDays
    ),
    clinicalOperationalRetentionDays: asPositiveInt(
      settings.clinicalOperationalRetentionDays,
      DEFAULT_RETENTION_POLICY.clinicalOperationalRetentionDays
    ),
    aiTraceRetentionDays: asPositiveInt(
      settings.aiTraceRetentionDays,
      DEFAULT_RETENTION_POLICY.aiTraceRetentionDays
    ),
    communicationRetentionDays: asPositiveInt(
      settings.communicationRetentionDays,
      DEFAULT_RETENTION_POLICY.communicationRetentionDays
    ),
    sessionMaxAgeHours: asPositiveInt(
      settings.sessionMaxAgeHours,
      DEFAULT_RETENTION_POLICY.sessionMaxAgeHours
    ),
  };
}

/**
 * Enforces the tenant's configured retention policy across expired sessions,
 * AI decision traces, telemetry spans, and old communications while keeping
 * immutable AuditEvents for the full auditLogRetentionDays window.
 */
export async function enforceTenantRetentionPolicy(params: {
  session: SessionUser;
  dryRun?: boolean;
  correlationId?: string;
}) {
  requirePermission(params.session, PERMISSIONS.TENANT_MANAGE);

  const policy = await getTenantRetentionPolicy(params.session.tenantId);
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;

  const aiTraceCutoff = new Date(now.getTime() - policy.aiTraceRetentionDays * msPerDay);
  const commCutoff = new Date(now.getTime() - policy.communicationRetentionDays * msPerDay);
  const sessionCutoff = new Date(now.getTime() - policy.sessionMaxAgeHours * 60 * 60 * 1000);

  if (params.dryRun) {
    const [expiredSessions, expiredAiTraces, expiredToolSpans, expiredAgentRuns, expiredComms] =
      await Promise.all([
        prisma.userSession.count({
          where: {
            tenantId: params.session.tenantId,
            OR: [{ expiresAt: { lte: now } }, { createdAt: { lte: sessionCutoff } }],
          },
        }),
        prisma.aIDecisionTrace.count({
          where: { tenantId: params.session.tenantId, createdAt: { lt: aiTraceCutoff } },
        }),
        prisma.toolExecutionSpan.count({
          where: { tenantId: params.session.tenantId, createdAt: { lt: aiTraceCutoff } },
        }),
        prisma.agentRun.count({
          where: { tenantId: params.session.tenantId, createdAt: { lt: aiTraceCutoff } },
        }),
        prisma.communication.count({
          where: { tenantId: params.session.tenantId, createdAt: { lt: commCutoff } },
        }),
      ]);

    return {
      dryRun: true,
      policy,
      counts: {
        expiredSessions,
        expiredAiTraces,
        expiredToolSpans,
        expiredAgentRuns,
        expiredComms,
      },
    };
  }

  const [sessionsRes, tracesRes, spansRes, runsRes, commsRes] = await Promise.all([
    prisma.userSession.deleteMany({
      where: {
        tenantId: params.session.tenantId,
        OR: [{ expiresAt: { lte: now } }, { createdAt: { lte: sessionCutoff } }],
      },
    }),
    prisma.aIDecisionTrace.deleteMany({
      where: { tenantId: params.session.tenantId, createdAt: { lt: aiTraceCutoff } },
    }),
    prisma.toolExecutionSpan.deleteMany({
      where: { tenantId: params.session.tenantId, createdAt: { lt: aiTraceCutoff } },
    }),
    prisma.agentRun.deleteMany({
      where: { tenantId: params.session.tenantId, createdAt: { lt: aiTraceCutoff } },
    }),
    prisma.communication.deleteMany({
      where: { tenantId: params.session.tenantId, createdAt: { lt: commCutoff } },
    }),
  ]);

  const counts = {
    expiredSessions: sessionsRes.count,
    expiredAiTraces: tracesRes.count,
    expiredToolSpans: spansRes.count,
    expiredAgentRuns: runsRes.count,
    expiredComms: commsRes.count,
  };

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "RETENTION_POLICY_ENFORCED",
    entityType: "Tenant",
    entityId: params.session.tenantId,
    source: "RETENTION_ENGINE",
    correlationId: params.correlationId,
    summary: "Enforced tenant configurable retention policy",
    metadata: {
      policy,
      purgedCounts: counts,
    },
  });

  return {
    dryRun: false,
    policy,
    counts,
  };
}
