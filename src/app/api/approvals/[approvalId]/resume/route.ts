import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { resumeAgentFromApproval } from "@/services/approval-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ approvalId: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "ai.run");
    const { approvalId } = await context.params;
    const result = await resumeAgentFromApproval({
      session,
      approvalId,
      correlationId,
    });
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
