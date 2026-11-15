import {
  AgentRunStatus,
  AppointmentStatus,
  CaseStatus,
  CommunicationChannel,
  CommunicationMessageType,
  DeliveryStatus,
  NotificationStatus,
  ReadingLevel,
  ReferralStatus,
  WorkflowEventType,
} from "@prisma/client";
import { createDefaultCommunicationDispatcher } from "@/adapters/communication/channel-registry";
import { SupportedCommunicationChannel } from "@/adapters/contracts";
import { canTransitionCaseStatus } from "@/domain/cases/state-machine";
import { rankProvidersForReferral } from "@/domain/matching/provider-matcher";
import { canTransitionReferralStatus } from "@/domain/referrals/state-machine";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { providerRepository } from "@/repositories/provider-repository";
import { recordAuditEvent } from "./audit-service";

const dispatcher = createDefaultCommunicationDispatcher();

export interface MemberPortalProviderOption {
  id: string;
  name: string;
  organizationName: string;
  specialty: string;
  languages: string[];
  geography: string;
  telehealthAvailable: boolean;
  acceptingNewPatients: boolean;
  isSelected: boolean;
  hasAvailableThisWeek: boolean;
  availabilityMessage: string;
  highlights: string[];
  openAppointmentOptions: Array<{
    id: string;
    slotStartAt: string;
    slotEndAt: string;
    modality: string;
  }>;
}

export interface MemberPortalAppointmentItem {
  id: string;
  providerId: string;
  providerName: string;
  organizationName: string;
  scheduledStartAt: string;
  modality: string;
  status: AppointmentStatus;
  plainStatusLabel: string;
  reminderSentAt: string | null;
  reminderChannel: string | null;
  confirmedAt: string | null;
}

export interface MemberPortalView {
  caseId: string;
  referralCode: string;
  referralDate: string;
  serviceNeeded: string;
  insurancePlan: string;
  careCoordinatorName: string;
  member: {
    firstName: string;
    preferredLanguage: string;
    preferredContactChannel: string;
    consentSms: boolean;
    consentOutreach: boolean;
    geography: string;
  };
  referralNotification: {
    headline: string;
    subtext: string;
    matchingProviderCount: number;
    availableThisWeekCount: number;
  };
  selectedProviderId: string | null;
  providerChoices: MemberPortalProviderOption[];
  appointments: MemberPortalAppointmentItem[];
  messages: Array<{
    id: string;
    direction: string;
    channel: string;
    language: string;
    summary: string;
    deliveryStatus: string;
    createdAt: string;
  }>;
  supportedChannels: Array<{
    channel: SupportedCommunicationChannel;
    displayName: string;
  }>;
}

function toPlainAppointmentStatus(status: AppointmentStatus, language: string): string {
  const isEs = language.toLowerCase().startsWith("span");
  switch (status) {
    case "PROPOSED":
    case "REQUESTED":
      return isEs ? "Solicitud enviada — confirmando horario" : "Requested — confirming clinic time";
    case "SCHEDULED":
      return isEs ? "Programada — pendiente de confirmación" : "Scheduled — ready to confirm";
    case "CONFIRMED":
      return isEs ? "Confirmada" : "Confirmed";
    case "COMPLETED":
      return isEs ? "Visita completada" : "Visit completed";
    case "RESCHEDULED":
      return isEs ? "Reprogramada" : "Rescheduled";
    case "CANCELLED":
      return isEs ? "Cancelada" : "Cancelled";
    case "NO_SHOW":
      return isEs ? "Necesita nueva fecha" : "Needs new appointment time";
    case "UNKNOWN":
    default:
      return isEs ? "Verificando estado de su cita" : "Checking appointment details";
  }
}

function formatNotificationHeadline(params: {
  language: string;
  serviceNeeded: string;
  insurancePlan: string;
  matchingCount: number;
  thisWeekCount: number;
}): { headline: string; subtext: string } {
  const isEs = params.language.toLowerCase().startsWith("span");
  if (isEs) {
    return {
      headline: `Usted fue referido a atención de salud conductual (${params.serviceNeeded}). Encontramos ${params.matchingCount} proveedores cerca de usted que aceptan su seguro (${params.insurancePlan}). ${params.thisWeekCount} tienen citas disponibles esta semana.`,
      subtext:
        "Elija un proveedor y horario que funcione para usted, actualice cómo prefiere comunicarse o envíenos una pregunta en cualquier momento.",
    };
  }

  return {
    headline: `You were referred to behavioral healthcare (${params.serviceNeeded}). We found ${params.matchingCount} providers near you who accept your insurance (${params.insurancePlan}). ${params.thisWeekCount} currently have appointments available this week.`,
    subtext:
      "Choose a provider and time that fits your schedule, update how you would like reminders, or send us a question anytime.",
  };
}

function sanitizeMemberMessage(rawSummary: string): string {
  // Never show internal workflow tags or technical identifiers to members.
  return rawSummary
    .replace(/SCHEDULING_ASSIST/g, "Scheduling update")
    .replace(/APPOINTMENT_REMINDER/g, "Appointment reminder")
    .replace(/INITIAL_OUTREACH/g, "Welcome & referral support")
    .replace(/MISSED_VISIT_FOLLOWUP/g, "Follow-up & rebooking support")
    .replace(/COVERAGE_CLARIFICATION/g, "Insurance & coverage info")
    .replace(/\[.*?\]\s*/g, "");
}

