import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "appointments.read");
    const appointments = await prisma.appointment.findMany({
      where: { tenantId: session.tenantId },
      include: {
        member: {
          select: {
            id: true,
            externalMemberId: true,
            firstName: true,
            lastName: true,
            preferredLanguage: true,
            consentSms: true,
          },
        },
        provider: {
          select: {
            id: true,
            name: true,
            specialty: true,
            availabilitySource: true,
          },
        },
        careCase: {
          select: {
            id: true,
            status: true,
            referral: { select: { externalReferralId: true } },
          },
        },
        verifications: true,
      },
      orderBy: { scheduledStartAt: "desc" },
      take: 250,
    });

    return NextResponse.json({ appointments });
  } catch (err) {
    return toErrorResponse(err);
  }
}
