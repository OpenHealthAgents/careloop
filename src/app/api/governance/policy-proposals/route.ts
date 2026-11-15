import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import {
  listPolicyGovernanceProposals,
  submitPolicyGovernanceProposal,
} from "@/services/learning-loop-service";

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");
    const proposals = listPolicyGovernanceProposals(session.tenantId);
    return NextResponse.json({ proposals });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");
    const body = await request.json();

    const proposal = await submitPolicyGovernanceProposal(session, {
      proposalType: body.proposalType,
      targetBarrierCategory: body.targetBarrierCategory,
      recommendedInterventionType: body.recommendedInterventionType,
      historicalEvidenceN: body.historicalEvidenceN,
      historicalCompletionRatePct: body.historicalCompletionRatePct,
      frictionReductionPct: body.frictionReductionPct,
      rationale: body.rationale,
    });

    return NextResponse.json(proposal, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