export async function getMemberPortalView(
  tenantId: string,
  caseId: string
): Promise<MemberPortalView> {
  const careCase = await prisma.case.findFirst({
    where: { id: caseId, tenantId },
    select: {
      id: true,
      matchedProviderId: true,
      referral: {
        select: {
          externalReferralId: true,
          referralDate: true,
          behavioralHealthNeed: true,
          specialty: true,
          geography: true,
          networkRequired: true,
          preferredLanguage: true,
        },
      },
      member: {
        select: {
          id: true,
          firstName: true,
          preferredLanguage: true,
          preferredContactChannel: true,
          consentSms: true,
          consentOutreach: true,
          geography: true,
          digitalAccessLevel: true,
        },
      },
      assignedTo: {
        select: { name: true },
      },
      appointments: {
        orderBy: { scheduledStartAt: "desc" },
        select: {
          id: true,
          providerId: true,
          scheduledStartAt: true,
          modality: true,
          status: true,
          reminderSentAt: true,
          reminderChannel: true,
          confirmedAt: true,
          provider: {
            select: {
              name: true,
              organizationName: true,
            },
          },
        },
      },
      communications: {
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true,
          direction: true,
          channel: true,
          language: true,
          messageSummary: true,
          deliveryStatus: true,
          createdAt: true,
        },
      },
    },
  });

  if (!careCase) throw new NotFoundError("Case", caseId);

  const providers = await providerRepository.listWithAvailabilities(tenantId);
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 86_400_000);

  const ranked = rankProvidersForReferral(
    providers.map((p) => ({ ...p, verifiedSlots: p.availabilities })),
    {
      referralSpecialty: careCase.referral.specialty,
      behavioralHealthNeed: careCase.referral.behavioralHealthNeed,
      referralNetwork: careCase.referral.networkRequired,
      referralGeography: careCase.referral.geography,
      preferredLanguage: careCase.member.preferredLanguage,
      digitalAccessLevel: careCase.member.digitalAccessLevel,
      now,
    }
  );

  // Filter out clearly incompatible out-of-network choices unless no local options exist
  const matching = ranked.filter((r) =>
    r.provider.networkNames.some(
      (n) => n.toLowerCase() === careCase.referral.networkRequired.toLowerCase()
    )
  );
  const candidatePool = matching.length > 0 ? matching : ranked.slice(0, 5);

  const isSpanish = careCase.member.preferredLanguage.toLowerCase().startsWith("span");

  const providerChoices: MemberPortalProviderOption[] = candidatePool.map((item) => {
    const rawProvider = providers.find((p) => p.id === item.provider.id);
    const verifiedSlots = (rawProvider?.availabilities ?? []).filter(
      (s) => s.status === "AVAILABLE" && s.slotStartAt >= now
    );
    const hasAvailableThisWeek =
      item.availabilityLabel === "VERIFIED AVAILABILITY" &&
      verifiedSlots.some((s) => s.slotStartAt <= sevenDaysFromNow);

    const highlights: string[] = [];
    if (
      item.provider.networkNames.some(
        (n) => n.toLowerCase() === careCase.referral.networkRequired.toLowerCase()
      )
    ) {
      highlights.push(isSpanish ? "Acepta su seguro" : "Accepts your insurance");
    }
    if (
      item.provider.languages.some(
        (l) => l.toLowerCase() === careCase.member.preferredLanguage.toLowerCase()
      )
    ) {
      highlights.push(
        isSpanish
          ? `Habla ${careCase.member.preferredLanguage}`
          : `Speaks ${careCase.member.preferredLanguage}`
      );
    }
    if (item.provider.telehealthAvailable) {
      highlights.push(isSpanish ? "Citas por video disponibles" : "Video visits available");
    }
    if (item.provider.acceptingNewPatients) {
      highlights.push(isSpanish ? "Aceptando nuevos pacientes" : "Accepting new patients");
    }

    const availabilityMessage =
      item.availabilityLabel === "VERIFIED AVAILABILITY" && verifiedSlots.length > 0
        ? isSpanish
          ? `${verifiedSlots.length} horario(s) abierto(s) disponible(s) para reservar`
          : `${verifiedSlots.length} confirmed appointment time(s) available to request`
        : item.availabilityLabel === "NOT AVAILABLE"
          ? isSpanish
            ? "Actualmente sin espacios para nuevos pacientes"
            : "Not accepting new appointments right now"
          : isSpanish
            ? "Nuestro equipo confirmará disponibilidad directamente con la clínica"
            : "Care team will confirm current openings with this office for you";

    return {
      id: item.provider.id,
      name: item.provider.name,
      organizationName: item.provider.organizationName,
      specialty: item.provider.specialty,
      languages: item.provider.languages,
      geography: item.provider.geography,
      telehealthAvailable: item.provider.telehealthAvailable,
      acceptingNewPatients: item.provider.acceptingNewPatients,
      isSelected: careCase.matchedProviderId === item.provider.id,
      hasAvailableThisWeek,
      availabilityMessage,
      highlights,
      openAppointmentOptions:
        item.availabilityLabel === "VERIFIED AVAILABILITY"
          ? verifiedSlots.slice(0, 6).map((slot) => ({
              id: slot.id,
              slotStartAt: slot.slotStartAt.toISOString(),
              slotEndAt: slot.slotEndAt.toISOString(),
              modality: slot.modality,
            }))
          : [],
    };
  });

  const thisWeekCount = providerChoices.filter((p) => p.hasAvailableThisWeek).length;
  const { headline, subtext } = formatNotificationHeadline({
    language: careCase.member.preferredLanguage,
    serviceNeeded: careCase.referral.behavioralHealthNeed,
    insurancePlan: careCase.referral.networkRequired,
    matchingCount: providerChoices.length,
    thisWeekCount,
  });

  return {
    caseId: careCase.id,
    referralCode: careCase.referral.externalReferralId,
    referralDate: careCase.referral.referralDate.toISOString(),
    serviceNeeded: careCase.referral.behavioralHealthNeed,
    insurancePlan: careCase.referral.networkRequired,
    careCoordinatorName: careCase.assignedTo?.name ?? "CareLoop Care Coordination Team",
    member: {
      firstName: careCase.member.firstName,
      preferredLanguage: careCase.member.preferredLanguage,
      preferredContactChannel: careCase.member.preferredContactChannel,
      consentSms: careCase.member.consentSms,
      consentOutreach: careCase.member.consentOutreach,
      geography: careCase.member.geography,
    },
    referralNotification: {
      headline,
      subtext,
      matchingProviderCount: providerChoices.length,
      availableThisWeekCount: thisWeekCount,
    },
    selectedProviderId: careCase.matchedProviderId,
    providerChoices,
    appointments: careCase.appointments.map((appt) => ({
      id: appt.id,
      providerId: appt.providerId,
      providerName: appt.provider.name,
      organizationName: appt.provider.organizationName,
      scheduledStartAt: appt.scheduledStartAt.toISOString(),
      modality: appt.modality,
      status: appt.status,
      plainStatusLabel: toPlainAppointmentStatus(
        appt.status,
        careCase.member.preferredLanguage
      ),
      reminderSentAt: appt.reminderSentAt?.toISOString() ?? null,
      reminderChannel: appt.reminderChannel,
      confirmedAt: appt.confirmedAt?.toISOString() ?? null,
    })),
    messages: careCase.communications.map((comm) => ({
      id: comm.id,
      direction: comm.direction,
      channel: comm.channel,
      language: comm.language,
      summary: sanitizeMemberMessage(comm.messageSummary),
      deliveryStatus: comm.deliveryStatus,
      createdAt: comm.createdAt.toISOString(),
    })),
    supportedChannels: dispatcher
      .listSupportedChannels()
      .map((c) => ({ channel: c.channel, displayName: c.displayName })),
  };
}

