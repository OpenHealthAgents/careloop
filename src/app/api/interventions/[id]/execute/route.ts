import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { executeAutomatedIntervention } from "@/services/case-service";

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

    const intervention = await executeAutomatedIntervention({
      session,
      interventionId: id,
      correlationId,
    });

    return NextResponse.json({ intervention });
  } catch (err) {
    return toErrorResponse(err);
  }
}
