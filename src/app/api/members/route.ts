import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { prisma } from "@/lib/db";
import { recordAccessEvent } from "@/services/audit-service";

export async function GET(request: Request) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "members.read");
    const members = await prisma.member.findMany({
      where: { tenantId: session.tenantId },
      include: {
        cases: {
          select: {
            id: true,
            status: true,
            riskLevel: true,
            priorityScore: true,
            firstCompletedVisitAt: true,
          },
        },
        referrals: {
          select: { id: true, externalReferralId: true, specialty: true, referralDate: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    });

    await recordAccessEvent({
      session,
      action: "MEMBER_DIRECTORY_VIEWED",
      entityType: "Member",
      entityId: "LIST",
      route: "/api/members",
      correlationId,
      summary: `Listed ${members.length} member records`,
    });

    return NextResponse.json({ members });
  } catch (err) {
    return toErrorResponse(err);
  }
}