export async function selectMemberProvider(params: {
  session: SessionUser;
  caseId: string;
  providerId: string;
  correlationId?: string;
}) {
  const careCase = await prisma.case.findFirst({
    where: { id: params.caseId, tenantId: params.session.tenantId },
    include: { member: true },
  });
  if (!careCase) throw new NotFoundError("Case", params.caseId);

  const provider = await prisma.provider.findFirst({
    where: { id: params.providerId, tenantId: params.session.tenantId },
  });
  if (!provider) throw new NotFoundError("Provider", params.providerId);

  await prisma.case.update({
    where: { id: careCase.id },
    data: { matchedProviderId: provider.id },
  });

  await prisma.communication.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: careCase.id,
      memberId: careCase.memberId,
      channel: CommunicationChannel.PORTAL,
      direction: "INBOUND",
      language: careCase.member.preferredLanguage,
      draftedByAi: false,
      messageSummary: `Member selected provider: ${provider.name} (${provider.organizationName})`,
      deliveryStatus: DeliveryStatus.DELIVERED,
      sentAt: new Date(),
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "MEMBER_PROVIDER_SELECTED",
    entityType: "Case",
    entityId: careCase.id,
    correlationId: params.correlationId,
    summary: `Member selected provider ${provider.name} on case ${careCase.id}`,
    metadata: { providerId: provider.id },
  });

  return getMemberPortalView(params.session.tenantId, careCase.id);
}

