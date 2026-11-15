import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { HumanReviewSubmissionSchema } from "@/domain/policy-optimization";
import { policyOptimizationService } from "@/services/policy-optimization-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");
    const { id } = await params;
    const body = await request.json();
    const parsed = HumanReviewSubmissionSchema.parse(body);

    const result = await policyOptimizationService.submitHumanReview(session, id, {
      decision: parsed.decision,
      clinicalJustification: parsed.clinicalJustification,
      independentPeerReviewerId: parsed.independentPeerReviewerId,
    });

    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
