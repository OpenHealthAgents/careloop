import { NextResponse } from "next/server";
import { CohortDimension } from "@/domain/equity/analytics";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { getHealthEquityAnalytics } from "@/services/analytics-service";

function parseCohortSelector(
  raw: string | null
): { dimension: CohortDimension; value: string } | undefined {
  if (!raw || !raw.includes("::")) return undefined;
  const [dim, value] = raw.split("::");
  if (!dim || !value) return undefined;
  return { dimension: dim as CohortDimension, value };
}

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "equity.read");
    const url = new URL(request.url);
    const data = await getHealthEquityAnalytics(session.tenantId, {
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      compareA: parseCohortSelector(url.searchParams.get("compareA")),
      compareB: parseCohortSelector(url.searchParams.get("compareB")),
    });
    return NextResponse.json(data);
  } catch (err) {
    return toErrorResponse(err);
  }
}
