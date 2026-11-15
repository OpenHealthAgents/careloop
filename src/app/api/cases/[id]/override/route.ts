import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { overrideAgentRecommendation } from "@/services/case-service";

const OverrideSchema = z.object({
  recommendationId: z.string().optional(),
  overrideAction: z.string().trim().min(2).max(160),
  rationale: z.string().trim().min(3).max(1000),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "cases.manage");
    const { id } = await context.params;
    const body = OverrideSchema.parse(await request.json());

    const result = await overrideAgentRecommendation({
      session,
      caseId: id,
      recommendationId: body.recommendationId,
      overrideAction: body.overrideAction,
      rationale: body.rationale,
      correlationId,
    });

    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
