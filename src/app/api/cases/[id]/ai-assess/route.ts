import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { runCaseAIAssessment } from "@/services/case-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "ai.run");
    const { id } = await context.params;
    const result = await runCaseAIAssessment({
      tenantId: session.tenantId,
      caseId: id,
      actor: session,
      correlationId,
    });
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
