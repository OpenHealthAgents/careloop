import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { listCaseExecutionJournal } from "@/services/execution-journal-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");
    const { id } = await context.params;
    const url = new URL(request.url);
    const eventType = url.searchParams.get("eventType") ?? undefined;
    const correlationId = url.searchParams.get("correlationId") ?? undefined;

    const events = await listCaseExecutionJournal(session, id, {
      eventType,
      correlationId,
    });

    return NextResponse.json({ events });
  } catch (err) {
    return toErrorResponse(err);
  }
}
