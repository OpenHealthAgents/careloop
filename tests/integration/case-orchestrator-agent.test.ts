import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CareLoopOrchestratorAgent, inspectCaseContext } from "@/agent";
import { CareLoopAgentRuntime } from "@/agent_runtime";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { listCaseExecutionJournal } from "@/services/execution-journal-service";

describe("CareLoop Case Orchestrator Primary Agent Integration", () => {
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
        externalMemberId: `MEM-ORCH-${Date.now()}`,
        firstName: "Orchestrator",
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
    testMemberId = member.id;

    const referral = await prisma.referral.create({
      data: {
        tenantId,
        memberId: member.id,
        externalReferralId: `REF-ORCH-${Date.now()}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient counseling intake",
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
      await prisma.riskAssessment.deleteMany({ where: { tenantId, caseId: testCaseId } });
      await prisma.barrier.deleteMany({ where: { tenantId, caseId: testCaseId } });
      await prisma.workflowEvent.deleteMany({ where: { tenantId, caseId: testCaseId } });
      await prisma.case.deleteMany({ where: { id: testCaseId } });
    }
    if (testReferralId) await prisma.referral.deleteMany({ where: { id: testReferralId } });
    if (testMemberId) await prisma.member.deleteMany({ where: { id: testMemberId } });
  });

  it("rejects free-form prose and invalid decision payloads so nothing bypasses runtime validation", async () => {
    const orchestrator = new CareLoopOrchestratorAgent();

    expect(() =>
      orchestrator.parseAndValidateDecision("Let's schedule the member with Dr. Smith tomorrow morning.")
    ).toThrow(ValidationError);

    expect(() =>
      orchestrator.parseAndValidateDecision(
        JSON.stringify({
          recommended_action: "Close case",
          tool: "nonexistent_tool",
        })
      )
    ).toThrow(ValidationError);

    await expect(
      orchestrator.orchestrateCase({
        session: careManagerSession,
        caseId: testCaseId,
        rawExternalDecision: "Free-form text must be rejected",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("loads context, inspects state & evidence, identifies blockers, executes, and continues or pauses", async () => {
    const runtime = new CareLoopAgentRuntime();
    const orchestrator = new CareLoopOrchestratorAgent(runtime);

    // Inspect context & blockers directly
    const ctx = await runtime.contextAssembler.assemble({
      tenantId,
      caseId: testCaseId,
    });
    const inspection = inspectCaseContext(ctx);
    expect(inspection.currentState).toBe("NEW");
    expect(inspection.blockers.map((b) => b.code)).toContain("NO_RISK_ASSESSMENT");
    expect(inspection.blockers.map((b) => b.code)).toContain("NO_MATCHED_PROVIDER");

    // Step 1 executes run_ai_assessment, Step 2 plans next step and pauses for input
    const result = await orchestrator.orchestrateCase({
      session: careManagerSession,
      caseId: testCaseId,
      maxSteps: 3,
      autoContinue: true,
      toolInputProvider: ({ step, decision }) => {
        if (step === 1 && decision.tool === "run_ai_assessment") {
          return { tenantId, caseId: testCaseId };
        }
        return undefined;
      },
      correlationId: "orch-multi-step-1",
    });

    expect(result.steps[0].result.run.errorMessage ?? "").toBe("");
    expect(result.outcome).toBe("PAUSED_FOR_APPROVAL");
    expect(result.stepsExecuted).toBe(2);
    expect(result.steps[0].result.toolResult?.success).toBe(true);
    expect(result.nextDecision).toBeDefined();
    expect(result.nextDecision?.tool).toBeTruthy();

    const journal = await listCaseExecutionJournal(careManagerSession, testCaseId);
    expect(journal.some((e) => e.event_type === "AGENT_STARTED")).toBe(true);
    expect(journal.some((e) => e.event_type === "AGENT_COMPLETED")).toBe(true);

    const evidenceCount = await prisma.evidence.count({
      where: { tenantId, caseId: testCaseId },
    });
    expect(evidenceCount).toBeGreaterThanOrEqual(2);
  });

  it("returns GOAL_ACHIEVED when the case reaches VERIFIED / CLOSED", async () => {
    await prisma.case.update({
      where: { id: testCaseId },
      data: { status: "CLOSED", firstCompletedVisitAt: new Date() },
    });

    const orchestrator = new CareLoopOrchestratorAgent();
    const result = await orchestrator.orchestrateCase({
      session: careManagerSession,
      caseId: testCaseId,
    });

    expect(result.outcome).toBe("GOAL_ACHIEVED");
    expect(result.stepsExecuted).toBe(0);
    expect(result.finalCaseState).toBe("CLOSED");
  });
});
