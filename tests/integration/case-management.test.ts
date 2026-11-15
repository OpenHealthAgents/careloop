import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CaseStatus, RiskLevel, UserRole } from "@prisma/client";
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

import { GET as listCasesRoute } from "@/app/api/cases/route";
import { GET as getCaseDetailRoute } from "@/app/api/cases/[id]/route";
import { GET as getCaseNotesRoute, POST as addCaseNoteRoute } from "@/app/api/cases/[id]/notes/route";
import { POST as transitionCaseRoute } from "@/app/api/cases/[id]/transition/route";

describe("Case Management System Integration — Transitions, WorkflowEvents, Notes, Audit & Detail", () => {
  let horizonTenantId = "";
  let pacificTenantId = "";
  let cmToken = "";
  let execToken = "";
  let pacificAdminToken = "";

  let testCaseId = "";
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

    const suffix = Date.now();
    const member = await prisma.member.create({
      data: {
        tenantId: horizonTenantId,
        externalMemberId: `MEM-CM-${suffix}`,
        firstName: "Lucas",
        lastName: "Mendez",
        preferredLanguage: "Spanish",
        geography: "North Valley",
      },
    });
    testMemberId = member.id;

    const referral = await prisma.referral.create({
      data: {
        tenantId: horizonTenantId,
        memberId: member.id,
        externalReferralId: `REF-CM-${suffix}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient Therapy",
        specialty: "Outpatient Behavioral Health",
        geography: "North Valley",
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
        status: CaseStatus.NEW,
        riskLevel: RiskLevel.MEDIUM,
        priorityScore: 55,
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
  });

  it("blocks arbitrary state transitions, logs WorkflowEvents for valid transitions, manages CaseNotes, and exposes Audit History in Case Detail", async () => {
    mockCookieMap.set(SESSION_COOKIE_NAME, cmToken);

    // 1. Reject arbitrary jump NEW -> VERIFIED (409 InvalidStateTransitionError)
    const invalidJump = await transitionCaseRoute(
      new Request(`http://localhost/api/cases/${testCaseId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus: "VERIFIED", reason: "Attempted invalid jump" }),
      }),
      { params: Promise.resolve({ id: testCaseId }) }
    );
    expect(invalidJump.status).toBe(409);

    // 2. Valid transitions: NEW -> TRIAGED -> ESCALATED -> BLOCKED -> REQUIRES_HUMAN_REVIEW
    const transitions: Array<{ toStatus: CaseStatus; reason: string }> = [
      { toStatus: "TRIAGED", reason: "Initial intake scoring finished" },
      { toStatus: "ESCALATED", reason: "Escalated due to member language & urgency flags" },
      { toStatus: "BLOCKED", reason: "Awaiting external clinic callback" },
      { toStatus: "REQUIRES_HUMAN_REVIEW", reason: "Needs supervisor authorization check" },
    ];

    for (const tr of transitions) {
      const res = await transitionCaseRoute(
        new Request(`http://localhost/api/cases/${testCaseId}/transition`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tr),
        }),
        { params: Promise.resolve({ id: testCaseId }) }
      );
      expect(res.status).toBe(200);
    }

    // 3. Add Care Manager Note
    const noteRes = await addCaseNoteRoute(
      new Request(`http://localhost/api/cases/${testCaseId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "COORDINATION",
          content: "Spoke with Spanish interpreter desk; callback scheduled for tomorrow 10am.",
        }),
      }),
      { params: Promise.resolve({ id: testCaseId }) }
    );
    expect(noteRes.status).toBe(201);

    // 4. Case List query filtering locates the test case
    const listRes = await listCasesRoute(
      new Request(
        "http://localhost/api/cases?status=REQUIRES_HUMAN_REVIEW&search=Lucas"
      )
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.cases.some((c: { id: string }) => c.id === testCaseId)).toBe(true);

    // 5. Case Detail returns unified timeline, notes, auditEvents, and allowedNextStatuses
    const detailRes = await getCaseDetailRoute(
      new Request(`http://localhost/api/cases/${testCaseId}`),
      { params: Promise.resolve({ id: testCaseId }) }
    );
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();

    expect(detail.careCase.status).toBe("REQUIRES_HUMAN_REVIEW");
    expect(detail.careCase.workflowEvents).toHaveLength(4);
    expect(detail.careCase.caseNotes).toHaveLength(1);
    expect(detail.careCase.auditEvents.some((a: { action: string }) => a.action === "CASE_NOTE_ADDED")).toBe(
      true
    );
    expect(
      detail.careCase.auditEvents.some((a: { action: string }) => a.action === "CASE_STATUS_TRANSITION")
    ).toBe(true);
    expect(detail.allowedNextStatuses).toContain("BARRIER_IDENTIFIED");

    // 6. RBAC & Tenant Isolation on Case Notes
    mockCookieMap.set(SESSION_COOKIE_NAME, execToken);
    const readonlyNoteRes = await addCaseNoteRoute(
      new Request(`http://localhost/api/cases/${testCaseId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "COORDINATION", content: "Readonly attempt" }),
      }),
      { params: Promise.resolve({ id: testCaseId }) }
    );
    expect(readonlyNoteRes.status).toBe(403);

    mockCookieMap.set(SESSION_COOKIE_NAME, pacificAdminToken);
    const crossTenantNotesRes = await getCaseNotesRoute(
      new Request(`http://localhost/api/cases/${testCaseId}/notes`),
      { params: Promise.resolve({ id: testCaseId }) }
    );
    expect(crossTenantNotesRes.status).toBe(404);
  });
});