export async function submitMemberSchedulingRequest(params: {
  session: SessionUser;
  caseId: string;
  providerId: string;
  slotId?: string;
  requestedStartAt: Date;
  modality: "TELEHEALTH" | "IN_PERSON";
  correlationId?: string;
}) {
  const careCase = await prisma.case.findFirst({
    where: { id: params.caseId, tenantId: params.session.tenantId },
    include: { member: true, referral: true },
  });
  if (!careCase) throw new NotFoundError("Case", params.caseId);

  const provider = await prisma.provider.findFirst({
    where: { id: params.providerId, tenantId: params.session.tenantId },
  });
  if (!provider) throw new NotFoundError("Provider", params.providerId);
  if (!provider.acceptingNewPatients || provider.availabilitySource === "NOT_AVAILABLE") {
    throw new ValidationError("Selected provider is currently not accepting new appointments.");
  }

  let bookingStatus: AppointmentStatus = AppointmentStatus.PROPOSED;
  let availabilitySourceAtBooking = provider.availabilitySource;
  let scheduledTime = params.requestedStartAt;

  if (params.slotId) {
    const slot = await providerRepository.reserveAvailability(
      params.session.tenantId,
      provider.id,
      params.slotId
    );
    scheduledTime = slot.slotStartAt;
    availabilitySourceAtBooking = "VERIFIED_AVAILABILITY";
    bookingStatus = AppointmentStatus.SCHEDULED;
  }

  const appt = await prisma.$transaction(async (tx) => {
    const created = await tx.appointment.create({
      data: {
        tenantId: params.session.tenantId,
        caseId: careCase.id,
        memberId: careCase.memberId,
        providerId: provider.id,
        scheduledStartAt: scheduledTime,
        modality: params.modality,
        status: bookingStatus,
        availabilitySourceAtBooking,
      },
    });

    const targetStatus = CaseStatus.APPOINTMENT_SCHEDULED;
    if (canTransitionCaseStatus(careCase.status, targetStatus)) {
      await tx.case.update({
        where: { id: careCase.id },
        data: { status: targetStatus, matchedProviderId: provider.id },
      });
      await tx.workflowEvent.create({
        data: {
          tenantId: params.session.tenantId,
          caseId: careCase.id,
          eventType: WorkflowEventType.APPOINTMENT_SCHEDULED,
          fromStatus: careCase.status,
          toStatus: targetStatus,
          actorId: params.session.userId,
          actorRole: params.session.role,
          reason: `Member requested ${params.modality} appointment with ${provider.name}`,
        },
      });
    } else {
      await tx.case.update({
        where: { id: careCase.id },
        data: { matchedProviderId: provider.id },
      });
    }

    if (canTransitionReferralStatus(careCase.referral.status, ReferralStatus.APPOINTMENT_SCHEDULED)) {
      await tx.referral.update({
        where: { id: careCase.referralId },
        data: { status: ReferralStatus.APPOINTMENT_SCHEDULED },
      });
    }

    return created;
  });

  const channel = (careCase.member.preferredContactChannel as SupportedCommunicationChannel) || "PORTAL";
  const canUseChannel =
    channel === "PORTAL" ||
    (channel === "SMS" ? careCase.member.consentSms : careCase.member.consentOutreach);

  const dispatchChannel: SupportedCommunicationChannel = canUseChannel ? channel : "PORTAL";
  const confirmationText =
    bookingStatus === "SCHEDULED"
      ? `Appointment scheduled with ${provider.name} for ${scheduledTime.toLocaleString()} (${params.modality}).`
      : `Appointment request received for ${provider.name} around ${scheduledTime.toLocaleString()} (${params.modality}). Our team will confirm the time with the office.`;

  const dispatch = await dispatcher.sendMessage({
    channel: dispatchChannel,
    language: careCase.member.preferredLanguage,
    subject: "Your Appointment Request",
    messageBody: confirmationText,
    consentVerified: true,
  });

  await prisma.communication.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: careCase.id,
      memberId: careCase.memberId,
      channel: dispatchChannel as CommunicationChannel,
      messageType: CommunicationMessageType.APPOINTMENT_CONFIRMATION,
      templateKey: "scheduling_request.plain",
      recipient: `${careCase.member.firstName} (${dispatchChannel})`,
      direction: "OUTBOUND",
      language: careCase.member.preferredLanguage,
      readingLevel: ReadingLevel.PLAIN,
      draftedByAi: false,
      internalAiLabel: "HUMAN_AUTHORED",
      content: confirmationText,
      messageSummary: confirmationText,
      deliveryStatus: dispatch.deliveryStatus as DeliveryStatus,
      deliveryMode: dispatch.deliveryMode,
      externalMessageId: dispatch.externalMessageId ?? null,
      sentAt: dispatch.dispatched ? new Date() : null,
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "MEMBER_SCHEDULING_REQUESTED",
    entityType: "Appointment",
    entityId: appt.id,
    correlationId: params.correlationId,
    summary: `Member submitted scheduling request with ${provider.name} (${bookingStatus})`,
    metadata: { providerId: provider.id, slotId: params.slotId ?? null, modality: params.modality },
  });

  return getMemberPortalView(params.session.tenantId, careCase.id);
}

