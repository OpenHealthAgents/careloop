import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { runAutomatedReminders } from "@/services/communication-orchestration-service";

const RunRemindersSchema = z.object({
  withinHours: z.number().int().min(1).max(168).optional(),
});

export async function POST(request: Request) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "cases.manage");
    const raw = await request.json().catch(() => ({}));
    const body = RunRemindersSchema.parse(raw);
    const summary = await runAutomatedReminders({
      session,
      withinHours: body.withinHours,
      correlationId,
    });
    return NextResponse.json(summary);
  } catch (err) {
    return toErrorResponse(err);
  }
}
