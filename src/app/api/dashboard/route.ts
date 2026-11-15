import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { DashboardFilters, getDashboardAnalytics } from "@/services/analytics-service";

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "dashboard.read");
    const url = new URL(request.url);

    const popDim = url.searchParams.get("populationDimension") as
      | DashboardFilters["populationDimension"]
      | null;

    const filters: DashboardFilters = {
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      geography: url.searchParams.get("geography") ?? undefined,
      referralType: url.searchParams.get("referralType") ?? undefined,
      barrier: url.searchParams.get("barrier") ?? undefined,
      intervention: url.searchParams.get("intervention") ?? undefined,
      providerId: url.searchParams.get("providerId") ?? undefined,
      populationDimension: popDim ?? undefined,
      cohortValue: url.searchParams.get("cohortValue") ?? undefined,
    };

    const data = await getDashboardAnalytics(session.tenantId, filters);
    return NextResponse.json(data);
  } catch (err) {
    return toErrorResponse(err);
  }
}
