import { BarrierCategory } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidSubBarrier } from "@/domain/barriers/taxonomy";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { ValidationError } from "@/lib/errors";
import { reviewBarrier } from "@/services/case-service";

const ReviewBarrierSchema = z.object({
  action: z.enum(["ACCEPT", "REJECT", "MODIFY", "MARK_UNKNOWN"]),
  category: z.nativeEnum(BarrierCategory).optional(),
  subBarrier: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(
      request,
      PERMISSIONS.CASES_MANAGE
    );
    const { id } = await context.params;
    const body = ReviewBarrierSchema.parse(await request.json());

    if (body.action === "MODIFY") {
      if (!body.category || !body.subBarrier || !isValidSubBarrier(body.category, body.subBarrier)) {
        throw new ValidationError(
          "Valid canonical category and subBarrier are required when modifying a barrier"
        );
      }
    }

    const barrier = await reviewBarrier({
      session,
      barrierId: id,
      action: body.action,
      category: body.category,
      subBarrier: body.subBarrier,
      notes: body.notes,
      correlationId,
    });

    return NextResponse.json({ barrier });
  } catch (err) {
    return toErrorResponse(err);
  }
}
