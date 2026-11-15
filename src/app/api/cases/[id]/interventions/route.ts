import { BarrierCategory, InterventionType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { createManualIntervention } from "@/services/case-service";

const CreateInterventionSchema = z.object({
  type: z.nativeEnum(InterventionType),
  reason: z.string().min(3),
  recommendedAction: z.string().min(3),
  triggeringBarrierCategory: z.nativeEnum(BarrierCategory).optional(),
  triggeringBarrierCode: z.string().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "interventions.approve");
    const { id } = await context.params;
    const body = CreateInterventionSchema.parse(await request.json());

    const intervention = await createManualIntervention({
      session,
      caseId: id,
      ...body,
      correlationId,
    });

    return NextResponse.json({ intervention }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
