import {
  CaseStatus,
  CommunicationChannel,
  CommunicationMessageType,
  DeliveryStatus,
  ReadingLevel,
} from "@prisma/client";
import { createDefaultCommunicationDispatcher } from "@/adapters/communication/channel-registry";
import { SupportedCommunicationChannel } from "@/adapters/contracts";
import { assertCommunicationTransition } from "@/domain/communications/state-machine";
import {
  LegacyOrCanonicalPurpose,
  normalizeCommunicationMessageType,
  renderCommunicationTemplate,
} from "@/domain/communications/templates";
import { validateOutboundCommunication } from "@/domain/communications/validator";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { CareLoopPolicyEvaluator } from "@/policy";
import { recordAuditEvent } from "./audit-service";

const dispatcher = createDefaultCommunicationDispatcher();
const policyEvaluator = new CareLoopPolicyEvaluator();

export interface DraftCommunicationInput {
  session: SessionUser;
  caseId: string;
  channel: SupportedCommunicationChannel;
  purpose: LegacyOrCanonicalPurpose;
  language?: string;
  readingLevel?: ReadingLevel;
  templateKey?: string;
  customBody?: string;
  customSubject?: string;
  interventionId?: string;
  providerName?: string | null;
  appointmentDateText?: string | null;
  correlationId?: string;
}

export interface CommunicationOutcomeInput {
  session: SessionUser;
  communicationId: string;
  outcome: "RESPONDED" | "NO_RESPONSE";
  memberResponseSummary?: string;
  outcomeSummary?: string;
  inferredBarrier?: string;
  correlationId?: string;
}

function hasChannelConsent(
  member: { consentOutreach: boolean; consentSms: boolean },
  channel: SupportedCommunicationChannel
): boolean {
  if (channel === "PORTAL") return true;
  if (channel === "SMS") return member.consentOutreach && member.consentSms;
  return member.consentOutreach;
}

/**
 * Draft a member communication with all required fields:
 * member, channel, consent, template, purpose, language, status (DRAFT), timestamp.
 */
export async function draftCommunication(params: DraftCommunicationInput) {
  const careCase = await prisma.case.findFirst({
    where: { id: params.caseId, tenantId: params.session.tenantId },
    include: {
      member: { include: { consents: true } },
      referral: true,
    },
  });
  if (!careCase) throw new NotFoundError("Case", params.caseId);

  const purpose = normalizeCommunicationMessageType(params.purpose);
  const language = params.language?.trim() || careCase.member.preferredLanguage;
  const readingLevel = params.readingLevel ?? ReadingLevel.PLAIN;
  const consentVerified = hasChannelConsent(careCase.member, params.channel);
  const consentRecord = careCase.member.consents.find(
    (c) => c.channel === (params.channel as CommunicationChannel) && c.granted && !c.revokedAt
  );

  const rendered = renderCommunicationTemplate({
    messageType: purpose,
    language,
    readingLevel,
    memberFirstName: careCase.member.firstName,
    specialty: careCase.referral.specialty,
    networkRequired: careCase.referral.networkRequired,
    providerName: params.providerName,
    appointmentDateText: params.appointmentDateText,
  });

  const body = params.customBody?.trim() || rendered.body;
  const subject = params.customSubject?.trim() || rendered.subject;
  const templateKey = params.templateKey?.trim() || rendered.templateKey;

  validateOutboundCommunication({
    channel: params.channel,
    body,
    subject,
    consentOutreach: careCase.member.consentOutreach,
    consentSms: careCase.member.consentSms,
    requireConsentForDelivery: false,
  });

  const now = new Date();
  const comm = await prisma.communication.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: careCase.id,
      memberId: careCase.memberId,
      interventionId: params.interventionId ?? null,
      consentId: consentRecord?.id ?? null,
      channel: params.channel as CommunicationChannel,
      messageType: purpose,
      templateKey,
      recipient: `${careCase.member.firstName} ${careCase.member.lastName} (${careCase.member.externalMemberId})`,
      direction: "OUTBOUND",
      language,
      readingLevel,
      draftedByAi: !params.customBody?.trim(),
      internalAiLabel: params.customBody?.trim() ? "HUMAN_AUTHORED" : "AI_GENERATED",
      content: body,
      messageSummary: `${purpose} via ${params.channel} (${language})`,
      deliveryStatus: DeliveryStatus.DRAFT,
      deliveryMode: "MOCK",
      validationPassed: true,
      createdAt: now,
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "COMMUNICATION_DRAFTED",
    entityType: "Communication",
    entityId: comm.id,
    correlationId: params.correlationId,
    summary: `Drafted ${purpose} communication via ${params.channel} (${language}) using template ${templateKey}`,
    metadata: {
      memberId: careCase.memberId,
      channel: params.channel,
      consentVerified,
      consentId: consentRecord?.id ?? null,
      templateKey,
      purpose,
      language,
      status: DeliveryStatus.DRAFT,
    },
  });

  return comm;
}

