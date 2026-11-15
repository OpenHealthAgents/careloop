import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { recordInterventionOutcome } from "@/services/case-service";

const RecordOutcomeSchema = z.object({
  outcomeStatus: z.string().min(2),
  summary: z.string().min(3),
  barriersResolved: z.boolean().default(false),
  followUpRequired: z.boolean().default(false),
  notes: z.string().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(
      request,
      "interventions.execute"
    );
    const { id } = await context.params;
    const body = RecordOutcomeSchema.parse(await request.json());

    const outcome = await recordInterventionOutcome({
      session,
      interventionId: id,
      ...body,
      correlationId,
    });

    return NextResponse.json({ outcome }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
