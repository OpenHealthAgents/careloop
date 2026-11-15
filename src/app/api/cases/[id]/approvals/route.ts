import { CaseStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { CaseOrchestratorToolSchema } from "@/ai";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { listCaseApprovals, requestHumanApproval } from "@/services/approval-service";

const RequestApprovalSchema = z.object({
  action: CaseOrchestratorToolSchema,
  reason: z.string().min(3),
  riskLevel: z.string().optional(),
  requestedBy: z.string().optional(),
  toolInput: z.record(z.unknown()).optional(),
  proposedNextState: z.nativeEnum(CaseStatus).nullable().optional(),
  expiresAt: z.string().datetime().optional(),
  idempotencyKey: z.string().optional(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");
    const { id } = await context.params;
    const approvals = await listCaseApprovals(session, id);
    return NextResponse.json({ approvals });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "ai.run");
    const { id } = await context.params;
    const body = RequestApprovalSchema.parse(await request.json());

    const approval = await requestHumanApproval({
      session,
      caseId: id,
      action: body.action,
      reason: body.reason,
      riskLevel: body.riskLevel,
      requestedBy: body.requestedBy,
      toolInput: body.toolInput,
      proposedNextState: body.proposedNextState ?? null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      idempotencyKey: body.idempotencyKey,
      correlationId,
    });

    return NextResponse.json({ approval }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
