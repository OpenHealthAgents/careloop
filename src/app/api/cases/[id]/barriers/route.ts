import { BarrierCategory } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { confirmOrCorrectBarrier } from "@/services/case-service";

const BarrierConfirmSchema = z.object({
  category: z.nativeEnum(BarrierCategory),
  subBarrier: z.string().min(1),
  evidenceNote: z.string().min(3),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "cases.manage");
    const { id } = await context.params;
    const body = BarrierConfirmSchema.parse(await request.json());

    const barrier = await confirmOrCorrectBarrier({
      session,
      caseId: id,
      category: body.category,
      subBarrier: body.subBarrier,
      evidenceNote: body.evidenceNote,
      correlationId,
    });

    return NextResponse.json({ barrier }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
