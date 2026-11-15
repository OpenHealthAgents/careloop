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
    const body = await request.json().catch(() => ({}));
    const populationSize = typeof body.populationSize === "number" ? body.populationSize : 1000;

    const result = await policyOptimizationService.runSimulation(session, id, populationSize);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
