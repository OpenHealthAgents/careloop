import { CaseStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/rbac";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { transitionCaseStatus } from "@/services/case-service";

const TransitionSchema = z.object({
  toStatus: z.nativeEnum(CaseStatus),
  reason: z.string().min(3),
  escalationReason: z.string().optional(),
  closureReason: z.string().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "cases.manage");
    const { id } = await context.params;
    const body = TransitionSchema.parse(await request.json());

    if (body.toStatus === CaseStatus.ESCALATED) {
      requirePermission(session, "cases.escalate");
    }

    const updated = await transitionCaseStatus({
      session,
      caseId: id,
      toStatus: body.toStatus,
      reason: body.reason,
      escalationReason: body.escalationReason,
      closureReason: body.closureReason,
      correlationId,
    });

    return NextResponse.json({ careCase: updated });
  } catch (err) {
    return toErrorResponse(err);
  }
}
