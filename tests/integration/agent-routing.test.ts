import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  agentRouter,
  routeAgentTask,
  RoutingTask,
} from "@/lib/routing";

describe("Agent Routing Integration Tests (PostgreSQL + Runtime Dispatcher)", () => {
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
        externalMemberId: `MEM-ROUTE-${Date.now()}`,
        firstName: "Route",
        lastName: "Test",
        dobYear: 1985,
        geography: "West Metro",
        urbanicity: "URBAN",
        preferredLanguage: "English",
        coverageType: "COMMERCIAL",
        consentOutreach: true,
        consentSms: true,
      },
    });
    testMemberId = member.id;

    const referral = await prisma.referral.create({
      data: {
        tenantId,
        memberId: member.id,
        externalReferralId: `REF-ROUTE-${Date.now()}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient psychiatric consultation",
        specialty: "Psychiatry",
        urgency: "ROUTINE",
        geography: "West Metro",
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
        memberId: member.id,
        referralId: referral.id,
        status: "NEW",
        riskLevel: "HIGH",
        priorityScore: 88,
      },
    });
    testCaseId = careCase.id;
  });

  afterAll(async () => {
    if (testCaseId) {
      await prisma.approvalRequest.deleteMany({ where: { caseId: testCaseId } }).catch(() => undefined);
      await prisma.case.delete({ where: { id: testCaseId } }).catch(() => undefined);
    }
    if (testReferralId) {
      await prisma.referral.delete({ where: { id: testReferralId } }).catch(() => undefined);
    }
    if (testMemberId) {
      await prisma.member.delete({ where: { id: testMemberId } }).catch(() => undefined);
    }
  });

  it("evaluates and dispatches all 6 routing archetypes with PostgreSQL integration", async () => {
    // 1. Simple validation -> Deterministic code
    const valTask: RoutingTask = {
      taskType: "VALIDATION",
      actionName: "VALIDATE_PHONE",
      tenantId,
      inputPayload: { phone: "555-987-6543" },
    };
    const valDecision = routeAgentTask(valTask);
    expect(valDecision.route).toBe("DETERMINISTIC_CODE");
    expect(valDecision.estimatedAiTokens).toBe(0);

    const valResult = await agentRouter.execute(valTask, { session: careManagerSession });
    expect(valResult.success).toBe(true);
    expect(valResult.tokensConsumed).toBe(0);
    expect((valResult.output as any).normalized).toBe("+15559876543");

    // 2. Provider search -> Deterministic provider tool (PostgreSQL query)
    const provTask: RoutingTask = {
      taskType: "PROVIDER_SEARCH",
      actionName: "search_providers",
      tenantId,
      caseId: testCaseId,
      inputPayload: { caseId: testCaseId, specialty: "PSYCHIATRY" },
    };
    const provDecision = routeAgentTask(provTask);
    expect(provDecision.route).toBe("DETERMINISTIC_TOOL");
    expect(provDecision.estimatedAiTokens).toBe(0);

    const provResult = await agentRouter.execute(provTask, {
      session: careManagerSession,
      correlationId: `route-corr-${Date.now()}`,
    });
    expect(provResult.success).toBe(true);
    expect(provResult.tokensConsumed).toBe(0);
    expect(provResult.output).toBeDefined();

    // 3. High-risk action -> Human approval gate (creates ApprovalRequest in DB)
    const highRiskTask: RoutingTask = {
      taskType: "ACTION_EXECUTION",
      actionName: "APPROVE_CLINICAL_INTERVENTION",
      riskLevel: "HIGH",
      tenantId,
      caseId: testCaseId,
      inputPayload: { interventionType: "INTENSIVE_OUTPATIENT", urgency: "IMMEDIATE" },
    };
    const highRiskDecision = routeAgentTask(highRiskTask);
    expect(highRiskDecision.route).toBe("HUMAN_APPROVAL_GATE");
    expect(highRiskDecision.isHumanGated).toBe(true);
    expect(highRiskDecision.estimatedAiTokens).toBe(0);

    const highRiskResult = await agentRouter.execute(highRiskTask, { session: careManagerSession });
    expect(highRiskResult.humanApprovalRequired).toBe(true);
    expect(highRiskResult.approvalRequestId).toBeDefined();

    // Verify approval record exists in DB
    const savedApproval = await prisma.approvalRequest.findUnique({
      where: { id: highRiskResult.approvalRequestId },
    });
    expect(savedApproval).not.toBeNull();
    expect(savedApproval?.caseId).toBe(testCaseId);
    expect(savedApproval?.status).toBe("PENDING");

    // 4. State transition -> Deterministic state machine
    const transTask: RoutingTask = {
      taskType: "STATE_TRANSITION",
      tenantId,
      caseId: testCaseId,
      inputPayload: { fromStatus: "NEW", toStatus: "TRIAGED" },
    };
    const transDecision = routeAgentTask(transTask);
    expect(transDecision.route).toBe("DETERMINISTIC_STATE_MACHINE");
    expect(transDecision.estimatedAiTokens).toBe(0);

    const transResult = await agentRouter.execute(transTask, { session: careManagerSession });
    expect(transResult.success).toBe(true);
    expect((transResult.output as any).isValid).toBe(true);

    // 5. Barrier classification -> Low-cost model (gpt-4o-mini)
    const barrierTask: RoutingTask = {
      taskType: "BARRIER_CLASSIFICATION",
      actionName: "classify_barrier",
      tenantId,
      caseId: testCaseId,
      inputPayload: {
        referralId: testReferralId,
        operationalNotes: "Patient reports work conflict with standard morning clinic appointments.",
      },
    };
    const barrierDecision = routeAgentTask(barrierTask);
    expect(barrierDecision.route).toBe("LOW_COST_MODEL");
    expect(barrierDecision.target).toBe("gpt-4o-mini");

    const barrierResult = await agentRouter.execute(barrierTask, { session: careManagerSession });
    expect(barrierResult.success).toBe(true);
    expect(barrierResult.tokensConsumed).toBeGreaterThan(0);
    expect(barrierResult.costUSD).toBeLessThan(0.001);

    // 6. Complex ambiguous case -> Stronger model (gpt-4o)
    const complexTask: RoutingTask = {
      taskType: "COMPLEX_REASONING",
      tenantId,
      caseId: testCaseId,
      isAmbiguous: true,
      ambiguitySignals: {
        conflictingEvidenceCount: 2,
        hasContradictoryNotes: true,
        confidenceScore: 0.45,
      },
      inputPayload: {
        evidence: "Multiple contradictory clinical intake notes and conflicting consent reports.",
      },
    };
    const complexDecision = routeAgentTask(complexTask);
    expect(complexDecision.route).toBe("STRONGER_MODEL");
    expect(complexDecision.target).toBe("gpt-4o");
    expect(complexDecision.estimatedAiTokens).toBeGreaterThanOrEqual(1000);
  });
});
