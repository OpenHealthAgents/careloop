import { CommunicationMessageType, ReadingLevel } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { generateAndSendOutreach } from "@/services/case-service";

const PurposeSchema = z.union([
  z.nativeEnum(CommunicationMessageType),
  z.enum([
    "INITIAL_OUTREACH",
    "SCHEDULING_ASSIST",
    "APPOINTMENT_REMINDER",
    "MISSED_VISIT_FOLLOWUP",
    "COVERAGE_CLARIFICATION",
  ]),
]);

const OutreachSchema = z.object({
  channel: z.enum(["SMS", "PHONE", "EMAIL", "PORTAL"]).default("SMS"),
  purpose: PurposeSchema.default("REFERRAL_NOTIFICATION"),
  readingLevel: z.nativeEnum(ReadingLevel).default(ReadingLevel.PLAIN),
  interventionId: z.string().optional(),
  customMessage: z.string().optional(),
  sendImmediately: z.boolean().default(false),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");
    const { id } = await context.params;
    const exists = await prisma.case.findFirst({
      where: { id, tenantId: session.tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundError("Case", id);

    const communications = await prisma.communication.findMany({
      where: { caseId: id, tenantId: session.tenantId },
      include: {
        intervention: { select: { id: true, type: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ communications });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "outreach.send");
    const { id } = await context.params;
    const body = OutreachSchema.parse(await request.json());

    const result = await generateAndSendOutreach({
      session,
      caseId: id,
      channel: body.channel,
      purpose: body.purpose,
      readingLevel: body.readingLevel,
      interventionId: body.interventionId,
      customMessage: body.customMessage,
      sendImmediately: body.sendImmediately,
      correlationId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
