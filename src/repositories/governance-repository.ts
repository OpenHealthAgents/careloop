import { BarrierCategory, NotificationStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { redactSensitiveFields, sanitizeAuditText } from "@/lib/logger";

export const governanceRepository = {
  async listRolesForTenant(tenantId: string) {
    return prisma.role.findMany({
      where: { OR: [{ tenantId: null }, { tenantId }] },
      orderBy: { code: "asc" },
    });
  },

  async findUserByEmail(tenantId: string, email: string) {
    return prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: email.toLowerCase() } },
      include: { roleEntity: true },
    });
  },

  async recordAuditEvent(input: {
    tenantId: string;
    actorId?: string | null;
    actorEmail?: string | null;
    actorRole?: UserRole | string | null;
    action: string;
    entityType: string;
    entityId: string;
    previousState?: Record<string, unknown> | null;
    newState?: Record<string, unknown> | null;
    source?: string | null;
    correlationId?: string | null;
    summary: string;
    metadata?: Record<string, unknown>;
  }) {
    const sanitizedMeta = input.metadata
      ? (redactSensitiveFields(input.metadata) as Prisma.InputJsonValue)
      : undefined;
    const sanitizedPrev = input.previousState
      ? (redactSensitiveFields(input.previousState) as Prisma.InputJsonValue)
      : undefined;
    const sanitizedNext = input.newState
      ? (redactSensitiveFields(input.newState) as Prisma.InputJsonValue)
      : undefined;

    return prisma.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        previousState: sanitizedPrev,
        newState: sanitizedNext,
        source: input.source ?? "API",
        correlationId: input.correlationId ?? null,
        summary: sanitizeAuditText(input.summary),
        metadata: sanitizedMeta,
      },
    });
  },

  async listAuditEvents(
    tenantId: string,
    filters?: { entityType?: string; action?: string; limit?: number }
  ) {
    return prisma.auditEvent.findMany({
      where: {
        tenantId,
        ...(filters?.entityType ? { entityType: filters.entityType } : {}),
        ...(filters?.action ? { action: { contains: filters.action, mode: "insensitive" } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: filters?.limit ?? 150,
    });
  },

  async saveEquityMetric(input: {
    tenantId: string;
    cohortDimension: string;
    cohortValue: string;
    periodStart: Date;
    periodEnd: Date;
    totalReferrals: number;
    completedVisits: number;
    completionRatePct: number;
    avgTimeToCareDays: number | null;
    disparityGapPctPoints: number;
    topBarrierCategory?: BarrierCategory | null;
  }) {
    return prisma.equityMetric.create({ data: input });
  },

  async listEquityMetrics(tenantId: string) {
    return prisma.equityMetric.findMany({
      where: { tenantId },
      orderBy: [{ computedAt: "desc" }, { cohortDimension: "asc" }],
    });
  },

  async createNotification(input: {
    tenantId: string;
    recipientUserId?: string;
    caseId?: string;
    appointmentId?: string;
    channel?: string;
    notificationType: string;
    title: string;
    message: string;
    status?: NotificationStatus;
  }) {
    return prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        recipientUserId: input.recipientUserId ?? null,
        caseId: input.caseId ?? null,
        appointmentId: input.appointmentId ?? null,
        channel: input.channel ?? "IN_APP",
        notificationType: input.notificationType,
        title: input.title,
        message: input.message,
        status: input.status ?? NotificationStatus.PENDING,
      },
    });
  },

  async markNotificationRead(tenantId: string, notificationId: string) {
    const existing = await prisma.notification.findFirst({
      where: { id: notificationId, tenantId },
    });
    if (!existing) throw new NotFoundError("Notification", notificationId);
    return prisma.notification.update({
      where: { id: existing.id },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
  },
};
