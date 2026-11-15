import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import {
  getLearningInsights,
  recommendExecutionStrategy,
} from "@/services/learning-loop-service";

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "analytics.read");
    const url = new URL(request.url);
    const primaryBarrier = url.searchParams.get("barrier") ?? undefined;
    const urbanicity = url.searchParams.get("urbanicity") ?? undefined;
    const coverageType = url.searchParams.get("coverageType") ?? undefined;
    const preferredLanguage = url.searchParams.get("preferredLanguage") ?? undefined;

    const insights = await getLearningInsights(session, {
      primaryBarrier,
      urbanicity,
      coverageType,
    });

    const recommendations = primaryBarrier
      ? await recommendExecutionStrategy(session, {
          primaryBarrier,
          urbanicity,
          coverageType,
          preferredLanguage,
        })
      : null;

    return NextResponse.json({
      insights,
      recommendations,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
