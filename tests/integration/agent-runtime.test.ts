import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CareLoopAgentRuntime, RuntimeToolExecutor } from "@/agent_runtime";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { decideHumanApproval } from "@/services/approval-service";
import { listCaseExecutionJournal } from "@/services/execution-journal-service";

describe("CareLoop Agent Runtime Integration (Persistence, Restartability & Full Lifecycle)", () => {
  let tenantId = "";
  let careManagerSession: SessionUser;
  let testCaseId = "";
  let testMemberId = "";
  let testReferralId = "";

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

    const member = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: `MEM-RT-${Date.now()}`,
        firstName: "Runtime",
        lastName: "Tester",
        dobYear: 1990,
        geography: "Central Metro",
        urbanicity: "URBAN",
        preferredLanguage: "English",
        coverageType: "MEDICAID",
        consentOutreach: true,
        consentSms: true,
      },
    });
    testMemberId = member.id;

    const referral = await prisma.referral.create({
      data: {
        tenantId,
        memberId: member.id,
        externalReferralId: `REF-RT-${Date.now()}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient therapy intake",
        specialty: "Outpatient Therapy",
        urgency: "HIGH",
        geography: "Central Metro",
        networkRequired: "HorizonCare",
        preferredLanguage: "English",
        eligibilityVerified: "VERIFIED",
        status: "IN_CASE",
      },
    });
    testReferralId = referral.id;

    const careCase = await prisma.case.create({
      data: {
        tenantId,
        referralId: referral.id,
        memberId: member.id,
        status: "TRIAGED",
        riskLevel: "LOW",
        priorityScore: 40,
        goal: "Complete verified initial Outpatient Therapy visit",
      },
    });
    testCaseId = careCase.id;
  });

  afterAll(async () => {
    if (testCaseId) {
      await prisma.evidence.deleteMany({ where: { tenantId, caseId: testCaseId } });
      await prisma.executionJournalEvent.deleteMany({ where: { tenantId, caseId: testCaseId } });
      await prisma.aIDecisionTrace.deleteMany({ where: { tenantId, caseId: testCaseId } });
      await prisma.agentRun.deleteMany({ where: { tenantId, caseId: testCaseId } });
      await prisma.approvalRequest.deleteMany({ where: { tenantId, caseId: testCaseId } });
      await prisma.workflowEvent.deleteMany({ where: { tenantId, caseId: testCaseId } });
      await prisma.case.deleteMany({ where: { id: testCaseId } });
    }
    if (testReferralId) await prisma.referral.deleteMany({ where: { id: testReferralId } });
    if (testMemberId) await prisma.member.deleteMany({ where: { id: testMemberId } });
  });

  it("supports start -> pause -> restartable resume across distinct runtime instances", async () => {
    const lowRiskPlanner = {
      plan: (input: Parameters<CareLoopAgentRuntime["planner"]["plan"]>[0]) => ({
        case_id: input.case_id,
        goal: input.goal ?? "Complete verified initial Outpatient Therapy visit",
        current_state: input.current_state,
        recommended_action: "Run AI barrier assessment",
        tool: "run_ai_assessment" as const,
        proposed_next_state: null,
        requires_human: false,
        policy_check_required: true,
        confidence: 0.92,
        evidence: ["Intake validated; ready for assessment"],
        expected_outcome: "Barriers and risk assessed",
        fallback_action: "escalate_to_human" as const,
        reason: "Proceeding with initial assessment.",
      }),
    };

    const runtimeWorker1 = new CareLoopAgentRuntime({ planner: lowRiskPlanner });
    const started = await runtimeWorker1.start({
      session: careManagerSession,
      caseId: testCaseId,
      pauseAfterPlan: true,
      correlationId: "rt-pause-resume-1",
    });

    expect(started.run.status).toBe("PAUSED");
    expect(started.run.currentStep).toBe("PAUSED_AFTER_PLAN");
    expect(started.run.goal).toBe("Complete verified initial Outpatient Therapy visit");
    expect(started.decision?.tool).toBe("run_ai_assessment");

    // Simulate process restart with a brand-new CareLoopAgentRuntime instance
    const runtimeWorker2 = new CareLoopAgentRuntime({ planner: lowRiskPlanner });
    const resumed = await runtimeWorker2.resume({
      session: careManagerSession,
      runId: started.run.id,
      correlationId: "rt-pause-resume-2",
    });

    expect(resumed.run.status).toBe("COMPLETED");
    expect(resumed.run.currentStep).toBe("COMPLETED");

    const journal = await listCaseExecutionJournal(careManagerSession, testCaseId);
    const eventTypes = journal.map((e) => e.event_type);
    expect(eventTypes).toContain("AGENT_STARTED");
    expect(eventTypes).toContain("AGENT_PAUSED");
    expect(eventTypes).toContain("AGENT_RESUMED");
    expect(eventTypes).toContain("AGENT_COMPLETED");
  });

  it("pauses on REQUIRE_APPROVAL and resumes after human approval on a fresh runtime", async () => {
    const runtimeWorker1 = new CareLoopAgentRuntime({
      planner: {
        plan: (input) => ({
          case_id: input.case_id,
          goal: input.goal ?? "Complete verified initial Outpatient Therapy visit",
          current_state: input.current_state,
          recommended_action: "Send sensitive member communication",
          tool: "send_member_communication",
          proposed_next_state: null,
          requires_human: true,
          policy_check_required: true,
          confidence: 0.91,
          evidence: ["High-risk case requires human sign-off for sensitive communication"],
          expected_outcome: "Human reviewer approves sensitive communication",
          fallback_action: "escalate_to_human",
          reason: "Sensitive communication requires human approval before execution.",
        }),
      },
    });

    const gated = await runtimeWorker1.start({
      session: careManagerSession,
      caseId: testCaseId,
      sensitiveCommunication: true,
      toolInput: {
        caseId: testCaseId,
        channel: "PORTAL",
        messageType: "FOLLOW_UP_REMINDER",
        body: "Please confirm your upcoming appointment.",
        sensitive: true,
      },
      correlationId: "rt-approval-1",
    });

    expect(gated.run.status).toBe("AWAITING_APPROVAL");
    expect(gated.approval?.status).toBe("PENDING");

    // Cannot resume before approval
    await expect(
      runtimeWorker1.resume({ session: careManagerSession, runId: gated.run.id })
    ).rejects.toThrow(ValidationError);

    // Human approves
    await decideHumanApproval({
      session: careManagerSession,
      approvalId: gated.approval!.approval_id,
      decision: "APPROVED",
      comments: "Approved for runtime continuation",
    });

    // Fresh runtime instance resumes after approval
    let executedWithApproval = false;
    const stubExecutor: RuntimeToolExecutor = {
      execute: async (_session, call) => {
        executedWithApproval = Boolean(call.humanApproved);
        return {
          success: true,
          data: { ok: true },
          evidence: [{ approved: true }],
          error: null,
          metadata: { tool: call.tool },
        };
      },
    };
    const runtimeWorker2 = new CareLoopAgentRuntime({
      planner: {
        plan: (input) => ({
          case_id: input.case_id,
          goal: input.goal ?? "Complete verified initial Outpatient Therapy visit",
          current_state: input.current_state,
          recommended_action: "Execute approved communication",
          tool: "send_member_communication",
          proposed_next_state: null,
          requires_human: false,
          policy_check_required: true,
          confidence: 0.95,
          evidence: ["Human approval granted"],
          expected_outcome: "Approved action executed",
          fallback_action: "escalate_to_human",
          reason: "Proceeding with approved action.",
        }),
      },
      toolExecutor: stubExecutor,
    });

    const resumed = await runtimeWorker2.resume({
      session: careManagerSession,
      runId: gated.run.id,
      correlationId: "rt-approval-2",
    });

    expect(executedWithApproval).toBe(true);
    expect(resumed.run.status).toBe("COMPLETED");
    expect(resumed.toolResult?.success).toBe(true);
  });

  it("persists failure state and supports retry() on a restarted runtime up to maxRetries", async () => {
    let attempts = 0;
    const flakyExecutor: RuntimeToolExecutor = {
      execute: async (_session, call) => {
        attempts += 1;
        if (attempts === 1) {
          return {
            success: false,
            data: null,
            evidence: [],
            error: { code: "TRANSIENT_FAILURE", message: "Upstream adapter timeout" },
            metadata: { tool: call.tool },
          };
        }
        return {
          success: true,
          data: { recovered: true },
          evidence: [],
          error: null,
          metadata: { tool: call.tool },
        };
      },
    };

    const assessmentPlanner = {
      plan: (input: Parameters<CareLoopAgentRuntime["planner"]["plan"]>[0]) => ({
        case_id: input.case_id,
        goal: input.goal ?? "Complete verified initial Outpatient Therapy visit",
        current_state: input.current_state,
        recommended_action: "Run AI barrier assessment",
        tool: "run_ai_assessment" as const,
        proposed_next_state: null,
        requires_human: false,
        policy_check_required: true,
        confidence: 0.9,
        evidence: ["Assessment needed"],
        expected_outcome: "Assessment completed",
        fallback_action: "escalate_to_human" as const,
        reason: "Running initial assessment.",
      }),
    };

    const worker1 = new CareLoopAgentRuntime({
      planner: assessmentPlanner,
      toolExecutor: flakyExecutor,
    });
    const first = await worker1.start({
      session: careManagerSession,
      caseId: testCaseId,
      toolInput: { caseId: testCaseId },
      maxRetries: 2,
      correlationId: "rt-retry-1",
    });

    expect(first.run.status).toBe("FAILED");
    expect(first.run.lastError).toContain("Upstream adapter timeout");

    // Restarted worker retries from persisted checkpoint
    const worker2 = new CareLoopAgentRuntime({
      planner: assessmentPlanner,
      toolExecutor: flakyExecutor,
    });
    const retried = await worker2.retry({
      session: careManagerSession,
      runId: first.run.id,
      correlationId: "rt-retry-2",
    });

    expect(retried.run.status).toBe("COMPLETED");
    expect(retried.run.retryCount).toBe(1);
    expect(attempts).toBe(2);
  });

  it("supports cancel(), fail(), and escalate() lifecycle transitions", async () => {
    const runtime = new CareLoopAgentRuntime();

    // 1. Cancel a paused run
    const pausedForCancel = await runtime.start({
      session: careManagerSession,
      caseId: testCaseId,
      pauseAfterPlan: true,
    });
    const cancelled = await runtime.cancel({
      session: careManagerSession,
      runId: pausedForCancel.run.id,
      reason: "Member withdrew consent",
    });
    expect(cancelled.run.status).toBe("CANCELLED");

    // 2. Fail a paused run explicitly
    const pausedForFail = await runtime.start({
      session: careManagerSession,
      caseId: testCaseId,
      pauseAfterPlan: true,
    });
    const failed = await runtime.fail({
      session: careManagerSession,
      runId: pausedForFail.run.id,
      errorMessage: "Unrecoverable data integrity error",
    });
    expect(failed.run.status).toBe("FAILED");
    expect(failed.run.errorMessage).toContain("Unrecoverable data integrity error");

    // 3. Escalate a paused run to human review
    const pausedForEscalate = await runtime.start({
      session: careManagerSession,
      caseId: testCaseId,
      pauseAfterPlan: true,
    });
    const escalated = await runtime.escalate({
      session: careManagerSession,
      runId: pausedForEscalate.run.id,
      reason: "Clinical complexity requires care manager intervention",
    });
    expect(escalated.run.status).toBe("ESCALATED");

    const updatedCase = await prisma.case.findUniqueOrThrow({ where: { id: testCaseId } });
    expect(updatedCase.humanReviewRequired).toBe(true);
  });
});
