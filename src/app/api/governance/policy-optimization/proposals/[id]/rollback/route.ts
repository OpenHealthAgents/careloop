import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { policyOptimizationService } from "@/services/policy-optimization-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : "Emergency human supervisory rollback initiated.";

    const proposal = await policyOptimizationService.triggerManualRollback(session, id, reason);
    return NextResponse.json(proposal);
  } catch (err) {
    return toErrorResponse(err);
  }
}
