import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { ControlledDeploymentRequestSchema } from "@/domain/policy-optimization";
import { policyOptimizationService } from "@/services/policy-optimization-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");
    const { id } = await params;
    const body = await request.json();
    const parsed = ControlledDeploymentRequestSchema.parse(body);

    const deployment = await policyOptimizationService.deployControlledRollout(session, id, {
      phase: parsed.phase,
      trafficAllocationPct: parsed.trafficAllocationPct,
      targetTenants: parsed.targetTenants,
      targetCohorts: parsed.targetCohorts,
      triggers: parsed.automatedRollbackTriggers,
    });

    return NextResponse.json(deployment);
  } catch (err) {
    return toErrorResponse(err);
  }
}
