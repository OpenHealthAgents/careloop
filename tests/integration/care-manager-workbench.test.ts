import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  AIOperation,
  CaseStatus,
  RecommendationStatus,
  RiskLevel,
  UserRole,
} from "@prisma/client";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getCaseDetail } from "@/services/case-service";

const mockCookieMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieMap.get(name);
      return value ? { name, value } : undefined;
    },
  }),
}));

import { POST as addEvidenceRoute } from "@/app/api/cases/[id]/evidence/route";
import { POST as overrideRoute } from "@/app/api/cases/[id]/override/route";
import { POST as transitionRoute } from "@/app/api/cases/[id]/transition/route";

describe("Care Manager Workbench — Detail Context, Add Evidence, Override, Close & Audit", () => {
  let tenantId = "";
  let cmToken = "";
  let memberId = "";
  let referralId = "";
  let caseId = "";

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

    const suffix = Date.now();
    const member = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: `MEM-WB-${suffix}`,
        firstName: "Nora",
        lastName: "Patel",
        preferredLanguage: "English",
        geography: "Central Metro",
      },
    });
    memberId = member.id;

    const referral = await prisma.referral.create({
      data: {
        tenantId,
        memberId,
        externalReferralId: `REF-WB-${suffix}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient Counseling",
        specialty: "Behavioral Health",
        geography: "Central Metro",
        networkRequired: "Horizon PPO",
      },
    });
    referralId = referral.id;

    const careCase = await prisma.case.create({
      data: {
        tenantId,
        memberId,
        referralId,
        status: CaseStatus.INTERVENTION_IN_PROGRESS,
        riskLevel: RiskLevel.HIGH,
        priorityScore: 82,
      },
    });
    caseId = careCase.id;

    await prisma.aIRecommendation.create({
      data: {
        tenantId,
        caseId,
        referralId,
        operation: AIOperation.RECOMMEND_INTERVENTION,
        status: RecommendationStatus.PENDING,
        providerName: "MOCK",
        modelVersion: "v1",
        promptVersion: "v1",
        inputContext: {},
        outputPayload: { nextBestAction: "send_member_communication" },
        resultingAction: "RECOMMENDED_SMS_OUTREACH",
        facts: ["Member has active referral"],
        inferences: [],
        recommendations: ["Send SMS outreach"],
        confidence: 0.88,
        uncertainty: "Low",
        evidenceSignals: ["referral.created"],
      },
    });
  });

  afterAll(async () => {
    mockCookieMap.clear();
    if (caseId) {
      await prisma.evidence.deleteMany({ where: { caseId } });
      await prisma.caseNote.deleteMany({ where: { caseId } });
      await prisma.aIRecommendation.deleteMany({ where: { caseId } });
      await prisma.workflowEvent.deleteMany({ where: { caseId } });
      await prisma.case.deleteMany({ where: { id: caseId } });
    }
    if (referralId) {
      await prisma.referral.deleteMany({ where: { id: referralId } });
    }
    if (memberId) {
      await prisma.member.deleteMany({ where: { id: memberId } });
    }
  });

  it("exposes workbench context and audits human add-evidence, override, and close-case actions", async () => {
    mockCookieMap.set(SESSION_COOKIE_NAME, cmToken);

    // 1. Add evidence
    const evRes = await addEvidenceRoute(
      new Request(`http://localhost:3000/api/cases/${caseId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "CARE_MANAGER_ATTESTATION",
          summary: "Confirmed with clinic front desk that member prefers morning telehealth.",
        }),
      }),
      { params: Promise.resolve({ id: caseId }) }
    );
    expect(evRes.status).toBe(201);

    // 2. Override AI recommendation
    const ovRes = await overrideRoute(
      new Request(`http://localhost:3000/api/cases/${caseId}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrideAction: "Direct phone call by bilingual coordinator",
          rationale: "Member requested live phone support over SMS.",
        }),
      }),
      { params: Promise.resolve({ id: caseId }) }
    );
    expect(ovRes.status).toBe(200);

    // 3. Escalate case, then close case
    const escalateRes = await transitionRoute(
      new Request(`http://localhost:3000/api/cases/${caseId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toStatus: "ESCALATED",
          reason: "Care Manager escalated for supervisor review.",
          escalationReason: "Care Manager escalated for supervisor review.",
        }),
      }),
      { params: Promise.resolve({ id: caseId }) }
    );
    expect(escalateRes.status).toBe(200);

    const closeRes = await transitionRoute(
      new Request(`http://localhost:3000/api/cases/${caseId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toStatus: "CLOSED",
          reason: "Care journey completed and verified.",
          closureReason: "Care journey completed and verified.",
        }),
      }),
      { params: Promise.resolve({ id: caseId }) }
    );
    expect(closeRes.status).toBe(200);

    // 4. Verify workbench detail includes all sections & audited human actions
    const detail = await getCaseDetail(tenantId, caseId);
    expect(detail.member.firstName).toBe("Nora");
    expect(detail.referral.specialty).toBe("Behavioral Health");
    expect(detail.status).toBe(CaseStatus.CLOSED);
    expect(detail.evidences.length).toBe(1);
    expect(detail.aiRecommendations[0].status).toBe(RecommendationStatus.MODIFIED);
    expect(Array.isArray(detail.approvalRequests)).toBe(true);
    expect(Array.isArray(detail.agentRuns)).toBe(true);
    expect(Array.isArray(detail.executionJournalEvents)).toBe(true);

    const actions = detail.auditEvents.map((e) => e.action);
    expect(actions).toContain("HUMAN_EVIDENCE_ADDED");
    expect(actions).toContain("HUMAN_OVERRIDE_RECORDED");
  });
});
