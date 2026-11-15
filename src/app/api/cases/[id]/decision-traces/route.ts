import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { listCaseDecisionTraces } from "@/services/decision-trace-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");
    const { id } = await context.params;
    const url = new URL(request.url);
    const agent = url.searchParams.get("agent") ?? undefined;
    const correlationId = url.searchParams.get("correlationId") ?? undefined;

    const traces = await listCaseDecisionTraces(session, id, {
      agent,
      correlationId,
    });

    return NextResponse.json({ traces });
  } catch (err) {
    return toErrorResponse(err);
  }
}
