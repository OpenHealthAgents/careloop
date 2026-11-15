import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { policyOptimizationService } from "@/services/policy-optimization-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");
    const { id } = await params;
    const proposal = await policyOptimizationService.publishPolicyVersion(session, id);
    return NextResponse.json(proposal);
  } catch (err) {
    return toErrorResponse(err);
  }
}
