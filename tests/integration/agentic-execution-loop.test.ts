import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AgenticExecutionLoop,
  CareLoopAgentRuntime,
  RuntimeToolExecutor,
} from "@/agent_runtime";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

describe("Agentic Execution Loop Integration (8-Phase Loop, Retries, Timeouts, Recovery & Loop Detection)", () => {
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
        externalMemberId: `MEM-LOOP-${Date.now()}`,
        firstName: "Loop",
        lastName: "Tester",
        dobYear: 1993,
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
        externalReferralId: `REF-LOOP-${Date.now()}`,
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
    testReferralId = referral.id;

    const careCase = await prisma.case.create({
      data: {
        tenantId,
        referralId: referral.id,
        memberId: member.id,
        status: "NEW",
        riskLevel: "LOW",
        priorityScore: 0,
      },
    });
    testCaseId = careCase.id;
  });

  afterAll(async () => {
    if (testCaseId) {
      await prisma.executionLearningRecord.deleteMany({ where: { tenantId, caseId: testCaseId } });
      await prisma.evidence.deleteMany({ where: { tenantId, caseId: testCaseId } });
      await prisma.executionJournalEvent.deleteMany({ where: { tenantId, caseId: testCaseId } });
      await prisma.aIDecisionTrace.deleteMany({ where: { tenantId, caseId: testCaseId } });
      await prisma.agentRun.deleteMany({ where: { tenantId, caseId: testCaseId } });
      await prisma.approvalRequest.deleteMany({ where: { tenantId, caseId: testCaseId } });
      await prisma.riskAssessment.deleteMany({ where: { tenantId, caseId: testCaseId } });
      await prisma.barrier.deleteMany({ where: { tenantId, caseId: testCaseId } });
      await prisma.workflowEvent.deleteMany({ where: { tenantId, caseId: testCaseId } });
      await prisma.case.deleteMany({ where: { id: testCaseId } });
    }
    if (testReferralId) await prisma.referral.deleteMany({ where: { id: testReferralId } });
    if (testMemberId) await prisma.member.deleteMany({ where: { id: testMemberId } });
  });

  it("executes all 8 phases (OBSERVE->UNDERSTAND->PLAN->POLICY_CHECK->ACT->VERIFY->UPDATE_STATE->LEARN) with bounded retries", async () => {
    let attempts = 0;
    const flakyExecutor: RuntimeToolExecutor = {
      execute: async (_session, call) => {
        attempts += 1;
        if (attempts === 1) {
          return {
            success: false,
            data: null,
            evidence: [],
            error: { code: "TRANSIENT_ERROR", message: "Transient adapter error" },
            metadata: { tool: call.tool },
          };
        }
        return {
          success: true,
          data: { ok: true },
          evidence: [{ verified: true }],
          error: null,
          metadata: { tool: call.tool },
        };
      },
    };

    const lowRiskPlanner = {
      plan: (input: Parameters<CareLoopAgentRuntime["planner"]["plan"]>[0]) => ({
        case_id: input.case_id,
        goal: input.goal ?? "Complete verified visit",
        current_state: input.current_state,
        recommended_action: "Run assessment",
        tool: "run_ai_assessment" as const,
        proposed_next_state: null,
        requires_human: false,
        policy_check_required: true,
        confidence: 0.9,
        evidence: ["Initial intake complete"],
        expected_outcome: "Risk and barriers assessed",
        fallback_action: "escalate_to_human" as const,
        reason: "Running assessment.",
      }),
    };

    const runtime = new CareLoopAgentRuntime({
      planner: lowRiskPlanner,
      toolExecutor: flakyExecutor,
    });
    const loop = new AgenticExecutionLoop(runtime);

    const result = await loop.run({
      session: careManagerSession,
      caseId: testCaseId,
      maxIterations: 2,
      maxRetriesPerStep: 2,
      maxLoopRepeats: 3,
      toolInputProvider: ({ iteration }) =>
        iteration === 1 ? { tenantId, caseId: testCaseId } : undefined,
      correlationId: "loop-8-phase-1",
    });

    expect(result.iterations[0].phasesExecuted).toEqual([
      "OBSERVE",
      "UNDERSTAND",
      "PLAN",
      "POLICY_CHECK",
      "ACT",
      "VERIFY",
      "UPDATE_STATE",
      "LEARN",
    ]);
    expect(result.iterations[0].retriesUsed).toBe(1);
    expect(result.totalRetries).toBe(1);
    expect(result.stopReason).toBe("HUMAN_REQUIRED");
  });

  it("handles step timeouts and recovers cleanly via escalation", async () => {
    const slowExecutor: RuntimeToolExecutor = {
      execute: async () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                success: true,
                data: {},
                evidence: [],
                error: null,
                metadata: {},
              }),
            200
          )
        ),
    };

    const runtime = new CareLoopAgentRuntime({
      planner: {
        plan: (input) => ({
          case_id: input.case_id,
          goal: input.goal ?? "Complete verified visit",
          current_state: input.current_state,
          recommended_action: "Run assessment",
          tool: "run_ai_assessment",
          proposed_next_state: null,
          requires_human: false,
          policy_check_required: true,
          confidence: 0.9,
          evidence: ["Initial intake complete"],
          expected_outcome: "Risk and barriers assessed",
          fallback_action: "escalate_to_human",
          reason: "Running assessment.",
        }),
      },
      toolExecutor: slowExecutor,
    });

    const loop = new AgenticExecutionLoop(runtime);
    const result = await loop.run({
      session: careManagerSession,
      caseId: testCaseId,
      maxIterations: 2,
      maxRetriesPerStep: 1,
      stepTimeoutMs: 25,
      toolInputProvider: () => ({ tenantId, caseId: testCaseId }),
      correlationId: "loop-timeout-1",
    });

    expect(result.stopReason).toBe("BLOCKED");
    expect(result.timedOut).toBe(true);
    expect(result.failureRecovered).toBe(true);
    expect(result.totalRetries).toBe(1);
  });

  it("detects endless repetition loops and stops cleanly with loopDetected=true", async () => {
    const noOpExecutor: RuntimeToolExecutor = {
      execute: async (_session, call) => ({
        success: true,
        data: { unchanged: true },
        evidence: [],
        error: null,
        metadata: { tool: call.tool },
      }),
    };

    const runtime = new CareLoopAgentRuntime({
      planner: {
        plan: (input) => ({
          case_id: input.case_id,
          goal: input.goal ?? "Complete verified visit",
          current_state: input.current_state,
          recommended_action: "Repeat same assessment",
          tool: "run_ai_assessment",
          proposed_next_state: null,
          requires_human: false,
          policy_check_required: true,
          confidence: 0.9,
          evidence: ["Intake complete"],
          expected_outcome: "Assessment",
          fallback_action: "escalate_to_human",
          reason: "Repeating same step.",
        }),
      },
      toolExecutor: noOpExecutor,
    });

    const loop = new AgenticExecutionLoop(runtime);
    const result = await loop.run({
      session: careManagerSession,
      caseId: testCaseId,
      maxIterations: 10,
      maxLoopRepeats: 2,
      toolInputProvider: () => ({ tenantId, caseId: testCaseId }),
      correlationId: "loop-detect-1",
    });

    expect(result.stopReason).toBe("BLOCKED");
    expect(result.loopDetected).toBe(true);
    expect(result.iterationsExecuted).toBe(2);
  });

  it("stops immediately with MEMBER_DECLINED, GOAL_ACHIEVED, and CASE_CLOSED on terminal/consent conditions", async () => {
    const loop = new AgenticExecutionLoop();

    // MEMBER_DECLINED
    await prisma.member.update({
      where: { id: testMemberId },
      data: { consentOutreach: false },
    });
    const declined = await loop.run({ session: careManagerSession, caseId: testCaseId });
    expect(declined.stopReason).toBe("MEMBER_DECLINED");

    await prisma.member.update({
      where: { id: testMemberId },
      data: { consentOutreach: true },
    });

    // GOAL_ACHIEVED
    await prisma.case.update({
      where: { id: testCaseId },
      data: { status: "VERIFIED", firstCompletedVisitAt: new Date() },
    });
    const achieved = await loop.run({ session: careManagerSession, caseId: testCaseId });
    expect(achieved.stopReason).toBe("GOAL_ACHIEVED");

    // CASE_CLOSED
    await prisma.case.update({
      where: { id: testCaseId },
      data: { status: "CLOSED" },
    });
    const closed = await loop.run({ session: careManagerSession, caseId: testCaseId });
    expect(closed.stopReason).toBe("CASE_CLOSED");
  });
});