export async function rescheduleMemberAppointment(params: {
  session: SessionUser;
  caseId: string;
  appointmentId: string;
  newSlotId?: string;
  requestedStartAt: Date;
  modality?: "TELEHEALTH" | "IN_PERSON";
  reason?: string;
  correlationId?: string;
}) {
  const appt = await prisma.appointment.findFirst({
    where: { id: params.appointmentId, caseId: params.caseId, tenantId: params.session.tenantId },
    include: { provider: true, careCase: { include: { member: true } } },
  });
  if (!appt) throw new NotFoundError("Appointment", params.appointmentId);

  let nextStart = params.requestedStartAt;
  let nextSource = appt.provider.availabilitySource;
  let nextStatus: AppointmentStatus = AppointmentStatus.PROPOSED;

  if (params.newSlotId) {
    const slot = await providerRepository.reserveAvailability(
      params.session.tenantId,
      appt.providerId,
      params.newSlotId
    );
    nextStart = slot.slotStartAt;
    nextSource = "VERIFIED_AVAILABILITY";
    nextStatus = AppointmentStatus.SCHEDULED;
  }

  const nextModality = params.modality ?? appt.modality;

  const replacement = await prisma.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id: appt.id },
      data: {
        status: AppointmentStatus.RESCHEDULED,
        cancellationReason: params.reason ?? "Member requested a new time",
      },
    });

    const created = await tx.appointment.create({
      data: {
        tenantId: params.session.tenantId,
        caseId: appt.caseId,
        memberId: appt.memberId,
        providerId: appt.providerId,
        scheduledStartAt: nextStart,
        modality: nextModality,
        status: nextStatus,
        availabilitySourceAtBooking: nextSource,
      },
    });

    await tx.workflowEvent.create({
      data: {
        tenantId: params.session.tenantId,
        caseId: appt.caseId,
        eventType: WorkflowEventType.STATUS_TRANSITION,
        fromStatus: appt.careCase.status,
        toStatus: appt.careCase.status,
        actorId: params.session.userId,
        actorRole: params.session.role,
        reason: `Member rescheduled appointment with ${appt.provider.name} to ${nextStart.toISOString()}`,
      },
    });

    return created;
  });

  await dispatcher.sendMessage({
    channel: "PORTAL",
    language: appt.careCase.member.preferredLanguage,
    messageBody: `Rescheduling update: requested new time ${nextStart.toLocaleString()} with ${appt.provider.name}.`,
    consentVerified: true,
  });

  await prisma.communication.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: appt.caseId,
      memberId: appt.memberId,
      channel: CommunicationChannel.PORTAL,
      direction: "OUTBOUND",
      language: appt.careCase.member.preferredLanguage,
      draftedByAi: false,
      messageSummary: `Appointment rescheduled to ${nextStart.toLocaleString()} with ${appt.provider.name}.`,
      deliveryStatus: DeliveryStatus.DELIVERED,
      sentAt: new Date(),
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "MEMBER_APPOINTMENT_RESCHEDULED",
    entityType: "Appointment",
    entityId: replacement.id,
    correlationId: params.correlationId,
    summary: `Member rescheduled appointment ${appt.id} -> ${replacement.id}`,
  });

  return getMemberPortalView(params.session.tenantId, params.caseId);
}

export async function confirmMemberAppointment(params: {
  session: SessionUser;
  caseId: string;
  appointmentId: string;
  correlationId?: string;
}) {
  const appt = await prisma.appointment.findFirst({
    where: { id: params.appointmentId, caseId: params.caseId, tenantId: params.session.tenantId },
    include: { provider: true, careCase: { include: { member: true } } },
  });
  if (!appt) throw new NotFoundError("Appointment", params.appointmentId);

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id: appt.id },
      data: {
        status: AppointmentStatus.CONFIRMED,
        confirmedAt: now,
      },
    });

    if (canTransitionCaseStatus(appt.careCase.status, CaseStatus.APPOINTMENT_CONFIRMED)) {
      await tx.case.update({
        where: { id: appt.caseId },
        data: { status: CaseStatus.APPOINTMENT_CONFIRMED },
      });
      await tx.workflowEvent.create({
        data: {
          tenantId: params.session.tenantId,
          caseId: appt.caseId,
          eventType: WorkflowEventType.APPOINTMENT_CONFIRMED,
          fromStatus: appt.careCase.status,
          toStatus: CaseStatus.APPOINTMENT_CONFIRMED,
          actorId: params.session.userId,
          actorRole: params.session.role,
          reason: `Member confirmed appointment with ${appt.provider.name}`,
        },
      });
    }
  });

  await prisma.communication.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: appt.caseId,
      memberId: appt.memberId,
      channel: CommunicationChannel.PORTAL,
      messageType: CommunicationMessageType.APPOINTMENT_CONFIRMATION,
      templateKey: "appointment_confirmation.plain",
      recipient: `${appt.careCase.member.firstName} (PORTAL)`,
      direction: "INBOUND",
      language: appt.careCase.member.preferredLanguage,
      readingLevel: ReadingLevel.PLAIN,
      draftedByAi: false,
      internalAiLabel: "HUMAN_AUTHORED",
      content: `Member confirmed appointment with ${appt.provider.name} for ${appt.scheduledStartAt.toLocaleString()}.`,
      messageSummary: `Member confirmed appointment with ${appt.provider.name} for ${appt.scheduledStartAt.toLocaleString()}.`,
      deliveryStatus: DeliveryStatus.DELIVERED,
      deliveryMode: "MOCK",
      sentAt: now,
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "MEMBER_APPOINTMENT_CONFIRMED",
    entityType: "Appointment",
    entityId: appt.id,
    correlationId: params.correlationId,
    summary: `Member confirmed appointment ${appt.id} with ${appt.provider.name}`,
  });

  return getMemberPortalView(params.session.tenantId, params.caseId);
}

