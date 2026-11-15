import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { scheduleAppointmentForCase } from "@/services/case-service";

const ScheduleAppointmentSchema = z.object({
  providerId: z.string().min(1),
  slotId: z.string().optional(),
  scheduledStartAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "scheduledStartAt must be a valid ISO date/time",
  }),
  modality: z.enum(["IN_PERSON", "TELEHEALTH"]).default("TELEHEALTH"),
  initialStatus: z.enum(["REQUESTED", "SCHEDULED"]).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "appointments.manage");
    const { id } = await context.params;
    const body = ScheduleAppointmentSchema.parse(await request.json());

    const appointment = await scheduleAppointmentForCase({
      session,
      caseId: id,
      providerId: body.providerId,
      slotId: body.slotId,
      scheduledStartAt: new Date(body.scheduledStartAt),
      modality: body.modality,
      initialStatus: body.initialStatus,
      correlationId,
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
