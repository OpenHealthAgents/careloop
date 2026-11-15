import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { recordCaseLearningOutcome } from "@/services/learning-loop-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requireRequestContext(request, "cases.manage");
    const { id } = await context.params;
    const record = await recordCaseLearningOutcome({
      tenantId: session.tenantId,
      caseId: id,
    });
    return NextResponse.json({ learningRecord: record });
  } catch (err) {
    return toErrorResponse(err);
  }
}