/**
 * Transition DRAFT -> APPROVED.
 */
export async function approveCommunication(params: {
  session: SessionUser;
  communicationId: string;
  correlationId?: string;
}) {
  const existing = await prisma.communication.findFirst({
    where: { id: params.communicationId, tenantId: params.session.tenantId },
  });
  if (!existing) throw new NotFoundError("Communication", params.communicationId);

  assertCommunicationTransition(existing.deliveryStatus, DeliveryStatus.APPROVED);

  const now = new Date();
  const updated = await prisma.communication.update({
    where: { id: existing.id },
    data: {
      deliveryStatus: DeliveryStatus.APPROVED,
      humanApprovedById: params.session.userId,
      approvedAt: now,
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "COMMUNICATION_APPROVED",
    entityType: "Communication",
    entityId: updated.id,
    correlationId: params.correlationId,
    summary: `Approved ${updated.messageType} communication via ${updated.channel}`,
  });

  return updated;
}

/**
 * Transition APPROVED (or policy-authorized DRAFT) -> SENT (or FAILED).
 */
export async function sendCommunication(params: {
  session: SessionUser;
  communicationId: string;
  correlationId?: string;
}) {
  const existing = await prisma.communication.findFirst({
    where: { id: params.communicationId, tenantId: params.session.tenantId },
    include: { member: true, careCase: true },
  });
  if (!existing) throw new NotFoundError("Communication", params.communicationId);

  assertCommunicationTransition(existing.deliveryStatus, DeliveryStatus.SENT);

  const channel = existing.channel as SupportedCommunicationChannel;
  const consentVerified = hasChannelConsent(existing.member, channel);

  validateOutboundCommunication({
    channel,
    body: existing.content || existing.messageSummary,
    consentOutreach: existing.member.consentOutreach,
    consentSms: existing.member.consentSms,
    requireConsentForDelivery: true,
  });

  const dispatch = await dispatcher.sendMessage({
    channel,
    language: existing.language,
    messageBody: existing.content || existing.messageSummary,
    consentVerified,
  });

  const now = new Date();
  const nextStatus = dispatch.dispatched ? DeliveryStatus.SENT : DeliveryStatus.FAILED;
  const updated = await prisma.communication.update({
    where: { id: existing.id },
    data: {
      deliveryStatus: nextStatus,
      deliveryMode: dispatch.deliveryMode,
      externalMessageId: dispatch.externalMessageId ?? null,
      sentAt: dispatch.dispatched ? now : null,
      outcomeSummary: dispatch.dispatched ? "Dispatched to member channel" : dispatch.reason ?? "Dispatch failed",
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: dispatch.dispatched ? "COMMUNICATION_SENT" : "COMMUNICATION_FAILED",
    entityType: "Communication",
    entityId: updated.id,
    correlationId: params.correlationId,
    summary: `Communication ${nextStatus} via ${updated.channel} (${updated.language})`,
  });

  return updated;
}

/**
 * Transition SENT -> DELIVERED.
 */
export async function markCommunicationDelivered(params: {
  session: SessionUser;
  communicationId: string;
  correlationId?: string;
}) {
  const existing = await prisma.communication.findFirst({
    where: { id: params.communicationId, tenantId: params.session.tenantId },
  });
  if (!existing) throw new NotFoundError("Communication", params.communicationId);

  assertCommunicationTransition(existing.deliveryStatus, DeliveryStatus.DELIVERED);

  const now = new Date();
  const updated = await prisma.communication.update({
    where: { id: existing.id },
    data: {
      deliveryStatus: DeliveryStatus.DELIVERED,
      deliveredAt: now,
      outcomeSummary: "Confirmed delivered on member channel",
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "COMMUNICATION_DELIVERED",
    entityType: "Communication",
    entityId: updated.id,
    correlationId: params.correlationId,
    summary: `Communication delivered via ${updated.channel}`,
  });

  return updated;
}

/**
 * Track communication outcome:
 * - DELIVERED | SENT -> RESPONDED
 * - DELIVERED | SENT -> NO_RESPONSE (never interprets lack of response as proof of a barrier)
 */
export async function recordCommunicationOutcome(params: CommunicationOutcomeInput) {
  if (params.outcome === "NO_RESPONSE" && params.inferredBarrier) {
    throw new ValidationError(
      "Lack of response must not be interpreted as proof of any specific barrier."
    );
  }

  const existing = await prisma.communication.findFirst({
    where: { id: params.communicationId, tenantId: params.session.tenantId },
  });
  if (!existing) throw new NotFoundError("Communication", params.communicationId);

  const targetStatus =
    params.outcome === "RESPONDED" ? DeliveryStatus.RESPONDED : DeliveryStatus.NO_RESPONSE;
  assertCommunicationTransition(existing.deliveryStatus, targetStatus);

  const now = new Date();
  const outcomeSummary =
    params.outcome === "RESPONDED"
      ? params.outcomeSummary?.trim() || "Member responded to outreach"
      : params.outcomeSummary?.trim() ||
        "No response recorded; lack of response is not proof of any specific barrier.";

  const updated = await prisma.communication.update({
    where: { id: existing.id },
    data: {
      deliveryStatus: targetStatus,
      respondedAt: params.outcome === "RESPONDED" ? now : null,
      memberResponseSummary:
        params.outcome === "RESPONDED" ? params.memberResponseSummary?.trim() ?? null : null,
      outcomeSummary,
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action:
      params.outcome === "RESPONDED"
        ? "COMMUNICATION_RESPONDED"
        : "COMMUNICATION_NO_RESPONSE_RECORDED",
    entityType: "Communication",
    entityId: updated.id,
    correlationId: params.correlationId,
    summary: outcomeSummary,
    metadata: {
      outcome: params.outcome,
      barrierInferenceAllowed: false,
    },
  });

  return {
    communication: updated,
    barrierInferenceAllowed: false,
  };
}

/**
 * Send automated appointment reminders where policy and member consent allow.
 */
export async function runAutomatedReminders(params: {
  session: SessionUser;
  withinHours?: number;
  correlationId?: string;
}) {
  const withinHours = params.withinHours ?? 48;
  const now = new Date();
  const horizon = new Date(now.getTime() + withinHours * 3_600_000);

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.session.tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
  const tenantPolicy = {
    requireHumanForExternalComms: Boolean(settings.requireHumanForExternalComms),
    requireHumanForHighRisk: Boolean(settings.requireHumanForHighRisk),
    autonomousModeEnabled: settings.autonomousModeEnabled !== false,
  };

  const upcoming = await prisma.appointment.findMany({
    where: {
      tenantId: params.session.tenantId,
      reminderSentAt: null,
      status: { in: ["REQUESTED", "CONFIRMED", "RESCHEDULED"] },
      scheduledStartAt: { gte: now, lte: horizon },
    },
    include: {
      provider: true,
      careCase: {
        include: {
          member: true,
          referral: true,
        },
      },
    },
  });

  let sent = 0;
  let skippedPolicy = 0;
  let skippedConsent = 0;
  const communicationIds: string[] = [];

  for (const appt of upcoming) {
    const member = appt.careCase.member;
    if (
      appt.careCase.status === CaseStatus.ESCALATED ||
      appt.careCase.status === CaseStatus.CLOSED ||
      appt.careCase.status === CaseStatus.VERIFIED
    ) {
      skippedPolicy++;
      continue;
    }

    const channel = (member.preferredContactChannel ?? "PORTAL") as SupportedCommunicationChannel;
    if (!hasChannelConsent(member, channel)) {
      skippedConsent++;
      continue;
    }

    const policyDecision = policyEvaluator.evaluate({
      action: "send_reminder",
      caseState: appt.careCase.status,
      riskTier: appt.careCase.riskLevel,
      consentOutreach: member.consentOutreach,
      consentSms: member.consentSms,
      channel,
      tenantPolicy,
    });

    if (!policyDecision.allowed || policyDecision.requiresHuman || policyDecision.requiresApproval) {
      skippedPolicy++;
      continue;
    }

    const drafted = await draftCommunication({
      session: params.session,
      caseId: appt.caseId,
      channel,
      purpose: CommunicationMessageType.APPOINTMENT_REMINDER,
      language: member.preferredLanguage,
      readingLevel: ReadingLevel.PLAIN,
      providerName: appt.provider.name,
      appointmentDateText: appt.scheduledStartAt.toLocaleString(),
      correlationId: params.correlationId,
    });

    const approved = await approveCommunication({
      session: params.session,
      communicationId: drafted.id,
      correlationId: params.correlationId,
    });

    const sentComm = await sendCommunication({
      session: params.session,
      communicationId: approved.id,
      correlationId: params.correlationId,
    });

    if (sentComm.deliveryStatus === DeliveryStatus.SENT) {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: {
          reminderSentAt: new Date(),
          reminderChannel: channel,
        },
      });
      sent++;
      communicationIds.push(sentComm.id);
    }
  }

  return {
    evaluated: upcoming.length,
    sent,
    skippedPolicy,
    skippedConsent,
    communicationIds,
  };
}