export async function sendMemberReminder(params: {
  session: SessionUser;
  caseId: string;
  appointmentId: string;
  channel: SupportedCommunicationChannel;
  correlationId?: string;
}) {
  const appt = await prisma.appointment.findFirst({
    where: { id: params.appointmentId, caseId: params.caseId, tenantId: params.session.tenantId },
    include: { provider: true, careCase: { include: { member: true } } },
  });
  if (!appt) throw new NotFoundError("Appointment", params.appointmentId);

  const member = appt.careCase.member;
  const consentVerified =
    params.channel === "PORTAL"
      ? true
      : params.channel === "SMS"
        ? member.consentSms && member.consentOutreach
        : member.consentOutreach;

  const isSpanish = member.preferredLanguage.toLowerCase().startsWith("span");
  const reminderText = isSpanish
    ? `Recordatorio amable: su cita con ${appt.provider.name} está programada para el ${appt.scheduledStartAt.toLocaleString()} (${appt.modality}).`
    : `Friendly reminder: your appointment with ${appt.provider.name} is set for ${appt.scheduledStartAt.toLocaleString()} (${appt.modality}).`;

  const result = await dispatcher.sendMessage({
    channel: params.channel,
    language: member.preferredLanguage,
    subject: isSpanish ? "Recordatorio de su cita" : "Appointment Reminder",
    messageBody: reminderText,
    consentVerified,
  });

  if (!result.dispatched) {
    throw new ValidationError(result.reason ?? "Reminder could not be dispatched on this channel.");
  }

  const now = new Date();
  await prisma.appointment.update({
    where: { id: appt.id },
    data: {
      reminderSentAt: now,
      reminderChannel: params.channel,
    },
  });

  await prisma.communication.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: appt.caseId,
      memberId: appt.memberId,
      channel: params.channel as CommunicationChannel,
      messageType: CommunicationMessageType.APPOINTMENT_REMINDER,
      templateKey: "appointment_reminder.plain",
      recipient: `${member.firstName} (${params.channel})`,
      direction: "OUTBOUND",
      language: member.preferredLanguage,
      readingLevel: ReadingLevel.PLAIN,
      draftedByAi: false,
      internalAiLabel: "HUMAN_AUTHORED",
      content: reminderText,
      messageSummary: reminderText,
      deliveryStatus: result.deliveryStatus as DeliveryStatus,
      deliveryMode: result.deliveryMode,
      externalMessageId: result.externalMessageId ?? null,
      sentAt: now,
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "MEMBER_REMINDER_DISPATCHED",
    entityType: "Appointment",
    entityId: appt.id,
    correlationId: params.correlationId,
    summary: `Dispatched ${params.channel} appointment reminder in ${member.preferredLanguage}`,
  });

  return getMemberPortalView(params.session.tenantId, params.caseId);
}

export async function updateMemberPreferences(params: {
  session: SessionUser;
  caseId: string;
  preferredLanguage: string;
  preferredContactChannel: SupportedCommunicationChannel;
  consentSms: boolean;
  consentOutreach: boolean;
  correlationId?: string;
}) {
  const careCase = await prisma.case.findFirst({
    where: { id: params.caseId, tenantId: params.session.tenantId },
    select: { id: true, memberId: true },
  });
  if (!careCase) throw new NotFoundError("Case", params.caseId);

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: careCase.memberId },
      data: {
        preferredLanguage: params.preferredLanguage,
        preferredContactChannel: params.preferredContactChannel,
        consentSms: params.consentSms,
        consentOutreach: params.consentOutreach,
      },
    });

    await tx.consent.upsert({
      where: {
        tenantId_memberId_channel_purpose: {
          tenantId: params.session.tenantId,
          memberId: careCase.memberId,
          channel: CommunicationChannel.SMS,
          purpose: "SCHEDULING_AND_REMINDERS",
        },
      },
      update: {
        granted: params.consentSms,
        source: "MEMBER_PORTAL",
        grantedAt: params.consentSms ? now : undefined,
        revokedAt: params.consentSms ? null : now,
      },
      create: {
        tenantId: params.session.tenantId,
        memberId: careCase.memberId,
        channel: CommunicationChannel.SMS,
        purpose: "SCHEDULING_AND_REMINDERS",
        granted: params.consentSms,
        source: "MEMBER_PORTAL",
        grantedAt: now,
        revokedAt: params.consentSms ? null : now,
      },
    });

    await tx.consent.upsert({
      where: {
        tenantId_memberId_channel_purpose: {
          tenantId: params.session.tenantId,
          memberId: careCase.memberId,
          channel: CommunicationChannel.EMAIL,
          purpose: "SCHEDULING_AND_REMINDERS",
        },
      },
      update: {
        granted: params.consentOutreach,
        source: "MEMBER_PORTAL",
        grantedAt: params.consentOutreach ? now : undefined,
        revokedAt: params.consentOutreach ? null : now,
      },
      create: {
        tenantId: params.session.tenantId,
        memberId: careCase.memberId,
        channel: CommunicationChannel.EMAIL,
        purpose: "SCHEDULING_AND_REMINDERS",
        granted: params.consentOutreach,
        source: "MEMBER_PORTAL",
        grantedAt: now,
        revokedAt: params.consentOutreach ? null : now,
      },
    });
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "MEMBER_PREFERENCES_UPDATED",
    entityType: "Member",
    entityId: careCase.memberId,
    correlationId: params.correlationId,
    summary: `Updated member preferences: language=${params.preferredLanguage}, channel=${params.preferredContactChannel}, smsConsent=${params.consentSms}`,
  });

  return getMemberPortalView(params.session.tenantId, params.caseId);
}

