import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { reviewPolicyGovernanceProposal } from "@/services/learning-loop-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Requires supervisor-level permissions
    const { session } = await requireRequestContext(request, "cases.manage");
    const { id } = await params;
    const body = await request.json();

    const finalized = await reviewPolicyGovernanceProposal(session, id, {
      decision: body.decision,
      clinicalNotes: body.clinicalNotes,
    });

    return NextResponse.json(finalized);
  } catch (err) {
    return toErrorResponse(err);
  }
}
