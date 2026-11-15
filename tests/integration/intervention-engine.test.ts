import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  InterventionExecutionMode,
  InterventionStatus,
  InterventionType,
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

import { POST as executeAutomated } from "@/app/api/interventions/[id]/execute/route";
import { POST as recordOutcomeRoute } from "@/app/api/interventions/[id]/outcomes/route";
import { POST as reviewInterventionRoute } from "@/app/api/interventions/[id]/review/route";

describe("Intervention Engine Integration — Approval, High-Risk Auto-Exec Block & Outcome Tracking", () => {
  let horizonTenantId = "";
  let pacificTenantId = "";
  let cmToken = "";
  let execToken = "";
  let pacificAdminToken = "";

  let lowRiskCaseId = "";
  let highRiskCaseId = "";
  let lowRiskAutoInvId = "";
  let highRiskHumanInvId = "";
  const createdCaseIds: string[] = [];
  const createdRefIds: string[] = [];
  const createdMemberIds: string[] = [];

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
        externalMemberId: `MEM-INT-${suffix}`,
        firstName: "Nora",
        lastName: "Valdez",
        preferredLanguage: "English",
        geography: "Central Metro",
      },
    });
    createdMemberIds.push(member.id);

    const lowRef = await prisma.referral.create({
      data: {
        tenantId: horizonTenantId,
        memberId: member.id,
        externalReferralId: `REF-LOW-${suffix}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient Counseling",
        specialty: "Outpatient Behavioral Health",
        geography: "Central Metro",
        networkRequired: "Horizon Medicaid",
        preferredLanguage: "English",
      },
    });
    const highRef = await prisma.referral.create({
      data: {
        tenantId: horizonTenantId,
        memberId: member.id,
        externalReferralId: `REF-HIGH-${suffix}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Psychiatric Evaluation",
        specialty: "Psychiatry",
        geography: "Central Metro",
        networkRequired: "Horizon Medicaid",
        preferredLanguage: "English",
      },
    });
    createdRefIds.push(lowRef.id, highRef.id);

    const lowCase = await prisma.case.create({
      data: {
        tenantId: horizonTenantId,
        memberId: member.id,
        referralId: lowRef.id,
        riskLevel: RiskLevel.LOW,
        priorityScore: 22,
      },
    });
    const highCase = await prisma.case.create({
      data: {
        tenantId: horizonTenantId,
        memberId: member.id,
        referralId: highRef.id,
        riskLevel: RiskLevel.HIGH,
        priorityScore: 89,
      },
    });
    lowRiskCaseId = lowCase.id;
    highRiskCaseId = highCase.id;
    createdCaseIds.push(lowCase.id, highCase.id);

    const autoInv = await prisma.intervention.create({
      data: {
        tenantId: horizonTenantId,
        caseId: lowRiskCaseId,
        type: InterventionType.BENEFIT_NETWORK_EXPLANATION,
        reason: "Network confusion flagged on routine LOW-risk case",
        triggeringBarrierCategory: "ADMINISTRATIVE",
        triggeringBarrierCode: "network confusion",
        recommendedAction: "Send in-network Horizon Medicaid coverage explanation",
        executionMode: InterventionExecutionMode.AUTOMATED,
        automationEligible: true,
        isHighRisk: false,
        confidence: 0.86,
        requiredHumanInvolvement: "Optional review on LOW risk",
        expectedOutcome: "Member understands in-network benefits",
        status: InterventionStatus.RECOMMENDED,
      },
    });
    lowRiskAutoInvId = autoInv.id;

    const highInv = await prisma.intervention.create({
      data: {
        tenantId: horizonTenantId,
        caseId: highRiskCaseId,
        type: InterventionType.TRANSPORTATION_SUPPORT,
        reason: "High-risk member lacks transit to appointment",
        triggeringBarrierCategory: "SOCIAL_LOGISTICAL",
        triggeringBarrierCode: "transportation",
        recommendedAction: "Arrange plan NEMT voucher",
        executionMode: InterventionExecutionMode.HUMAN_ASSISTED,
        automationEligible: false,
        isHighRisk: true,
        confidence: 0.89,
        requiredHumanInvolvement: "Care Manager approval required prior to dispatch",
        expectedOutcome: "Confirmed NEMT round-trip booking",
        status: InterventionStatus.RECOMMENDED,
      },
    });
    highRiskHumanInvId = highInv.id;
  });

  afterAll(async () => {
    for (const caseId of createdCaseIds) {
      await prisma.case.deleteMany({ where: { id: caseId } });
    }
    for (const refId of createdRefIds) {
      await prisma.referral.deleteMany({ where: { id: refId } });
    }
    for (const memId of createdMemberIds) {
      await prisma.member.deleteMany({ where: { id: memId } });
    }
  });

  it("blocks automated execution on high-risk interventions, allows guarded low-risk automation, and audits approval + outcomes", async () => {
    // 1. High-risk intervention MUST fail automated execution (400 VALIDATION_ERROR) and log audit block
    mockCookieMap.set(SESSION_COOKIE_NAME, cmToken);
    const blockedRes = await executeAutomated(
      new Request(`http://localhost/api/interventions/${highRiskHumanInvId}/execute`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: highRiskHumanInvId }) }
    );
    expect(blockedRes.status).toBe(400);

    const blockAudit = await prisma.auditEvent.findFirst({
      where: {
        tenantId: horizonTenantId,
        entityType: "Intervention",
        entityId: highRiskHumanInvId,
        action: "INTERVENTION_AUTO_EXECUTION_BLOCKED",
      },
    });
    expect(blockAudit).not.toBeNull();

    // 2. Low-risk AUTOMATED intervention executes cleanly and writes tracked outcome
    const autoRes = await executeAutomated(
      new Request(`http://localhost/api/interventions/${lowRiskAutoInvId}/execute`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: lowRiskAutoInvId }) }
    );
    expect(autoRes.status).toBe(200);
    const autoBody = await autoRes.json();
    expect(autoBody.intervention.status).toBe("COMPLETED");
    expect(autoBody.intervention.autoExecuted).toBe(true);
    expect(autoBody.intervention.outcomes).toHaveLength(1);

    // 3. Executive read-only cannot approve (403); Pacific admin cannot cross-tenant review (404)
    mockCookieMap.set(SESSION_COOKIE_NAME, execToken);
    const forbiddenApprove = await reviewInterventionRoute(
      new Request(`http://localhost/api/interventions/${highRiskHumanInvId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "APPROVE" }),
      }),
      { params: Promise.resolve({ id: highRiskHumanInvId }) }
    );
    expect(forbiddenApprove.status).toBe(403);

    mockCookieMap.set(SESSION_COOKIE_NAME, pacificAdminToken);
    const crossTenantApprove = await reviewInterventionRoute(
      new Request(`http://localhost/api/interventions/${highRiskHumanInvId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "APPROVE" }),
      }),
      { params: Promise.resolve({ id: highRiskHumanInvId }) }
    );
    expect(crossTenantApprove.status).toBe(404);

    // 4. Care Manager approves high-risk HUMAN_ASSISTED intervention -> completes -> logs outcome
    mockCookieMap.set(SESSION_COOKIE_NAME, cmToken);
    const approveRes = await reviewInterventionRoute(
      new Request(`http://localhost/api/interventions/${highRiskHumanInvId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "APPROVE", notes: "Verified NEMT eligibility" }),
      }),
      { params: Promise.resolve({ id: highRiskHumanInvId }) }
    );
    expect(approveRes.status).toBe(200);
    expect((await approveRes.json()).intervention.status).toBe("APPROVED");

    const completeRes = await reviewInterventionRoute(
      new Request(`http://localhost/api/interventions/${highRiskHumanInvId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "COMPLETE",
          outcome: "NEMT ride scheduled for initial visit",
          barriersResolved: true,
        }),
      }),
      { params: Promise.resolve({ id: highRiskHumanInvId }) }
    );
    expect(completeRes.status).toBe(200);
    expect((await completeRes.json()).intervention.status).toBe("COMPLETED");

    // Record explicit follow-up outcome
    const outcomeRes = await recordOutcomeRoute(
      new Request(`http://localhost/api/interventions/${highRiskHumanInvId}/outcomes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcomeStatus: "CONFIRMED_TRANSIT_PICKUP",
          summary: "Member confirmed ride voucher SMS confirmation received",
          barriersResolved: true,
          followUpRequired: false,
        }),
      }),
      { params: Promise.resolve({ id: highRiskHumanInvId }) }
    );
    expect(outcomeRes.status).toBe(201);

    const outcomes = await prisma.interventionOutcome.findMany({
      where: { interventionId: highRiskHumanInvId },
    });
    expect(outcomes.length).toBeGreaterThanOrEqual(2);
  });
});
