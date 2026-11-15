import { SessionUser } from "@/lib/auth/session";
import { governanceRepository } from "@/repositories/governance-repository";

export interface AuditRecordInput {
  tenantId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  source?: string | null;
  correlationId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}

export async function recordAuditEvent(input: AuditRecordInput) {
  return governanceRepository.recordAuditEvent(input);
}

export async function recordAccessEvent(params: {
  session: SessionUser;
  action: string;
  entityType: string;
  entityId: string;
  route: string;
  correlationId?: string | null;
  summary?: string;
}) {
  return governanceRepository.recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    source: "ACCESS_LOG",
    correlationId: params.correlationId,
    summary:
      params.summary ??
      `Authorized ${params.session.role} accessed ${params.entityType} (${params.route})`,
    metadata: { accessedRoute: params.route },
  });
}

export async function listAuditLogs(
  tenantId: string,
  filters?: { entityType?: string; action?: string; limit?: number }
) {
  return governanceRepository.listAuditEvents(tenantId, filters);
}
