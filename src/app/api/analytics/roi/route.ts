import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { getPayerRoiAnalytics } from "@/services/analytics-service";

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "dashboard.read");
    const report = await getPayerRoiAnalytics(session.tenantId);
    return NextResponse.json(report);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "dashboard.read");
    const customAssumptions = await request.json().catch(() => ({}));
    const report = await getPayerRoiAnalytics(session.tenantId, customAssumptions);
    return NextResponse.json(report);
  } catch (err) {
    return toErrorResponse(err);
  }
}
