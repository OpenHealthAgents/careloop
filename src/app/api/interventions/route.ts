import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "interventions.read");
    const interventions = await prisma.intervention.findMany({
      where: { tenantId: session.tenantId },
      include: {
        careCase: {
          select: {
            id: true,
            status: true,
            riskLevel: true,
            priorityScore: true,
            referral: { select: { externalReferralId: true, specialty: true } },
            member: { select: { firstName: true, lastName: true, externalMemberId: true } },
          },
        },
        assignedOwner: { select: { id: true, name: true, role: true } },
        outcomes: {
          orderBy: { recordedAt: "desc" },
          include: {
            recordedBy: { select: { id: true, name: true, role: true } },
          },
        },
      },
      orderBy: [{ status: "asc" }, { recommendedAt: "desc" }],
      take: 250,
    });

    return NextResponse.json({ interventions });
  } catch (err) {
    return toErrorResponse(err);
  }
}
