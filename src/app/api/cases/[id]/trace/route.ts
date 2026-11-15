import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { getCaseExecutionTrace } from "@/services/observability-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");
    const { id } = await context.params;
    const trace = await getCaseExecutionTrace(session, id);
    return NextResponse.json({ trace });
  } catch (err) {
    return toErrorResponse(err);
  }
}
