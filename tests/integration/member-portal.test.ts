import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AvailabilitySource, CaseStatus, RiskLevel, UserRole } from "@prisma/client";
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

import { POST as memberActionRoute } from "@/app/api/member-portal/[caseId]/actions/route";
import { GET as getMemberPortalRoute } from "@/app/api/member-portal/[caseId]/route";

describe("Member-Facing Portal Integration — Sanitization, Preferences, Scheduling & Support", () => {
  let horizonTenantId = "";
  let pacificTenantId = "";
  let cmToken = "";
  let execToken = "";
  let pacificAdminToken = "";

  let testCaseId = "";
  let testReferralId = "";
  let testMemberId = "";
  let verifiedProviderId = "";
  let testSlotId = "";

  beforeAll(async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    const pacific = await prisma.tenant.findUniqueOrThrow({ where: { slug: "pacific-medicare" } });
    horizonTenantId = horizon.id;
    pacificTenantId = pacific.id;

    const cm = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizonTenantId, role: UserRole.CARE_MANAGER },
    });
    const exec = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizonTenantId, role: UserRole.EXECUTIVE_READ_ONLY },
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
    execToken = createSessionToken({
      userId: exec.id,
      tenantId: horizon.id,
      tenantSlug: horizon.slug,
      email: exec.email,
      name: exec.name,
      role: exec.role,
    });
    pacificAdminToken = createSessionToken({
      userId: pacAdmin.id,
      tenantId: pacific.id,
      tenantSlug: pacific.slug,
      email: pacAdmin.email,
      name: pacAdmin.name,
      role: pacAdmin.role,
    });

    const verifiedProvider = await prisma.provider.findFirstOrThrow({
      where: {
        tenantId: horizonTenantId,
        availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY,
      },
    });
    verifiedProviderId = verifiedProvider.id;

    const slotStart = new Date(Date.now() + 2 * 86_400_000);
    const slotEnd = new Date(slotStart.getTime() + 50 * 60_000);
    const createdSlot = await prisma.providerAvailability.create({
      data: {
        tenantId: horizonTenantId,
        providerId: verifiedProviderId,
        slotStartAt: slotStart,
        slotEndAt: slotEnd,
        modality: "TELEHEALTH",
        status: "AVAILABLE",
      },
    });
    testSlotId = createdSlot.id;

    const suffix = Date.now();
    const member = await prisma.member.create({
      data: {
        tenantId: horizonTenantId,
        externalMemberId: `MEM-PORTAL-${suffix}`,
        firstName: "Sofia",
        lastName: "Reyes",
        preferredLanguage: "English",
        preferredContactChannel: "PORTAL",
        consentSms: false,
        consentOutreach: true,
        geography: "Central Metro",
        priorNoShowCount: 3,
      },
    });
    testMemberId = member.id;

    const referral = await prisma.referral.create({
      data: {
        tenantId: horizonTenantId,
        memberId: member.id,
        externalReferralId: `REF-PORTAL-${suffix}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient Counseling",
        specialty: "Outpatient Behavioral Health",
        geography: "Central Metro",
        networkRequired: "Horizon Medicaid",
        preferredLanguage: "English",
        operationalNotes: "INTERNAL SENSITIVE NOTE DO NOT SHOW MEMBER",
      },
    });
    testReferralId = referral.id;

    const careCase = await prisma.case.create({
      data: {
        tenantId: horizonTenantId,
        memberId: member.id,
        referralId: referral.id,
        status: CaseStatus.INTERVENTION_IN_PROGRESS,
        riskLevel: RiskLevel.HIGH,
        priorityScore: 91,
        riskExplanation: "INTERNAL RISK RATIONALE SECRET",
      },
    });
    testCaseId = careCase.id;
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
    if (testSlotId) {
      await prisma.providerAvailability.deleteMany({ where: { id: testSlotId } });
    }
  });

  it("never exposes risk scores or internal reasoning and completes full member journey cleanly", async () => {
    mockCookieMap.set(SESSION_COOKIE_NAME, cmToken);

    // 1. Fetch Member Portal view & verify plain-language headline + strict privacy redaction
    const viewRes = await getMemberPortalRoute(
      new Request(`http://localhost/api/member-portal/${testCaseId}`),
      { params: Promise.resolve({ caseId: testCaseId }) }
    );
    expect(viewRes.status).toBe(200);
    const { portal } = await viewRes.json();

    expect(portal.referralNotification.headline).toContain("You were referred to behavioral healthcare");
    expect(portal.referralNotification.headline).toContain("accept your insurance");
    expect(portal.referralNotification.headline).toContain("currently have appointments available this week");

    const serialized = JSON.stringify(portal);
    for (const forbidden of [
      "priorityScore",
      "riskLevel",
      "riskExplanation",
      "riskAssessments",
      "aiRecommendations",
      "INTERNAL RISK RATIONALE SECRET",
      "INTERNAL SENSITIVE NOTE DO NOT SHOW MEMBER",
      "priorNoShowCount",
      "confidence",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }

    // 2. Provider selection & Language / Channel Preferences
    const selectRes = await memberActionRoute(
      new Request(`http://localhost/api/member-portal/${testCaseId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SELECT_PROVIDER", providerId: verifiedProviderId }),
      }),
      { params: Promise.resolve({ caseId: testCaseId }) }
    );
    expect(selectRes.status).toBe(200);
    expect((await selectRes.json()).portal.selectedProviderId).toBe(verifiedProviderId);

    const prefsRes = await memberActionRoute(
      new Request(`http://localhost/api/member-portal/${testCaseId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_PREFERENCES",
          preferredLanguage: "Spanish",
          preferredContactChannel: "SMS",
          consentSms: true,
          consentOutreach: true,
        }),
      }),
      { params: Promise.resolve({ caseId: testCaseId }) }
    );
    expect(prefsRes.status).toBe(200);
    const prefsBody = await prefsRes.json();
    expect(prefsBody.portal.member.preferredLanguage).toBe("Spanish");
    expect(prefsBody.portal.referralNotification.headline).toContain("Usted fue referido");

    // 3. Book verified appointment option -> Confirm -> Send Reminder -> Reschedule
    const scheduleRes = await memberActionRoute(
      new Request(`http://localhost/api/member-portal/${testCaseId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REQUEST_APPOINTMENT",
          providerId: verifiedProviderId,
          slotId: testSlotId,
          requestedStartAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
          modality: "TELEHEALTH",
        }),
      }),
      { params: Promise.resolve({ caseId: testCaseId }) }
    );
    expect(scheduleRes.status).toBe(200);
    const apptId = (await scheduleRes.json()).portal.appointments[0].id as string;

    const confirmRes = await memberActionRoute(
      new Request(`http://localhost/api/member-portal/${testCaseId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CONFIRM_APPOINTMENT", appointmentId: apptId }),
      }),
      { params: Promise.resolve({ caseId: testCaseId }) }
    );
    expect(confirmRes.status).toBe(200);
    expect((await confirmRes.json()).portal.appointments[0].status).toBe("CONFIRMED");

    const remindRes = await memberActionRoute(
      new Request(`http://localhost/api/member-portal/${testCaseId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REQUEST_REMINDER",
          appointmentId: apptId,
          channel: "SMS",
        }),
      }),
      { params: Promise.resolve({ caseId: testCaseId }) }
    );
    expect(remindRes.status).toBe(200);
    expect((await remindRes.json()).portal.appointments[0].reminderChannel).toBe("SMS");

    const reschedRes = await memberActionRoute(
      new Request(`http://localhost/api/member-portal/${testCaseId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RESCHEDULE_APPOINTMENT",
          appointmentId: apptId,
          requestedStartAt: new Date(Date.now() + 6 * 86_400_000).toISOString(),
          reason: "Work shift changed",
        }),
      }),
      { params: Promise.resolve({ caseId: testCaseId }) }
    );
    expect(reschedRes.status).toBe(200);
    const reschedPortal = await reschedRes.json();
    expect(reschedPortal.portal.appointments.length).toBeGreaterThanOrEqual(2);

    // 4. Assistance / Question submission notifies care team
    const supportRes = await memberActionRoute(
      new Request(`http://localhost/api/member-portal/${testCaseId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SUBMIT_SUPPORT",
          kind: "ASSISTANCE",
          topic: "Transportation",
          message: "Can someone help me check transit options?",
        }),
      }),
      { params: Promise.resolve({ caseId: testCaseId }) }
    );
    expect(supportRes.status).toBe(200);

    // 5. RBAC & Tenant Isolation
    mockCookieMap.set(SESSION_COOKIE_NAME, execToken);
    const forbiddenWrite = await memberActionRoute(
      new Request(`http://localhost/api/member-portal/${testCaseId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SELECT_PROVIDER", providerId: verifiedProviderId }),
      }),
      { params: Promise.resolve({ caseId: testCaseId }) }
    );
    expect(forbiddenWrite.status).toBe(403);

    mockCookieMap.set(SESSION_COOKIE_NAME, pacificAdminToken);
    const crossTenantView = await getMemberPortalRoute(
      new Request(`http://localhost/api/member-portal/${testCaseId}`),
      { params: Promise.resolve({ caseId: testCaseId }) }
    );
    expect(crossTenantView.status).toBe(404);
  });
});
