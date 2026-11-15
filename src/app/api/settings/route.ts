import { NextResponse } from "next/server";
import { z } from "zod";
import { INTEGRATION_ADAPTER_REGISTRY } from "@/adapters/dev-adapters";
import { getPermissionsForRole, ROLE_LABELS } from "@/lib/auth/rbac";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { getConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import { recordAuditEvent } from "@/services/audit-service";

const UpdateSettingsSchema = z.object({
  autoTriageOnIngest: z.boolean().optional(),
  escalationRiskThreshold: z.number().int().min(40).max(95).optional(),
  slaHoursExpedited: z.number().int().min(4).max(72).optional(),
  slaHoursRoutine: z.number().int().min(24).max(240).optional(),
  auditLogRetentionDays: z.number().int().min(365).max(3650).optional(),
  clinicalOperationalRetentionDays: z.number().int().min(365).max(3650).optional(),
  aiTraceRetentionDays: z.number().int().min(90).max(3650).optional(),
  communicationRetentionDays: z.number().int().min(90).max(3650).optional(),
  sessionMaxAgeHours: z.number().int().min(1).max(24).optional(),
});

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "settings.read");
    const [tenant, users] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: session.tenantId } }),
      prisma.user.findMany({
        where: { tenantId: session.tenantId },
        select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
        orderBy: { role: "asc" },
      }),
    ]);

    const config = getConfig();
    const roleMatrix = Object.entries(ROLE_LABELS).map(([role, meta]) => ({
      role,
      ...meta,
      permissions: getPermissionsForRole(role),
    }));

    return NextResponse.json({
      tenant,
      users,
      aiConfig: {
        providerMode: config.AI_PROVIDER_MODE,
        modelName: config.AI_MODEL_NAME,
        externalKeyConfigured: Boolean(config.OPENAI_API_KEY),
      },
      retentionDefaults: {
        auditLogRetentionDays: 2555,
        clinicalOperationalRetentionDays: 2555,
        aiTraceRetentionDays: 1095,
        communicationRetentionDays: 1095,
        sessionMaxAgeHours: 12,
      },
      adapters: INTEGRATION_ADAPTER_REGISTRY,
      roleMatrix,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "tenant.manage");
    const body = UpdateSettingsSchema.parse(await request.json());

    const tenant = await prisma.tenant.findUnique({ where: { id: session.tenantId } });
    const currentSettings = (tenant?.settings as Record<string, unknown>) ?? {};
    const nextSettings = { ...currentSettings, ...body };

    const updated = await prisma.tenant.update({
      where: { id: session.tenantId },
      data: { settings: nextSettings },
    });

    const previousState = Object.fromEntries(
      Object.keys(body).map((key) => [key, currentSettings[key] ?? null])
    );

    await recordAuditEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "TENANT_SETTINGS_UPDATED",
      entityType: "Tenant",
      entityId: session.tenantId,
      source: "TENANT_ADMIN",
      previousState,
      newState: body,
      correlationId,
      summary: "Updated tenant operational thresholds, session policy & retention settings",
      metadata: body,
    });

    return NextResponse.json({ tenant: updated });
  } catch (err) {
    return toErrorResponse(err);
  }
}
