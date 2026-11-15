import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { updateAppointmentStatus } from "@/services/case-service";

const UpdateAppointmentSchema = z.object({
  action: z.enum([
    "SEND_REMINDER",
    "SCHEDULE",
    "CONFIRM",
    "RESCHEDULE",
    "COMPLETE",
    "NO_SHOW",
    "CANCEL",
    "MARK_UNKNOWN",
  ]),
  channel: z.enum(["SMS", "PHONE", "EMAIL", "PORTAL"]).optional(),
  rescheduledStartAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), {
      message: "rescheduledStartAt must be a valid ISO date/time",
    })
    .optional(),
  modality: z.enum(["IN_PERSON", "TELEHEALTH"]).optional(),
  slotId: z.string().optional(),
  note: z.string().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "appointments.manage");
    const { id } = await context.params;
    const body = UpdateAppointmentSchema.parse(await request.json());

    const appointment = await updateAppointmentStatus({
      session,
      appointmentId: id,
      action: body.action,
      channel: body.channel,
      rescheduledStartAt: body.rescheduledStartAt ? new Date(body.rescheduledStartAt) : undefined,
      modality: body.modality,
      slotId: body.slotId,
      note: body.note,
      correlationId,
    });

    return NextResponse.json({ appointment });
  } catch (err) {
    return toErrorResponse(err);
  }
}
