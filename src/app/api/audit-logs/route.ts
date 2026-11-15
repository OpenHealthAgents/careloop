import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { listAuditLogs, recordAccessEvent } from "@/services/audit-service";

export async function GET(request: Request) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "audit.read");
    const url = new URL(request.url);
    const entityType = url.searchParams.get("entityType") ?? undefined;
    const action = url.searchParams.get("action") ?? undefined;
    const logs = await listAuditLogs(session.tenantId, { entityType, action, limit: 150 });
    await recordAccessEvent({
      session,
      action: "AUDIT_LOG_VIEWED",
      entityType: "AuditEvent",
      entityId: "LIST",
      route: "/api/audit-logs",
      correlationId,
      summary: `Viewed ${logs.length} audit log entries`,
    });
    return NextResponse.json({ logs });
  } catch (err) {
    return toErrorResponse(err);
  }
}
