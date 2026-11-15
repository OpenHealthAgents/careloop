import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { runOrchestratorWithApprovalGate } from "@/services/approval-service";
import {
  computeInputContextHash,
  listCaseDecisionTraces,
  recordAIDecisionTrace,
  sanitizeConciseDecisionExplanation,
} from "@/services/decision-trace-service";

describe("AI Decision Trace Integration", () => {
  let tenantId = "";
  let careManagerSession: SessionUser;
  let otherTenantSession: SessionUser;
  let testCaseId = "";
  const testReferralIds: string[] = [];
  const testMemberIds: string[] = [];
  const testCaseIds: string[] = [];

  beforeAll(async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    tenantId = tenant.id;
    const cm = await prisma.user.findUniqueOrThrow({
      where: { tenantId_email: { tenantId, email: "care.manager@careloop.demo" } },
    });
    careManagerSession = {
      userId: cm.id,
      tenantId,
      tenantSlug: tenant.slug,
      email: cm.email,
      name: cm.name,
      role: cm.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const otherTenant = await prisma.tenant.findFirst({
      where: { id: { not: tenantId } },
    });
    otherTenantSession = {
      ...careManagerSession,
      tenantId: otherTenant?.id ?? "non-existent-tenant",
      tenantSlug: otherTenant?.slug ?? "other-tenant",
    };

    const member = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: `MEM-TRC-${Date.now()}`,
        firstName: "Trace",
        lastName: "Tester",
        dobYear: 1992,
        geography: "Central Metro",
        urbanicity: "URBAN",
        preferredLanguage: "English",
        coverageType: "MEDICAID",
        consentOutreach: true,
        consentSms: true,
      },
    });
    testMemberIds.push(member.id);

    const referral = await prisma.referral.create({
      data: {
        tenantId,
        memberId: member.id,
        externalReferralId: `REF-TRC-${Date.now()}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient counseling",
        specialty: "Outpatient Therapy",
        urgency: "ROUTINE",
        geography: "Central Metro",
        networkRequired: "HorizonCare",
        preferredLanguage: "English",
        eligibilityVerified: "VERIFIED",
        status: "IN_CASE",
      },
    });
    testReferralIds.push(referral.id);

    const careCase = await prisma.case.create({
      data: {
        tenantId,
        referralId: referral.id,
        memberId: member.id,
        status: "NEW",
        riskLevel: "MEDIUM",
        priorityScore: 55,
      },
    });
    testCaseId = careCase.id;
    testCaseIds.push(careCase.id);
  });

  afterAll(async () => {
    await prisma.aIDecisionTrace.deleteMany({ where: { caseId: { in: testCaseIds } } });
    await prisma.executionJournalEvent.deleteMany({ where: { caseId: { in: testCaseIds } } });
    await prisma.approvalRequest.deleteMany({ where: { caseId: { in: testCaseIds } } });
    await prisma.workflowEvent.deleteMany({ where: { caseId: { in: testCaseIds } } });
    await prisma.auditEvent.deleteMany({
      where: {
        tenantId,
        entityId: { in: testCaseIds },
      },
    });
    await prisma.case.deleteMany({ where: { id: { in: testCaseIds } } });
    await prisma.referral.deleteMany({ where: { id: { in: testReferralIds } } });
    await prisma.member.deleteMany({ where: { id: { in: testMemberIds } } });
  });

  it("computes deterministic input_context_hash and strips hidden chain-of-thought", () => {
    const hashA = computeInputContextHash({ b: 2, a: { y: "hello", x: 1 } });
    const hashB = computeInputContextHash({ a: { x: 1, y: "hello" }, b: 2 });
    const hashC = computeInputContextHash({ a: { x: 2, y: "hello" }, b: 2 });

    expect(hashA).toHaveLength(64);
    expect(hashA).toBe(hashB);
    expect(hashA).not.toBe(hashC);

    const sanitized = sanitizeConciseDecisionExplanation(
      "<think>Internal hidden chain of thought</think><reasoning>Secret step</reasoning>Offer scheduling assistance based on verified availability."
    );
    expect(sanitized).toBe("Offer scheduling assistance based on verified availability.");
    expect(sanitized).not.toContain("Internal hidden");
    expect(sanitized).not.toContain("Secret step");
  });

  it("persists canonical AI decision trace records during orchestrator execution and enforces tenant isolation", async () => {
    const correlationId = `corr-trace-${Date.now()}`;

    const gatedResult = await runOrchestratorWithApprovalGate({
      session: careManagerSession,
      caseId: testCaseId,
      correlationId,
    });
    expect(gatedResult.decision.tool).toBe("run_ai_assessment");

    await recordAIDecisionTrace({
      tenantId,
      caseId: testCaseId,
      inputContext: { caseId: testCaseId, step: "manual-check" },
      decision: "<think>raw chain</think>Recommend outreach via preferred channel.",
      confidence: 0.84,
      evidence: ["consentOutreach=true", "preferredLanguage=English"],
      policyResult: "ALLOW",
      toolSelected: "send_member_communication",
      humanApprovalRequired: false,
      correlationId,
    });

    const traces = await listCaseDecisionTraces(careManagerSession, testCaseId, {
      correlationId,
    });
    expect(traces).toHaveLength(2);

    for (const trace of traces) {
      expect(trace.decision_id).toBeTruthy();
      expect(trace.case_id).toBe(testCaseId);
      expect(trace.agent).toBe("CareLoopCaseOrchestrator");
      expect(trace.model).toBeTruthy();
      expect(trace.prompt_version).toBeTruthy();
      expect(trace.input_context_hash).toHaveLength(64);
      expect(trace.decision).toBeTruthy();
      expect(trace.decision).not.toContain("raw chain");
      expect(trace.confidence).toBeGreaterThanOrEqual(0);
      expect(trace.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(trace.evidence)).toBe(true);
      expect(trace.policy_result).toBeTruthy();
      expect(trace.tool_selected).toBeTruthy();
      expect(typeof trace.human_approval_required).toBe("boolean");
      expect(trace.created_at).toBeTruthy();
    }

    await expect(listCaseDecisionTraces(otherTenantSession, testCaseId)).rejects.toThrow(
      NotFoundError
    );
  });
});
