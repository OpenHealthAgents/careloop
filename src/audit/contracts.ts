export interface AuditEvent {
  id?: string;
  tenantId: string;
  actorId?: string | null;
  actorType?: "USER" | "AGENT" | "SYSTEM";
  action: string;
  entityType: string;
  entityId: string;
  summary?: string;
  correlationId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface AuditLogger {
  log(event: AuditEvent): Promise<unknown>;
}
