import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { getVersionProvenanceForTrace } from "@/services/version-service";

interface RouteParams {
  params: Promise<{ traceId: string }>;
}

export async function GET(request: Request, context: RouteParams) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");
    const { traceId } = await context.params;

    const result = await getVersionProvenanceForTrace(traceId, session);

    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
