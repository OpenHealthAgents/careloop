import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import {
  decideHumanApproval,
  requestHumanApproval,
  resumeAgentFromApproval,
} from "@/services/approval-service";
import {
  EXECUTION_JOURNAL_EVENT_TYPES,
  listCaseExecutionJournal,
  recordExecutionEvent,
} from "@/services/execution-journal-service";
import { executeCareLoopTool } from "@/services/tool-executor";

describe("Execution Journal Integration", () => {
  let tenantId = "";
  let otherTenantId = "";
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
    otherTenantId = otherTenant?.id ?? "non-existent-tenant";
    otherTenantSession = {
      ...careManagerSession,
      tenantId: otherTenantId,
      tenantSlug: otherTenant?.slug ?? "other-tenant",
    };

    const member = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: `MEM-JRN-${Date.now()}`,
        firstName: "Journal",
        lastName: "Tester",
        dobYear: 1989,
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
        externalReferralId: `REF-JRN-${Date.now()}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient therapy",
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
        status: "INTERVENTION_IN_PROGRESS",
        riskLevel: "MEDIUM",
        priorityScore: 60,
      },
    });
    testCaseId = careCase.id;
    testCaseIds.push(careCase.id);
  });

  afterAll(async () => {
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

  it("records structured execution journal events across tool execution and human approval lifecycle", async () => {
    const correlationId = `corr-journal-${Date.now()}`;

    await recordExecutionEvent({
      tenantId,
      caseId: testCaseId,
      actorType: "SYSTEM",
      actorId: careManagerSession.userId,
      eventType: EXECUTION_JOURNAL_EVENT_TYPES.REFERRAL_VALIDATED,
      inputReference: `referral:${testReferralIds[0]}`,
      outputReference: `case:${testCaseId}`,
      policyDecision: "ALLOW",
      evidence: ["eligibility=VERIFIED"],
      correlationId,
    });

    await executeCareLoopTool({
      session: careManagerSession,
      tool: "run_ai_assessment",
      input: { tenantId, caseId: testCaseId },
      correlationId,
    });

    const approval = await requestHumanApproval({
      session: careManagerSession,
      caseId: testCaseId,
      action: "escalate_to_human",
      reason: "High-risk escalation requires human approval.",
      toolInput: {
        caseId: testCaseId,
        escalationReason: "Escalating high-risk case after assessment.",
      },
      proposedNextState: "ESCALATED",
      correlationId,
    });

    await decideHumanApproval({
      session: careManagerSession,
      approvalId: approval.approval_id,
      decision: "APPROVED",
      comments: "Approved for escalation.",
      correlationId,
    });

    await resumeAgentFromApproval({
      session: careManagerSession,
      approvalId: approval.approval_id,
      correlationId,
    });

    const journal = await listCaseExecutionJournal(careManagerSession, testCaseId, {
      correlationId,
    });

    const eventTypes = journal.map((e) => e.event_type);
    expect(eventTypes).toEqual([
      "REFERRAL_VALIDATED",
      "BARRIER_INFERRED",
      "HUMAN_APPROVAL_REQUESTED",
      "HUMAN_APPROVAL_GRANTED",
      "CASE_ESCALATED",
      "AGENT_RESUMED",
    ]);

    for (const entry of journal) {
      expect(entry.event_id).toBeTruthy();
      expect(entry.case_id).toBe(testCaseId);
      expect(entry.actor_type).toBeTruthy();
      expect(entry.actor_id).toBeTruthy();
      expect(entry.timestamp).toBeTruthy();
      expect(entry.input_reference).toBeTruthy();
      expect(entry.output_reference).toBeTruthy();
      expect(entry.policy_decision).toBeTruthy();
      expect(Array.isArray(entry.evidence)).toBe(true);
      expect(entry.correlation_id).toBe(correlationId);
    }

    const filtered = await listCaseExecutionJournal(careManagerSession, testCaseId, {
      eventType: "HUMAN_APPROVAL_GRANTED",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].actor_type).toBe("HUMAN");
  });

  it("enforces tenant isolation on listCaseExecutionJournal", async () => {
    await expect(listCaseExecutionJournal(otherTenantSession, testCaseId)).rejects.toThrow(
      NotFoundError
    );
  });
});