export async function submitMemberSupportRequest(params: {
  session: SessionUser;
  caseId: string;
  kind: "ASSISTANCE" | "QUESTION";
  topic: string;
  message: string;
  correlationId?: string;
}) {
  const careCase = await prisma.case.findFirst({
    where: { id: params.caseId, tenantId: params.session.tenantId },
    include: { member: true },
  });
  if (!careCase) throw new NotFoundError("Case", params.caseId);

  const inbound = await prisma.communication.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: careCase.id,
      memberId: careCase.memberId,
      channel: CommunicationChannel.PORTAL,
      direction: "INBOUND",
      language: careCase.member.preferredLanguage,
      draftedByAi: false,
      messageSummary: `${params.kind === "ASSISTANCE" ? "Support Request" : "Question"} (${params.topic}): ${params.message}`,
      deliveryStatus: DeliveryStatus.RESPONDED,
      sentAt: new Date(),
    },
  });

  await prisma.notification.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: careCase.id,
      recipientUserId: careCase.assignedToId ?? null,
      channel: "IN_APP",
      notificationType:
        params.kind === "ASSISTANCE" ? "MEMBER_ASSISTANCE_REQUEST" : "MEMBER_QUESTION",
      title:
        params.kind === "ASSISTANCE"
          ? `Member asked for help (${params.topic})`
          : `Member asked a question (${params.topic})`,
      message: params.message,
      status: NotificationStatus.SENT,
      sentAt: new Date(),
    },
  });

  await prisma.caseNote.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: careCase.id,
      authorId: params.session.userId,
      category: "OUTREACH",
      content: `[Member Portal ${params.kind} — ${params.topic}]: ${params.message}`,
    },
  });

  const isSpanish = careCase.member.preferredLanguage.toLowerCase().startsWith("span");
  const autoAck = isSpanish
    ? "Gracias por escribirnos. Recibimos su mensaje y un coordinador de atención se pondrá en contacto pronto para ayudarle."
    : "Thank you for reaching out. We received your note and a care coordinator will follow up with you shortly to help.";

  await dispatcher.sendMessage({
    channel: "PORTAL",
    language: careCase.member.preferredLanguage,
    messageBody: autoAck,
    consentVerified: true,
  });

  await prisma.communication.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: careCase.id,
      memberId: careCase.memberId,
      channel: CommunicationChannel.PORTAL,
      direction: "OUTBOUND",
      language: careCase.member.preferredLanguage,
      draftedByAi: false,
      messageSummary: autoAck,
      deliveryStatus: DeliveryStatus.DELIVERED,
      sentAt: new Date(),
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: params.kind === "ASSISTANCE" ? "MEMBER_ASSISTANCE_REQUESTED" : "MEMBER_QUESTION_SUBMITTED",
    entityType: "Communication",
    entityId: inbound.id,
    correlationId: params.correlationId,
    summary: `Member submitted ${params.kind.toLowerCase()} on topic ${params.topic}`,
  });

  return getMemberPortalView(params.session.tenantId, params.caseId);
}

/**
 * Opt a member out of all automated outreach and reminders while keeping portal access open.
 */
export async function optOutMemberOutreach(params: {
  session: SessionUser;
  caseId: string;
  reason?: string;
  correlationId?: string;
}) {
  const careCase = await prisma.case.findFirst({
    where: { id: params.caseId, tenantId: params.session.tenantId },
    include: { member: true },
  });
  if (!careCase) throw new NotFoundError("Case", params.caseId);

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: careCase.memberId },
      data: {
        consentSms: false,
        consentOutreach: false,
        preferredContactChannel: CommunicationChannel.PORTAL,
      },
    });

    for (const channel of [CommunicationChannel.SMS, CommunicationChannel.EMAIL]) {
      await tx.consent.upsert({
        where: {
          tenantId_memberId_channel_purpose: {
            tenantId: params.session.tenantId,
            memberId: careCase.memberId,
            channel,
            purpose: "SCHEDULING_AND_REMINDERS",
          },
        },
        update: {
          granted: false,
          source: "MEMBER_OPT_OUT",
          revokedAt: now,
        },
        create: {
          tenantId: params.session.tenantId,
          memberId: careCase.memberId,
          channel,
          purpose: "SCHEDULING_AND_REMINDERS",
          granted: false,
          source: "MEMBER_OPT_OUT",
          grantedAt: now,
          revokedAt: now,
        },
      });
    }

    await tx.caseNote.create({
      data: {
        tenantId: params.session.tenantId,
        caseId: careCase.id,
        authorId: params.session.userId,
        category: "OUTREACH",
        content: params.reason?.trim()
          ? `[Member Opt-Out]: Member opted out of outreach (${params.reason.trim()}).`
          : "[Member Opt-Out]: Member opted out of automated outreach and reminders.",
      },
    });
  });

  const isSpanish = careCase.member.preferredLanguage.toLowerCase().startsWith("span");
  const optOutAck = isSpanish
    ? "Entendido. Hemos pausado todos los mensajes y recordatorios automáticos. Si en algún momento desea volver a recibir apoyo, puede actualizar sus preferencias aquí."
    : "Understood. We have paused all automated outreach and reminders for you. You can still message our team or turn updates back on here anytime.";

  await dispatcher.sendMessage({
    channel: "PORTAL",
    language: careCase.member.preferredLanguage,
    messageBody: optOutAck,
    consentVerified: true,
  });

  await prisma.communication.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: careCase.id,
      memberId: careCase.memberId,
      channel: CommunicationChannel.PORTAL,
      direction: "OUTBOUND",
      language: careCase.member.preferredLanguage,
      draftedByAi: false,
      internalAiLabel: "HUMAN_AUTHORED",
      content: optOutAck,
      messageSummary: optOutAck,
      deliveryStatus: DeliveryStatus.DELIVERED,
      sentAt: now,
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "MEMBER_OPTED_OUT",
    entityType: "Member",
    entityId: careCase.memberId,
    correlationId: params.correlationId,
    summary: `Member opted out of automated outreach on case ${careCase.id}`,
  });

  return getMemberPortalView(params.session.tenantId, params.caseId);
}

