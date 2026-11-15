import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  AgentRunStatus,
  AvailabilitySource,
  CaseStatus,
  CommunicationChannel,
  RiskLevel,
  UserRole,
} from "@prisma/client";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { validateOutboundCommunication } from "@/domain/communications/validator";
import { renderCommunicationTemplate } from "@/domain/communications/templates";

const mockCookieMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieMap.get(name);
      return value ? { name, value } : undefined;
    },
  }),
}));

import { POST as memberActionRoute } from "@/app/api/member-portal/[caseId]/actions/route";

describe("Member Experience — Empathy, Opt-Out, Human Escalation & Anti-Leakage", () => {
  let tenantId = "";
  let cmToken = "";
  let testCaseId = "";
  let testReferralId = "";
  let testMemberId = "";
  let verifiedProviderId = "";
  let testSlotId = "";
  let testAgentRunId = "";

  beforeAll(async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    tenantId = horizon.id;

    const cm = await prisma.user.findFirstOrThrow({
      where: { tenantId, role: UserRole.CARE_MANAGER },
    });

    cmToken = createSessionToken({
      userId: cm.id,
      tenantId,
      tenantSlug: horizon.slug,
      email: cm.email,
      name: cm.name,
      role: cm.role,
    });

    const verifiedProvider = await prisma.provider.findFirstOrThrow({
      where: {
        tenantId,
        availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY,
      },
    });
    verifiedProviderId = verifiedProvider.id;

    const slotStart = new Date(Date.now() + 3 * 86_400_000);
    const slotEnd = new Date(slotStart.getTime() + 50 * 60_000);
    const slot = await prisma.providerAvailability.create({
      data: {
        tenantId,
        providerId: verifiedProviderId,
        slotStartAt: slotStart,
        slotEndAt: slotEnd,
        modality: "TELEHEALTH",
        status: "AVAILABLE",
      },
    });
    testSlotId = slot.id;

    const suffix = Date.now();
    const member = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: `MEM-EXP-${suffix}`,
        firstName: "Sofia",
        lastName: "Ramirez",
        preferredLanguage: "Spanish",
        preferredContactChannel: CommunicationChannel.SMS,
        consentSms: true,
        consentOutreach: true,
        geography: "Central Metro",
      },
    });
    testMemberId = member.id;

    const referral = await prisma.referral.create({
      data: {
        tenantId,
        memberId: member.id,
        externalReferralId: `REF-EXP-${suffix}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient Therapy",
        specialty: "Behavioral Health Therapy",
        geography: "Central Metro",
        networkRequired: "Horizon PPO",
      },
    });
    testReferralId = referral.id;

    const careCase = await prisma.case.create({
      data: {
        tenantId,
        referralId: referral.id,
        memberId: member.id,
        status: CaseStatus.INTERVENTION_IN_PROGRESS,
        riskLevel: RiskLevel.MEDIUM,
        priorityScore: 48,
      },
    });
    testCaseId = careCase.id;

    const agentRun = await prisma.agentRun.create({
      data: {
        tenantId,
        caseId: testCaseId,
        model: "deterministic-policy-v1",
        promptVersion: "v1.0",
        status: AgentRunStatus.STARTED,
        currentStep: "OUTREACH",
      },
    });
    testAgentRunId = agentRun.id;
  });

  afterAll(async () => {
    mockCookieMap.clear();
    if (testCaseId) {
      await prisma.agentRun.deleteMany({ where: { caseId: testCaseId } });
      await prisma.notification.deleteMany({ where: { caseId: testCaseId } });
      await prisma.caseNote.deleteMany({ where: { caseId: testCaseId } });
      await prisma.workflowEvent.deleteMany({ where: { caseId: testCaseId } });
      await prisma.communication.deleteMany({ where: { caseId: testCaseId } });
      await prisma.appointment.deleteMany({ where: { caseId: testCaseId } });
      await prisma.case.deleteMany({ where: { id: testCaseId } });
    }
    if (testReferralId) {
      await prisma.referral.deleteMany({ where: { id: testReferralId } });
    }
    if (testMemberId) {
      await prisma.consent.deleteMany({ where: { memberId: testMemberId } });
      await prisma.member.deleteMany({ where: { id: testMemberId } });
    }
    if (testSlotId) {
      await prisma.providerAvailability.deleteMany({ where: { id: testSlotId } });
    }
  });

  it("blocks internal AI reasoning and sensitive-characteristic inference phrasing in outbound messages", () => {
    expect(() =>
      validateOutboundCommunication({
        channel: "SMS",
        consentOutreach: true,
        consentSms: true,
        body: "Our agent runtime and risk band indicate you need scheduling help.",
      })
    ).toThrow();

    expect(() =>
      validateOutboundCommunication({
        channel: "EMAIL",
        consentOutreach: true,
        consentSms: false,
        body: "We inferred that you have a transportation barrier based on your neighborhood.",
      })
    ).toThrow();

    expect(() =>
      validateOutboundCommunication({
        channel: "PORTAL",
        consentOutreach: false,
        consentSms: false,
        body: "The AI detected a sensitive characteristic in your profile.",
      })
    ).toThrow();

    const empathetic = renderCommunicationTemplate({
      messageType: "APPOINTMENT_REMINDER",
      language: "Spanish",
      readingLevel: "SIMPLE",
      memberFirstName: "Sofia",
      specialty: "Terapia",
      providerName: "Dr. Rivera",
      appointmentDateText: "martes a las 10:00",
    });
    expect(() =>
      validateOutboundCommunication({
        channel: "SMS",
        consentOutreach: true,
        consentSms: true,
        subject: empathetic.subject,
        body: empathetic.body,
      })
    ).not.toThrow();
    expect(empathetic.body).not.toMatch(/ai|score|inferred|barrier/i);
  });

  it("supports scheduling, confirmation, reminders, opt-out (revoking SMS/EMAIL consent), and human escalation", async () => {
    mockCookieMap.set(SESSION_COOKIE_NAME, cmToken);

    // 1. Schedule appointment
    const slot = await prisma.providerAvailability.findUniqueOrThrow({ where: { id: testSlotId } });
    const reqSchedule = new Request(`http://localhost:3000/api/member-portal/${testCaseId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "REQUEST_APPOINTMENT",
        providerId: verifiedProviderId,
        slotId: testSlotId,
        requestedStartAt: slot.slotStartAt.toISOString(),
        modality: "TELEHEALTH",
      }),
    });
    const schedRes = await memberActionRoute(reqSchedule, {
      params: Promise.resolve({ caseId: testCaseId }),
    });
    expect(schedRes.status).toBe(200);
    const schedBody = (await schedRes.json()) as {
      portal: { appointments: Array<{ id: string; status: string }> };
    };
    const apptId = schedBody.portal.appointments[0].id;

    // 2. Confirm appointment
    const reqConfirm = new Request(`http://localhost:3000/api/member-portal/${testCaseId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "CONFIRM_APPOINTMENT", appointmentId: apptId }),
    });
    const confirmRes = await memberActionRoute(reqConfirm, {
      params: Promise.resolve({ caseId: testCaseId }),
    });
    expect(confirmRes.status).toBe(200);

    // 3. Send SMS reminder while consented
    const reqRemind = new Request(`http://localhost:3000/api/member-portal/${testCaseId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "REQUEST_REMINDER",
        appointmentId: apptId,
        channel: "SMS",
      }),
    });
    const remindRes = await memberActionRoute(reqRemind, {
      params: Promise.resolve({ caseId: testCaseId }),
    });
    expect(remindRes.status).toBe(200);

    // 4. Opt out of automated outreach
    const reqOptOut = new Request(`http://localhost:3000/api/member-portal/${testCaseId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "OPT_OUT", reason: "Prefer not to receive texts" }),
    });
    const optOutRes = await memberActionRoute(reqOptOut, {
      params: Promise.resolve({ caseId: testCaseId }),
    });
    expect(optOutRes.status).toBe(200);
    const optOutBody = (await optOutRes.json()) as {
      portal: {
        member: { consentSms: boolean; consentOutreach: boolean; preferredContactChannel: string };
      };
    };
    expect(optOutBody.portal.member.consentSms).toBe(false);
    expect(optOutBody.portal.member.consentOutreach).toBe(false);
    expect(optOutBody.portal.member.preferredContactChannel).toBe("PORTAL");

    // 5. Subsequent SMS reminder is blocked after opt-out
    const reqBlockedSms = new Request(
      `http://localhost:3000/api/member-portal/${testCaseId}/actions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REQUEST_REMINDER",
          appointmentId: apptId,
          channel: "SMS",
        }),
      }
    );
    const blockedSmsRes = await memberActionRoute(reqBlockedSms, {
      params: Promise.resolve({ caseId: testCaseId }),
    });
    expect(blockedSmsRes.status).toBe(400);

    // 6. Escalate to human coordinator
    const reqEscalate = new Request(`http://localhost:3000/api/member-portal/${testCaseId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ESCALATE_TO_HUMAN",
        topic: "Insurance question",
        message: "Please have a person call me about my coverage.",
      }),
    });
    const escalateRes = await memberActionRoute(reqEscalate, {
      params: Promise.resolve({ caseId: testCaseId }),
    });
    expect(escalateRes.status).toBe(200);

    const updatedCase = await prisma.case.findUniqueOrThrow({ where: { id: testCaseId } });
    expect(updatedCase.status).toBe(CaseStatus.ESCALATED);

    const updatedRun = await prisma.agentRun.findUniqueOrThrow({ where: { id: testAgentRunId } });
    expect(updatedRun.status).toBe(AgentRunStatus.ESCALATED);
    expect(updatedRun.currentStep).toBe("MEMBER_REQUESTED_HUMAN");
  });
});
