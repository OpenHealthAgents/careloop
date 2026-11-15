import { CaseStatus, RiskLevel } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { caseRepository } from "@/repositories/case-repository";

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status") as CaseStatus | null;
    const riskParam = url.searchParams.get("riskTier") as RiskLevel | null;
    const search = url.searchParams.get("search") ?? undefined;
    const assignedToId = url.searchParams.get("assignedToId") ?? undefined;
    const humanReviewOnly = url.searchParams.get("humanReviewOnly") === "true";

    const cases = await caseRepository.listByTenant(session.tenantId, {
      status: statusParam ?? undefined,
      riskLevel: riskParam ?? undefined,
      assignedToId,
      humanReviewOnly,
      search,
    });

    return NextResponse.json({ cases });
  } catch (err) {
    return toErrorResponse(err);
  }
}
