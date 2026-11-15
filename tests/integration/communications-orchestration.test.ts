import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  AvailabilitySource,
  CaseStatus,
  CommunicationChannel,
  CommunicationMessageType,
  DeliveryStatus,
  RiskLevel,
  UserRole,
} from "@prisma/client";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { draftCommunication } from "@/services/communication-orchestration-service";
import { assertCommunicationTransition } from "@/domain/communications/state-machine";

const mockCookieMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieMap.get(name);
      return value ? { name, value } : undefined;
    },
  }),
}));

import { POST as transitionCommRoute } from "@/app/api/communications/[commId]/transition/route";
import { POST as runRemindersRoute } from "@/app/api/communications/reminders/run/route";

describe("Communications Orchestration — Lifecycle, Automated Reminders, Outcomes & Non-Response Guard", () => {
  let tenantId = "";
  let cmId = "";
  let cmEmail = "";
  let cmToken = "";

  let consentedMemberId = "";
  let unconsentedMemberId = "";
  const referralIds: string[] = [];
  const caseIds: string[] = [];
  const appointmentIds: string[] = [];
  let consentId = "";

  beforeAll(async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    tenantId = horizon.id;

    const cm = await prisma.user.findFirstOrThrow({
      where: { tenantId, role: UserRole.CARE_MANAGER },
    });
    cmId = cm.id;
    cmEmail = cm.email;
    cmToken = createSessionToken({
      userId: cm.id,
      tenantId,
      tenantSlug: horizon.slug,
      email: cm.email,
      name: cm.name,
      role: cm.role,
    });

    const provider = await prisma.provider.findFirstOrThrow({
      where: { tenantId, availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY },
    });

    const suffix = Date.now();
    const consentedMember = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: `MEM-COMM-OK-${suffix}`,
        firstName: "Elena",
        lastName: "Torres",
        preferredLanguage: "Spanish",
        preferredContactChannel: CommunicationChannel.SMS,
        consentSms: true,
        consentOutreach: true,
        geography: "Central Metro",
      },
    });
    consentedMemberId = consentedMember.id;

    const consent = await prisma.consent.create({
      data: {
        tenantId,
        memberId: consentedMemberId,
        channel: CommunicationChannel.SMS,
        purpose: "SCHEDULING_AND_REMINDERS",
        granted: true,
        source: "INTAKE",
      },
    });
    consentId = consent.id;

    const unconsentedMember = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: `MEM-COMM-NO-${suffix}`,
        firstName: "Marcus",
        lastName: "Lee",
        preferredLanguage: "English",
        preferredContactChannel: CommunicationChannel.SMS,
        consentSms: false,
        consentOutreach: false,
        geography: "Central Metro",
      },
    });
    unconsentedMemberId = unconsentedMember.id;

    for (const [idx, mId] of [consentedMemberId, unconsentedMemberId].entries()) {
      const ref = await prisma.referral.create({
        data: {
          tenantId,
          memberId: mId,
          externalReferralId: `REF-COMM-${idx}-${suffix}`,
          referralDate: new Date(),
          behavioralHealthNeed: "Outpatient Counseling",
          specialty: "Behavioral Health",
          geography: "Central Metro",
          networkRequired: "Horizon PPO",
        },
      });
      referralIds.push(ref.id);

      const c = await prisma.case.create({
        data: {
          tenantId,
          memberId: mId,
          referralId: ref.id,
          status: CaseStatus.INTERVENTION_IN_PROGRESS,
          riskLevel: RiskLevel.LOW,
          priorityScore: 25,
        },
      });
      caseIds.push(c.id);

      const start = new Date(Date.now() + 12 * 3_600_000);
      const appt = await prisma.appointment.create({
        data: {
          tenantId,
          caseId: c.id,
          memberId: mId,
          providerId: provider.id,
          scheduledStartAt: start,
          modality: "TELEHEALTH",
          status: "CONFIRMED",
          availabilitySourceAtBooking: AvailabilitySource.VERIFIED_AVAILABILITY,
        },
      });
      appointmentIds.push(appt.id);
    }
  });

  afterAll(async () => {
    mockCookieMap.clear();
    if (caseIds.length > 0) {
      await prisma.communication.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.appointment.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.barrier.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.case.deleteMany({ where: { id: { in: caseIds } } });
    }
    if (referralIds.length > 0) {
      await prisma.referral.deleteMany({ where: { id: { in: referralIds } } });
    }
    for (const mId of [consentedMemberId, unconsentedMemberId]) {
      if (mId) {
        await prisma.consent.deleteMany({ where: { memberId: mId } });
        await prisma.member.deleteMany({ where: { id: mId } });
      }
    }
  });

  it("enforces DRAFT -> APPROVED -> SENT -> DELIVERED -> RESPONDED with all required fields and timestamps", async () => {
    mockCookieMap.set(SESSION_COOKIE_NAME, cmToken);

    expect(() =>
      assertCommunicationTransition(DeliveryStatus.DRAFT, DeliveryStatus.DELIVERED)
    ).toThrow();

    const drafted = await draftCommunication({
      session: {
        userId: cmId,
        tenantId,
        tenantSlug: "horizon-bh",
        email: cmEmail,
        name: "Care Manager",
        role: UserRole.CARE_MANAGER,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      caseId: caseIds[0],
      channel: "SMS",
      purpose: CommunicationMessageType.SCHEDULING_REMINDER,
    });

    expect(drafted.memberId).toBe(consentedMemberId);
    expect(drafted.channel).toBe("SMS");
    expect(drafted.consentId).toBe(consentId);
    expect(drafted.templateKey).toContain("scheduling_reminder.es");
    expect(drafted.messageType).toBe(CommunicationMessageType.SCHEDULING_REMINDER);
    expect(drafted.language).toBe("Spanish");
    expect(drafted.deliveryStatus).toBe(DeliveryStatus.DRAFT);
    expect(drafted.createdAt).toBeInstanceOf(Date);

    // DRAFT -> APPROVED
    const approveRes = await transitionCommRoute(
      new Request(`http://localhost:3000/api/communications/${drafted.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      }),
      { params: Promise.resolve({ commId: drafted.id }) }
    );
    expect(approveRes.status).toBe(200);
    const approved = ((await approveRes.json()) as { communication: { deliveryStatus: string; approvedAt: string } }).communication;
    expect(approved.deliveryStatus).toBe("APPROVED");
    expect(approved.approvedAt).toBeTruthy();

    // APPROVED -> SENT
    const sendRes = await transitionCommRoute(
      new Request(`http://localhost:3000/api/communications/${drafted.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SEND" }),
      }),
      { params: Promise.resolve({ commId: drafted.id }) }
    );
    expect(sendRes.status).toBe(200);
    const sent = ((await sendRes.json()) as { communication: { deliveryStatus: string; sentAt: string } }).communication;
    expect(sent.deliveryStatus).toBe("SENT");
    expect(sent.sentAt).toBeTruthy();

    // SENT -> DELIVERED
    const deliverRes = await transitionCommRoute(
      new Request(`http://localhost:3000/api/communications/${drafted.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DELIVER" }),
      }),
      { params: Promise.resolve({ commId: drafted.id }) }
    );
    expect(deliverRes.status).toBe(200);
    const delivered = ((await deliverRes.json()) as { communication: { deliveryStatus: string; deliveredAt: string } }).communication;
    expect(delivered.deliveryStatus).toBe("DELIVERED");
    expect(delivered.deliveredAt).toBeTruthy();

    // DELIVERED -> RESPONDED
    const respondRes = await transitionCommRoute(
      new Request(`http://localhost:3000/api/communications/${drafted.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RECORD_OUTCOME",
          outcome: "RESPONDED",
          memberResponseSummary: "Si, confirmo el martes.",
        }),
      }),
      { params: Promise.resolve({ commId: drafted.id }) }
    );
    expect(respondRes.status).toBe(200);
    const responded = ((await respondRes.json()) as { communication: { deliveryStatus: string; respondedAt: string; memberResponseSummary: string } }).communication;
    expect(responded.deliveryStatus).toBe("RESPONDED");
    expect(responded.respondedAt).toBeTruthy();
    expect(responded.memberResponseSummary).toBe("Si, confirmo el martes.");
  });

  it("never interprets NO_RESPONSE as proof of a particular barrier", async () => {
    mockCookieMap.set(SESSION_COOKIE_NAME, cmToken);

    const drafted = await draftCommunication({
      session: {
        userId: cmId,
        tenantId,
        tenantSlug: "horizon-bh",
        email: cmEmail,
        name: "Care Manager",
        role: UserRole.CARE_MANAGER,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      caseId: caseIds[0],
      channel: "SMS",
      purpose: CommunicationMessageType.RE_ENGAGEMENT,
    });

    await transitionCommRoute(
      new Request(`http://localhost:3000/api/communications/${drafted.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      }),
      { params: Promise.resolve({ commId: drafted.id }) }
    );
    await transitionCommRoute(
      new Request(`http://localhost:3000/api/communications/${drafted.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SEND" }),
      }),
      { params: Promise.resolve({ commId: drafted.id }) }
    );

    // Reject barrier inference on NO_RESPONSE
    const badRes = await transitionCommRoute(
      new Request(`http://localhost:3000/api/communications/${drafted.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RECORD_OUTCOME",
          outcome: "NO_RESPONSE",
          inferredBarrier: "BEHAVIORAL",
        }),
      }),
      { params: Promise.resolve({ commId: drafted.id }) }
    );
    expect(badRes.status).toBe(400);

    // Record NO_RESPONSE cleanly without barrier inference
    const okRes = await transitionCommRoute(
      new Request(`http://localhost:3000/api/communications/${drafted.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RECORD_OUTCOME",
          outcome: "NO_RESPONSE",
        }),
      }),
      { params: Promise.resolve({ commId: drafted.id }) }
    );
    expect(okRes.status).toBe(200);
    const body = (await okRes.json()) as {
      barrierInferenceAllowed: boolean;
      communication: { deliveryStatus: string; outcomeSummary: string };
    };
    expect(body.barrierInferenceAllowed).toBe(false);
    expect(body.communication.deliveryStatus).toBe("NO_RESPONSE");
    expect(body.communication.outcomeSummary).toContain("not proof of any specific barrier");

    const barriers = await prisma.barrier.findMany({ where: { caseId: caseIds[0] } });
    expect(barriers.length).toBe(0);
  });

  it("runs automated appointment reminders only where policy and consent allow", async () => {
    mockCookieMap.set(SESSION_COOKIE_NAME, cmToken);

    const res = await runRemindersRoute(
      new Request("http://localhost:3000/api/communications/reminders/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withinHours: 24 }),
      })
    );
    expect(res.status).toBe(200);
    const summary = (await res.json()) as {
      evaluated: number;
      sent: number;
      skippedConsent: number;
      communicationIds: string[];
    };
    expect(summary.sent).toBeGreaterThanOrEqual(1);
    expect(summary.skippedConsent).toBeGreaterThanOrEqual(1);

    const consentedAppt = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointmentIds[0] },
    });
    expect(consentedAppt.reminderSentAt).not.toBeNull();

    const unconsentedAppt = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointmentIds[1] },
    });
    expect(unconsentedAppt.reminderSentAt).toBeNull();
  });
});