/**
 * Escalate a case directly to a human care coordinator at the member's request
 * and pause any active automated runs.
 */
export async function escalateMemberToHuman(params: {
  session: SessionUser;
  caseId: string;
  topic?: string;
  message?: string;
  correlationId?: string;
}) {
  const careCase = await prisma.case.findFirst({
    where: { id: params.caseId, tenantId: params.session.tenantId },
    include: { member: true },
  });
  if (!careCase) throw new NotFoundError("Case", params.caseId);

  const topic = params.topic?.trim() || "Personal coordinator follow-up";
  const message =
    params.message?.trim() || "I would like to speak with a human care coordinator.";
  const now = new Date();

  const inbound = await prisma.$transaction(async (tx) => {
    const comm = await tx.communication.create({
      data: {
        tenantId: params.session.tenantId,
        caseId: careCase.id,
        memberId: careCase.memberId,
        channel: CommunicationChannel.PORTAL,
        direction: "INBOUND",
        language: careCase.member.preferredLanguage,
        draftedByAi: false,
        messageSummary: `Human Escalation (${topic}): ${message}`,
        deliveryStatus: DeliveryStatus.RESPONDED,
        sentAt: now,
      },
    });

    await tx.notification.create({
      data: {
        tenantId: params.session.tenantId,
        caseId: careCase.id,
        recipientUserId: careCase.assignedToId ?? null,
        channel: "IN_APP",
        notificationType: "MEMBER_HUMAN_ESCALATION",
        title: `Member requested a care coordinator (${topic})`,
        message,
        status: NotificationStatus.SENT,
        sentAt: now,
      },
    });

    await tx.caseNote.create({
      data: {
        tenantId: params.session.tenantId,
        caseId: careCase.id,
        authorId: params.session.userId,
        category: "ESCALATION",
        content: `[Member Requested Human Coordinator — ${topic}]: ${message}`,
      },
    });

    if (canTransitionCaseStatus(careCase.status, CaseStatus.ESCALATED)) {
      await tx.case.update({
        where: { id: careCase.id },
        data: { status: CaseStatus.ESCALATED },
      });

      await tx.workflowEvent.create({
        data: {
          tenantId: params.session.tenantId,
          caseId: careCase.id,
          eventType: WorkflowEventType.ESCALATED,
          fromStatus: careCase.status,
          toStatus: CaseStatus.ESCALATED,
          actorRole: "MEMBER",
          actorId: careCase.memberId,
          reason: `Member requested human care coordinator (${topic})`,
        },
      });
    }

    await tx.agentRun.updateMany({
      where: {
        tenantId: params.session.tenantId,
        caseId: careCase.id,
        status: {
          in: [AgentRunStatus.STARTED, AgentRunStatus.PAUSED, AgentRunStatus.AWAITING_APPROVAL],
        },
      },
      data: {
        status: AgentRunStatus.ESCALATED,
        escalatedAt: now,
        currentStep: "MEMBER_REQUESTED_HUMAN",
      },
    });

    return comm;
  });

  const isSpanish = careCase.member.preferredLanguage.toLowerCase().startsWith("span");
  const escalationAck = isSpanish
    ? "Gracias por avisarnos. Conectamos su solicitud con un coordinador de atención humano, quien se pondrá en contacto con usted personalmente muy pronto."
    : "Thank you for letting us know. We have connected your request to a dedicated care coordinator, and a member of our team will follow up with you personally soon.";

  await dispatcher.sendMessage({
    channel: "PORTAL",
    language: careCase.member.preferredLanguage,
    messageBody: escalationAck,
    consentVerified: true,
  });

  await prisma.communication.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: careCase.id,
      memberId: careCase.memberId,
      channel: CommunicationChannel.PORTAL,
      direction: "OUTBOUND",
      language: careCase.member.preferredLanguage,
      draftedByAi: false,
      internalAiLabel: "HUMAN_AUTHORED",
      content: escalationAck,
      messageSummary: escalationAck,
      deliveryStatus: DeliveryStatus.DELIVERED,
      sentAt: now,
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "MEMBER_HUMAN_ESCALATION_REQUESTED",
    entityType: "Communication",
    entityId: inbound.id,
    correlationId: params.correlationId,
    summary: `Member requested human escalation on case ${careCase.id} (${topic})`,
  });

  return getMemberPortalView(params.session.tenantId, params.caseId);
}
