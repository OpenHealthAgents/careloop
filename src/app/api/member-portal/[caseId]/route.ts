import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { recordAccessEvent } from "@/services/audit-service";
import { getMemberPortalView } from "@/services/member-portal-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ caseId: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "cases.read");
    const { caseId } = await context.params;
    const portal = await getMemberPortalView(session.tenantId, caseId);
    await recordAccessEvent({
      session,
      action: "MEMBER_PORTAL_PHI_VIEWED",
      entityType: "Case",
      entityId: caseId,
      route: "/api/member-portal/[caseId]",
      correlationId,
      summary: `Viewed member portal view for case ${caseId}`,
    });
    return NextResponse.json({ portal });
  } catch (err) {
    return toErrorResponse(err);
  }
}
