import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  CaseStatus,
  CommunicationMessageType,
  InterventionType,
  ReadingLevel,
  RiskLevel,
  UserRole,
} from "@prisma/client";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const mockCookieMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieMap.get(name);
      return value ? { name, value } : undefined;
    },
  }),
}));

import { GET as getOutreachRoute, POST as sendOutreachRoute } from "@/app/api/cases/[id]/outreach/route";

describe("Communication System Integration — Storage, AI Labeling, Validation & Tenant Isolation", () => {
  let horizonTenantId = "";
  let pacificTenantId = "";
  let cmToken = "";
  let pacificAdminToken = "";

  let testCaseId = "";
  let testInterventionId = "";
  let testReferralId = "";
  let testMemberId = "";

  beforeAll(async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    const pacific = await prisma.tenant.findUniqueOrThrow({ where: { slug: "pacific-medicare" } });
    horizonTenantId = horizon.id;
    pacificTenantId = pacific.id;

    const cm = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizonTenantId, role: UserRole.CARE_MANAGER },
    });
    const pacAdmin = await prisma.user.findFirstOrThrow({
      where: { tenantId: pacificTenantId, role: UserRole.ADMIN },
    });

    cmToken = createSessionToken({
      userId: cm.id,
      tenantId: horizon.id,
      tenantSlug: horizon.slug,
      email: cm.email,
      name: cm.name,
      role: cm.role,
    });
    pacificAdminToken = createSessionToken({
      userId: pacAdmin.id,
      tenantId: pacific.id,
      tenantSlug: pacific.slug,
      email: pacAdmin.email,
      name: pacAdmin.name,
      role: pacAdmin.role,
    });

    const suffix = Date.now();
    const member = await prisma.member.create({
      data: {
        tenantId: horizonTenantId,
        externalMemberId: `MEM-COMM-${suffix}`,
        firstName: "Rosa",
        lastName: "Diaz",
        preferredLanguage: "Spanish",
        geography: "Southside",
        consentSms: true,
        consentOutreach: true,
      },
    });
    testMemberId = member.id;

    const referral = await prisma.referral.create({
      data: {
        tenantId: horizonTenantId,
        memberId: member.id,
        externalReferralId: `REF-COMM-${suffix}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient Counseling",
        specialty: "Outpatient Behavioral Health",
        geography: "Southside",
        networkRequired: "Horizon Medicaid",
        preferredLanguage: "Spanish",
      },
    });
    testReferralId = referral.id;

    const careCase = await prisma.case.create({
      data: {
        tenantId: horizonTenantId,
        memberId: member.id,
        referralId: referral.id,
        status: CaseStatus.INTERVENTION_IN_PROGRESS,
        riskLevel: RiskLevel.MEDIUM,
        priorityScore: 52,
      },
    });
    testCaseId = careCase.id;

    const intervention = await prisma.intervention.create({
      data: {
        tenantId: horizonTenantId,
        caseId: testCaseId,
        type: InterventionType.LANGUAGE_COMPATIBLE_PROVIDER_SEARCH,
        reason: "Spanish preference",
        recommendedAction: "Share Spanish provider choices",
      },
    });
    testInterventionId = intervention.id;
  });

  afterAll(async () => {
    if (testCaseId) {
      await prisma.case.deleteMany({ where: { id: testCaseId } });
    }
    if (testReferralId) {
      await prisma.referral.deleteMany({ where: { id: testReferralId } });
    }
    if (testMemberId) {
      await prisma.member.deleteMany({ where: { id: testMemberId } });
    }
  });

  it("persists all required fields, labels AI drafts internally, blocks leaked AI reasoning, and runs in mock mode", async () => {
    mockCookieMap.set(SESSION_COOKIE_NAME, cmToken);

    // 1. Send AI-generated Spanish SIMPLE referral notification linked to intervention in MOCK mode
    const aiSendRes = await sendOutreachRoute(
      new Request(`http://localhost/api/cases/${testCaseId}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "SMS",
          purpose: CommunicationMessageType.REFERRAL_NOTIFICATION,
          readingLevel: ReadingLevel.SIMPLE,
          interventionId: testInterventionId,
          sendImmediately: true,
        }),
      }),
      { params: Promise.resolve({ id: testCaseId }) }
    );
    expect(aiSendRes.status).toBe(201);
    const { attempt } = await aiSendRes.json();

    expect(attempt.recipient).toContain("Rosa Diaz");
    expect(attempt.channel).toBe("SMS");
    expect(attempt.messageType).toBe("REFERRAL_NOTIFICATION");
    expect(attempt.templateKey).toBe("referral_notification.es.simple");
    expect(attempt.content).toContain("Hola Rosa");
    expect(attempt.deliveryStatus).toBe("DELIVERED");
    expect(attempt.deliveryMode).toBe("MOCK");
    expect(attempt.sentAt).toBeTruthy();
    expect(attempt.caseId).toBe(testCaseId);
    expect(attempt.interventionId).toBe(testInterventionId);
    expect(attempt.draftedByAi).toBe(true);
    expect(attempt.internalAiLabel).toBe("AI_GENERATED");

    // 2. Custom human-authored message containing sensitive internal AI reasoning MUST be blocked BEFORE delivery
    const blockedRes = await sendOutreachRoute(
      new Request(`http://localhost/api/cases/${testCaseId}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "EMAIL",
          purpose: CommunicationMessageType.HUMAN_OUTREACH,
          customMessage: "Hola Rosa, your risk score is HIGH and priority score 92.",
          sendImmediately: true,
        }),
      }),
      { params: Promise.resolve({ id: testCaseId }) }
    );
    expect(blockedRes.status).toBe(400);

    // 3. Valid custom human-authored EMAIL saves with internalAiLabel = HUMAN_AUTHORED
    const humanRes = await sendOutreachRoute(
      new Request(`http://localhost/api/cases/${testCaseId}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "EMAIL",
          purpose: CommunicationMessageType.COMPLETION_CONFIRMATION,
          customMessage: "Hola Rosa, gracias por completar su primera visita de apoyo.",
          sendImmediately: true,
        }),
      }),
      { params: Promise.resolve({ id: testCaseId }) }
    );
    expect(humanRes.status).toBe(201);
    expect((await humanRes.json()).attempt.internalAiLabel).toBe("HUMAN_AUTHORED");

    // 4. GET ledger returns both records for Horizon, while Pacific Admin is blocked (404)
    const listRes = await getOutreachRoute(
      new Request(`http://localhost/api/cases/${testCaseId}/outreach`),
      { params: Promise.resolve({ id: testCaseId }) }
    );
    expect(listRes.status).toBe(200);
    expect((await listRes.json()).communications).toHaveLength(2);

    mockCookieMap.set(SESSION_COOKIE_NAME, pacificAdminToken);
    const crossTenantRes = await getOutreachRoute(
      new Request(`http://localhost/api/cases/${testCaseId}/outreach`),
      { params: Promise.resolve({ id: testCaseId }) }
    );
    expect(crossTenantRes.status).toBe(404);
  });
});
