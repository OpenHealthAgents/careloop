import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AuthorizationError, ValidationError } from "@/lib/errors";
import {
  cancelHumanApproval,
  decideHumanApproval,
  getApprovalRecord,
  listCaseApprovals,
  requestHumanApproval,
  resumeAgentFromApproval,
} from "@/services/approval-service";

describe("Human Approval Engine Integration", () => {
  let tenantId = "";
  let careManagerSession: SessionUser;
  let execSession: SessionUser;
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
    const exec = await prisma.user.findUniqueOrThrow({
      where: { tenantId_email: { tenantId, email: "exec@careloop.demo" } },
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
    execSession = {
      userId: exec.id,
      tenantId,
      tenantSlug: tenant.slug,
      email: exec.email,
      name: exec.name,
      role: exec.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const member = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: `MEM-APPR-${Date.now()}`,
        firstName: "Approval",
        lastName: "Tester",
        dobYear: 1991,
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
        externalReferralId: `REF-APPR-${Date.now()}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient counseling follow-up",
        specialty: "Outpatient Therapy",
        urgency: "HIGH",
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
        riskLevel: "HIGH",
        priorityScore: 82,
      },
    });
    testCaseId = careCase.id;
    testCaseIds.push(careCase.id);
  });

  afterAll(async () => {
    await prisma.approvalRequest.deleteMany({ where: { caseId: { in: testCaseIds } } });
    await prisma.workflowEvent.deleteMany({ where: { caseId: { in: testCaseIds } } });
    await prisma.auditEvent.deleteMany({
      where: {
        tenantId,
        entityType: { in: ["ApprovalRequest", "Case"] },
        entityId: { in: testCaseIds },
      },
    });
    await prisma.case.deleteMany({ where: { id: { in: testCaseIds } } });
    await prisma.referral.deleteMany({ where: { id: { in: testReferralIds } } });
    await prisma.member.deleteMany({ where: { id: { in: testMemberIds } } });
  });

  it("supports Agent -> Approval Request -> Human Decision -> Resume Agent from persisted state", async () => {
    const requested = await requestHumanApproval({
      session: careManagerSession,
      caseId: testCaseId,
      action: "escalate_to_human",
      reason: "High-risk case requires care manager approval before escalation.",
      toolInput: {
        caseId: testCaseId,
        escalationReason: "Repeated outreach attempts unanswered on high-risk referral.",
      },
      proposedNextState: "ESCALATED",
    });

    expect(requested.approval_id).toBeTruthy();
    expect(requested.case_id).toBe(testCaseId);
    expect(requested.action).toBe("escalate_to_human");
    expect(requested.risk_level).toBe("HIGH");
    expect(requested.requested_by).toBe("CareLoopCaseOrchestrator");
    expect(requested.status).toBe("PENDING");
    expect(requested.approved_by).toBeNull();
    expect(requested.decision).toBeNull();

    // Cannot resume before approval
    await expect(
      resumeAgentFromApproval({
        session: careManagerSession,
        approvalId: requested.approval_id,
      })
    ).rejects.toThrow(ValidationError);

    // Unauthorized role cannot decide
    await expect(
      decideHumanApproval({
        session: execSession,
        approvalId: requested.approval_id,
        decision: "APPROVED",
      })
    ).rejects.toThrow(AuthorizationError);

    // Human approves
    const decided = await decideHumanApproval({
      session: careManagerSession,
      approvalId: requested.approval_id,
      decision: "APPROVED",
      comments: "Reviewed timeline and approved escalation.",
    });

    expect(decided.status).toBe("APPROVED");
    expect(decided.approved_by).toBe(careManagerSession.userId);
    expect(decided.approved_at).toBeTruthy();
    expect(decided.decision).toBe("APPROVED");
    expect(decided.comments).toBe("Reviewed timeline and approved escalation.");

    // Resume agent from persisted state
    const resumed = await resumeAgentFromApproval({
      session: careManagerSession,
      approvalId: requested.approval_id,
    });

    expect(resumed.replayed).toBe(false);
    expect(resumed.approval.resumed_at).toBeTruthy();
    expect(resumed.toolResult.tool).toBe("escalate_to_human");
    expect(resumed.nextDecision.current_state).toBe("ESCALATED");

    const updatedCase = await prisma.case.findUniqueOrThrow({ where: { id: testCaseId } });
    expect(updatedCase.status).toBe("ESCALATED");
    expect(updatedCase.humanReviewRequired).toBe(false);

    // Idempotent replay on second resume call
    const replayed = await resumeAgentFromApproval({
      session: careManagerSession,
      approvalId: requested.approval_id,
    });
    expect(replayed.replayed).toBe(true);
  });

  it("enforces REJECTED, CANCELLED, and EXPIRED approval statuses", async () => {
    // 1. REJECTED
    const toReject = await requestHumanApproval({
      session: careManagerSession,
      caseId: testCaseId,
      action: "send_member_communication",
      reason: "Test rejection gate",
      toolInput: {
        caseId: testCaseId,
        channel: "SMS",
        messageType: "BARRIER_FOLLOWUP",
        body: "Checking in to help with your scheduling options.",
        sensitive: true,
      },
    });
    const rejected = await decideHumanApproval({
      session: careManagerSession,
      approvalId: toReject.approval_id,
      decision: "REJECTED",
      comments: "Not needed at this step.",
    });
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.decision).toBe("REJECTED");
    await expect(
      resumeAgentFromApproval({
        session: careManagerSession,
        approvalId: toReject.approval_id,
      })
    ).rejects.toThrow(ValidationError);

    // 2. CANCELLED
    const toCancel = await requestHumanApproval({
      session: careManagerSession,
      caseId: testCaseId,
      action: "send_member_communication",
      reason: "Test cancellation gate",
      toolInput: {
        caseId: testCaseId,
        channel: "SMS",
        messageType: "BARRIER_FOLLOWUP",
        body: "Checking in to help schedule your visit.",
        sensitive: true,
      },
    });
    const cancelled = await cancelHumanApproval({
      session: careManagerSession,
      approvalId: toCancel.approval_id,
      comments: "Superseded by member call.",
    });
    expect(cancelled.status).toBe("CANCELLED");

    // 3. EXPIRED
    const expiredReq = await requestHumanApproval({
      session: careManagerSession,
      caseId: testCaseId,
      action: "send_member_communication",
      reason: "Test expiration gate",
      toolInput: {
        caseId: testCaseId,
        channel: "SMS",
        messageType: "BARRIER_FOLLOWUP",
        body: "Checking in about your referral.",
        sensitive: true,
      },
      expiresAt: new Date(Date.now() - 60_000),
    });
    const fetched = await getApprovalRecord(careManagerSession, expiredReq.approval_id);
    expect(fetched.status).toBe("EXPIRED");
    await expect(
      decideHumanApproval({
        session: careManagerSession,
        approvalId: expiredReq.approval_id,
        decision: "APPROVED",
      })
    ).rejects.toThrow(ValidationError);

    const allApprovals = await listCaseApprovals(careManagerSession, testCaseId);
    expect(allApprovals.length).toBeGreaterThanOrEqual(4);
  });
});
