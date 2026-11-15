import { recordAuditEvent } from "@/services/audit-service";
import type { AuditEvent, AuditLogger } from "./contracts";

export * from "./contracts";
export * from "./complete-audit-system";
export { recordAuditEvent } from "@/services/audit-service";
export {
  mapToolToJournalEventType,
  recordExecutionEvent,
} from "@/services/execution-journal-service";
export { recordAIDecisionTrace } from "@/services/decision-trace-service";

export class CareLoopAuditLogger implements AuditLogger {
  async log(event: AuditEvent): Promise<unknown> {
    return recordAuditEvent({
      tenantId: event.tenantId,
      actorId: event.actorId ?? null,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      summary: event.summary ?? `${event.action} on ${event.entityType} (${event.entityId})`,
      correlationId: event.correlationId ?? null,
      metadata: event.metadata,
    });
  }
}

export const careLoopAuditLogger = new CareLoopAuditLogger();
