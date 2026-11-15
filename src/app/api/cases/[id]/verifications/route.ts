import { VerificationSignalType, VerificationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { recordCompletionVerification } from "@/services/case-service";

const VerificationSchema = z.object({
  appointmentId: z.string().optional(),
  signalType: z.nativeEnum(VerificationSignalType),
  sourceSystem: z.string().min(2).default("CARELOOP_MANUAL_VERIFICATION"),
  evidenceNote: z.string().min(3),
  verificationStatus: z.nativeEnum(VerificationStatus).optional(),
  confidence: z.number().min(0).max(1).optional(),
  evidenceTimestamp: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), {
      message: "evidenceTimestamp must be a valid ISO date/time",
    })
    .optional(),
  closeCaseAfterVerify: z.boolean().default(false),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "completion.verify");
    const { id } = await context.params;
    const body = VerificationSchema.parse(await request.json());

    const verification = await recordCompletionVerification({
      session,
      caseId: id,
      appointmentId: body.appointmentId,
      signalType: body.signalType,
      sourceSystem: body.sourceSystem,
      evidenceNote: body.evidenceNote,
      verificationStatus: body.verificationStatus,
      confidence: body.confidence,
      evidenceTimestamp: body.evidenceTimestamp ? new Date(body.evidenceTimestamp) : undefined,
      closeCaseAfterVerify: body.closeCaseAfterVerify,
      correlationId,
    });

    return NextResponse.json({ verification }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
