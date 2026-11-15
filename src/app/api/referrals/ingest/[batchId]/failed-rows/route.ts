import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { recordAccessEvent } from "@/services/audit-service";
import { exportFailedRowsCsv } from "@/services/ingestion-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ batchId: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(request, PERMISSIONS.REFERRALS_READ);
    const { batchId } = await context.params;
    const report = await exportFailedRowsCsv(session.tenantId, batchId);

    await recordAccessEvent({
      session,
      action: "INGEST_FAILED_ROWS_EXPORTED",
      entityType: "ReferralImportBatch",
      entityId: batchId,
      route: "/api/referrals/ingest/[batchId]/failed-rows",
      correlationId,
      summary: `Exported failed ingestion rows CSV (${report.fileName})`,
    });

    return new NextResponse(report.csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${report.fileName}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
