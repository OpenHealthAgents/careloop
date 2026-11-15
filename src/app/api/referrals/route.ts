import { NextResponse } from "next/server";
import { CsvReferralRowSchema } from "@/adapters/csv-referral-parser";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { prisma } from "@/lib/db";
import { createSingleReferral } from "@/services/ingestion-service";

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "referrals.read");
    const referrals = await prisma.referral.findMany({
      where: { tenantId: session.tenantId },
      include: {
        member: {
          select: {
            id: true,
            externalMemberId: true,
            firstName: true,
            lastName: true,
            preferredLanguage: true,
            geography: true,
            coverageType: true,
          },
        },
        careCase: {
          select: {
            id: true,
            status: true,
            riskLevel: true,
            priorityScore: true,
            primaryBarrierCategory: true,
            primaryBarrierCode: true,
            firstCompletedVisitAt: true,
          },
        },
      },
      orderBy: { referralDate: "desc" },
      take: 250,
    });

    return NextResponse.json({ referrals });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "referrals.manage");
    const body = CsvReferralRowSchema.parse(await request.json());
    const result = await createSingleReferral({ session, row: body, correlationId });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
