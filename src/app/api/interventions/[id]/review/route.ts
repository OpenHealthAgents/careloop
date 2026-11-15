import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/rbac";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { reviewIntervention } from "@/services/case-service";

const ReviewInterventionSchema = z.object({
  decision: z.enum(["APPROVE", "MODIFY", "REJECT", "START", "COMPLETE", "FAIL"]),
  modifiedAction: z.string().optional(),
  outcome: z.string().optional(),
  outcomeStatus: z.string().optional(),
  barriersResolved: z.boolean().optional(),
  followUpRequired: z.boolean().optional(),
  notes: z.string().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "interventions.read");
    const { id } = await context.params;
    const body = ReviewInterventionSchema.parse(await request.json());

    if (body.decision === "APPROVE" || body.decision === "MODIFY" || body.decision === "REJECT") {
      requirePermission(session, "interventions.approve");
    } else {
      requirePermission(session, "interventions.execute");
    }

    const updated = await reviewIntervention({
      session,
      interventionId: id,
      ...body,
      correlationId,
    });

    return NextResponse.json({ intervention: updated });
  } catch (err) {
    return toErrorResponse(err);
  }
}
