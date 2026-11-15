import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { getCostAndPerformanceMetrics } from "@/services/cost-performance-service";

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "analytics.read");
    const metrics = await getCostAndPerformanceMetrics(session);
    return NextResponse.json({ metrics });
  } catch (err) {
    return toErrorResponse(err);
  }
}
