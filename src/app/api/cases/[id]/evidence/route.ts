import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { addCaseEvidence } from "@/services/case-service";

const EvidenceSchema = z.object({
  sourceType: z.string().trim().min(2).max(60),
  summary: z.string().trim().min(3).max(1000),
  payload: z.record(z.unknown()).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "cases.manage");
    const { id } = await context.params;
    const body = EvidenceSchema.parse(await request.json());

    const evidence = await addCaseEvidence({
      session,
      caseId: id,
      sourceType: body.sourceType,
      summary: body.summary,
      payload: body.payload,
      correlationId,
    });

    return NextResponse.json({ evidence }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
