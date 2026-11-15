import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { getAgentEvaluationReport } from "@/services/evaluation-service";

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "analytics.read");
    const evaluation = await getAgentEvaluationReport(session);
    return NextResponse.json({ evaluation });
  } catch (err) {
    return toErrorResponse(err);
  }
}
