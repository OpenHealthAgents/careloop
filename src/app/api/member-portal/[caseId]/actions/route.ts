import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import {
  confirmMemberAppointment,
  escalateMemberToHuman,
  optOutMemberOutreach,
  rescheduleMemberAppointment,
  selectMemberProvider,
  sendMemberReminder,
  submitMemberSchedulingRequest,
  submitMemberSupportRequest,
  updateMemberPreferences,
} from "@/services/member-portal-service";

const MemberActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SELECT_PROVIDER"),
    providerId: z.string().min(1),
  }),
  z.object({
    action: z.literal("REQUEST_APPOINTMENT"),
    providerId: z.string().min(1),
    slotId: z.string().optional(),
    requestedStartAt: z.string().datetime(),
    modality: z.enum(["TELEHEALTH", "IN_PERSON"]),
  }),
  z.object({
    action: z.literal("RESCHEDULE_APPOINTMENT"),
    appointmentId: z.string().min(1),
    newSlotId: z.string().optional(),
    requestedStartAt: z.string().datetime(),
    modality: z.enum(["TELEHEALTH", "IN_PERSON"]).optional(),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal("CONFIRM_APPOINTMENT"),
    appointmentId: z.string().min(1),
  }),
  z.object({
    action: z.literal("REQUEST_REMINDER"),
    appointmentId: z.string().min(1),
    channel: z.enum(["SMS", "PHONE", "EMAIL", "PORTAL"]),
  }),
  z.object({
    action: z.literal("UPDATE_PREFERENCES"),
    preferredLanguage: z.string().min(2).max(40),
    preferredContactChannel: z.enum(["SMS", "PHONE", "EMAIL", "PORTAL"]),
    consentSms: z.boolean(),
    consentOutreach: z.boolean(),
  }),
  z.object({
    action: z.literal("SUBMIT_SUPPORT"),
    kind: z.enum(["ASSISTANCE", "QUESTION"]),
    topic: z.string().min(2).max(80),
    message: z.string().trim().min(2).max(1000),
  }),
  z.object({
    action: z.literal("OPT_OUT"),
    reason: z.string().trim().max(240).optional(),
  }),
  z.object({
    action: z.literal("ESCALATE_TO_HUMAN"),
    topic: z.string().trim().min(2).max(80).optional(),
    message: z.string().trim().min(2).max(1000).optional(),
  }),
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "cases.manage");
    const { caseId } = await context.params;
    const body = MemberActionSchema.parse(await request.json());

    let portal;
    switch (body.action) {
      case "SELECT_PROVIDER":
        portal = await selectMemberProvider({
          session,
          caseId,
          providerId: body.providerId,
          correlationId,
        });
        break;
      case "REQUEST_APPOINTMENT":
        portal = await submitMemberSchedulingRequest({
          session,
          caseId,
          providerId: body.providerId,
          slotId: body.slotId,
          requestedStartAt: new Date(body.requestedStartAt),
          modality: body.modality,
          correlationId,
        });
        break;
      case "RESCHEDULE_APPOINTMENT":
        portal = await rescheduleMemberAppointment({
          session,
          caseId,
          appointmentId: body.appointmentId,
          newSlotId: body.newSlotId,
          requestedStartAt: new Date(body.requestedStartAt),
          modality: body.modality,
          reason: body.reason,
          correlationId,
        });
        break;
      case "CONFIRM_APPOINTMENT":
        portal = await confirmMemberAppointment({
          session,
          caseId,
          appointmentId: body.appointmentId,
          correlationId,
        });
        break;
      case "REQUEST_REMINDER":
        portal = await sendMemberReminder({
          session,
          caseId,
          appointmentId: body.appointmentId,
          channel: body.channel,
          correlationId,
        });
        break;
      case "UPDATE_PREFERENCES":
        portal = await updateMemberPreferences({
          session,
          caseId,
          preferredLanguage: body.preferredLanguage,
          preferredContactChannel: body.preferredContactChannel,
          consentSms: body.consentSms,
          consentOutreach: body.consentOutreach,
          correlationId,
        });
        break;
      case "SUBMIT_SUPPORT":
        portal = await submitMemberSupportRequest({
          session,
          caseId,
          kind: body.kind,
          topic: body.topic,
          message: body.message,
          correlationId,
        });
        break;
      case "OPT_OUT":
        portal = await optOutMemberOutreach({
          session,
          caseId,
          reason: body.reason,
          correlationId,
        });
        break;
      case "ESCALATE_TO_HUMAN":
        portal = await escalateMemberToHuman({
          session,
          caseId,
          topic: body.topic,
          message: body.message,
          correlationId,
        });
        break;
    }

    return NextResponse.json({ portal });
  } catch (err) {
    return toErrorResponse(err);
  }
}
