import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import {
  cancelHumanApproval,
  decideHumanApproval,
  resumeAgentFromApproval,
} from "@/services/approval-service";

const DecideApprovalSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "CANCELLED"]),
  comments: z.string().optional(),
  resumeImmediately: z.boolean().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ approvalId: string }> }
) {
  try {
    const { approvalId } = await context.params;
    const body = DecideApprovalSchema.parse(await request.json());

    if (body.decision === "CANCELLED") {
      const { session, correlationId } = await requireRequestContext(request, "cases.manage");
      const approval = await cancelHumanApproval({
        session,
        approvalId,
        comments: body.comments,
        correlationId,
      });
      return NextResponse.json({ approval });
    }

    const { session, correlationId } = await requireRequestContext(request, "ai.review");
    const approval = await decideHumanApproval({
      session,
      approvalId,
      decision: body.decision,
      comments: body.comments,
      correlationId,
    });

    if (body.decision === "APPROVED" && body.resumeImmediately) {
      const resumed = await resumeAgentFromApproval({
        session,
        approvalId,
        correlationId,
      });
      return NextResponse.json(resumed);
    }

    return NextResponse.json({ approval });
  } catch (err) {
    return toErrorResponse(err);
  }
}
