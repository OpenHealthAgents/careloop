import { NextResponse } from "next/server";
import { CareLoopCaseOrchestrator } from "@/ai/orchestrator";
import { buildCaseMemory } from "@/domain/cases/case-memory";
import { getAllowedNextCaseStatuses } from "@/domain/cases/state-machine";
import { rankProvidersForReferral } from "@/domain/matching/provider-matcher";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { prisma } from "@/lib/db";
import { recordAccessEvent } from "@/services/audit-service";
import { getCaseDetail } from "@/services/case-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "cases.read");
    const { id } = await context.params;
    const careCase = await getCaseDetail(session.tenantId, id);

    await recordAccessEvent({
      session,
      action: "CASE_PHI_VIEWED",
      entityType: "Case",
      entityId: careCase.id,
      route: "/api/cases/[id]",
      correlationId,
      summary: `Viewed case detail ${careCase.id}`,
    });

    const providers = await prisma.provider.findMany({
      where: { tenantId: session.tenantId },
      include: { availabilities: { where: { status: "AVAILABLE" } } },
    });

    const rankedProviders = rankProvidersForReferral(
      providers.map((p) => ({ ...p, verifiedSlots: p.availabilities })),
      {
        referralSpecialty: careCase.referral.specialty,
        referralNetwork: careCase.referral.networkRequired,
        referralGeography: careCase.referral.geography,
        preferredLanguage: careCase.referral.preferredLanguage,
        digitalAccessLevel: careCase.member.digitalAccessLevel,
      }
    );

    const verifiedAvailableSlotsCount = providers.reduce(
      (sum, p) =>
        sum + p.availabilities.filter((s) => s.source === "VERIFIED_AVAILABILITY").length,
      0
    );
    const orchestratorDecision = CareLoopCaseOrchestrator.decideFromCase(careCase, {
      verifiedAvailableSlotsCount,
    });
    const caseMemory = buildCaseMemory(careCase);

    return NextResponse.json({
      careCase,
      rankedProviders,
      allowedNextStatuses: getAllowedNextCaseStatuses(careCase.status),
      orchestratorDecision,
      caseMemory,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
