import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { CreatePolicyProposalSchema } from "@/domain/policy-optimization";
import { policyOptimizationService } from "@/services/policy-optimization-service";

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");
    const proposals = policyOptimizationService.listProposals(session.tenantId);
    return NextResponse.json({ proposals, count: proposals.length });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");
    const body = await request.json();
    const parsed = CreatePolicyProposalSchema.parse(body);

    const proposal = await policyOptimizationService.createProposal(session, {
      title: parsed.title,
      description: parsed.description,
      scope: parsed.scope,
      baselinePolicyVersion: parsed.baselinePolicyVersion,
      proposedRules: parsed.proposedRules,
      parameterAdjustments: parsed.parameterAdjustments,
      expectedBenefitsRationale: parsed.expectedBenefitsRationale,
      isAiGenerated: parsed.isAiGenerated,
    });

    return NextResponse.json(proposal, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
