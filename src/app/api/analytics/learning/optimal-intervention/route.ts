import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { findOptimalInterventionWithLeastFriction } from "@/services/learning-loop-service";
import { OptimalInterventionQuery } from "@/domain/learning/learning-system";

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "analytics.read");
    const url = new URL(request.url);

    const barrierCategory = url.searchParams.get("barrierCategory") ?? "SOCIAL_LOGISTICAL";
    const subBarrierCode = url.searchParams.get("subBarrierCode") ?? undefined;
    const coverageType = url.searchParams.get("coverageType") ?? undefined;
    const preferredLanguage = url.searchParams.get("preferredLanguage") ?? undefined;
    const urbanicity = url.searchParams.get("urbanicity") ?? undefined;

    const query: OptimalInterventionQuery = {
      barrierCategory,
      subBarrierCode,
      context: {
        coverageType,
        preferredLanguage,
        urbanicity,
      },
    };

    const result = await findOptimalInterventionWithLeastFriction(session, query);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "analytics.read");
    const body = await request.json();

    const query: OptimalInterventionQuery = {
      barrierCategory: body.barrierCategory ?? "SOCIAL_LOGISTICAL",
      subBarrierCode: body.subBarrierCode,
      context: body.context ?? {},
    };

    const result = await findOptimalInterventionWithLeastFriction(session, query);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
