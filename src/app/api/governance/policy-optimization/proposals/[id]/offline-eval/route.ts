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
    const result = await policyOptimizationService.runOfflineEvaluation(session, id);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
