import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  agentRegistry,
  CaseGoalInvariantViolationError,
  DiscoveredEvidenceSignal,
  mergeSharedEvidence,
  recordSharedAgentMessageAudit,
  recordSharedAgentTaskAudit,
  SpecializedAgentContext,
} from "@/agent/multi_agent";
import { buildCaseGoal } from "@/domain/cases/state-machine";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

describe("Multi-Agent Readiness Integration Tests (PostgreSQL + Shared Invariants)", () => {
  let tenantId = "";
  let careManagerSession: SessionUser;
  let testCaseId = "";
  let testMemberId = "";
  let testReferralId = "";
  let canonicalGoal = "";

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
        externalMemberId: `MEM-MULTI-${Date.now()}`,
        firstName: "MultiAgent",
        lastName: "Readiness",
        dobYear: 1990,
        geography: "East Metro",
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
        externalReferralId: `REF-MULTI-${Date.now()}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient psychiatric evaluation",
        specialty: "Psychiatry",
        urgency: "ROUTINE",
        geography: "East Metro",
        networkRequired: "HorizonCare",
        preferredLanguage: "English",
        eligibilityVerified: "VERIFIED",
        status: "IN_CASE",
      },
    });
    testReferralId = referral.id;

    canonicalGoal = buildCaseGoal({ specialty: "Psychiatry" });

    const careCase = await prisma.case.create({
      data: {
        tenantId,
        referralId: referral.id,
        memberId: member.id,
        status: "NEW",
        riskLevel: "MEDIUM",
        priorityScore: 60,
      },
    });
    testCaseId = careCase.id;
  });

  afterAll(async () => {
    if (testCaseId) {
      await prisma.workflowEvent.deleteMany({ where: { caseId: testCaseId } }).catch(() => undefined);
      await prisma.case.delete({ where: { id: testCaseId } }).catch(() => undefined);
    }
    if (testReferralId) {
      await prisma.referral.delete({ where: { id: testReferralId } }).catch(() => undefined);
    }
    if (testMemberId) {
      await prisma.member.delete({ where: { id: testMemberId } }).catch(() => undefined);
    }
  });

  it("coordinates specialized agents under shared state, shared audit, shared evidence & shared goal", async () => {
    let accumulatedEvidence: DiscoveredEvidenceSignal[] = [];

    const context: SpecializedAgentContext = {
      session: careManagerSession,
      correlationId: `multi-agent-corr-${Date.now()}`,
      sharedEvidence: accumulatedEvidence,
      canonicalGoal,
    };

    // 1. ReferralAgent: Validate & Triage
    const referralAgent = agentRegistry.getAgent("ReferralAgent")!;
    const refTask: any = {
      taskId: "task-ref-1",
      tenantId,
      caseId: testCaseId,
      assignedAgent: "ReferralAgent",
      capabilityRequired: "referral.triage",
      caseGoal: canonicalGoal,
      currentState: "NEW",
      inputData: { specialty: "Psychiatry" },
      evidenceReferences: [],
      priority: "NORMAL",
      policyContext: { policyId: "careloop.central.policy.v2", consentOutreach: true, consentSms: true },
      createdAt: new Date(),
    };

    await recordSharedAgentTaskAudit(refTask);
    const refResult = await referralAgent.executeTask(refTask, context);
    expect(refResult.status).toBe("SUCCESS");
    expect(refResult.caseGoalAcknowledged).toBe(canonicalGoal);
    accumulatedEvidence = mergeSharedEvidence(accumulatedEvidence, refResult.evidenceDiscovered);
    await recordSharedAgentTaskAudit(refTask, refResult);

    // 2. BarrierAgent: Classify SDOH Barriers
    const barrierAgent = agentRegistry.getAgent("BarrierAgent")!;
    const barTask: any = {
      taskId: "task-bar-1",
      tenantId,
      caseId: testCaseId,
      assignedAgent: "BarrierAgent",
      capabilityRequired: "barrier.classify",
      caseGoal: canonicalGoal,
      currentState: "TRIAGED",
      inputData: { notes: "No transportation barriers reported." },
      evidenceReferences: accumulatedEvidence.map((e) => e.signal),
      priority: "NORMAL",
      policyContext: { policyId: "careloop.central.policy.v2", consentOutreach: true, consentSms: true },
      createdAt: new Date(),
    };

    const barResult = await barrierAgent.executeTask(barTask, { ...context, sharedEvidence: accumulatedEvidence });
    expect(barResult.status).toBe("SUCCESS");
    accumulatedEvidence = mergeSharedEvidence(accumulatedEvidence, barResult.evidenceDiscovered);

    // 3. ProviderAgent: Deterministic In-Network Provider Search
    const providerAgent = agentRegistry.getAgent("ProviderAgent")!;
    const provTask: any = {
      taskId: "task-prov-1",
      tenantId,
      caseId: testCaseId,
      assignedAgent: "ProviderAgent",
      capabilityRequired: "provider.search",
      caseGoal: canonicalGoal,
      currentState: "BARRIER_IDENTIFIED",
      inputData: { specialty: "Psychiatry" },
      evidenceReferences: accumulatedEvidence.map((e) => e.signal),
      priority: "NORMAL",
      policyContext: { policyId: "careloop.central.policy.v2", consentOutreach: true, consentSms: true },
      createdAt: new Date(),
    };

    const provResult = await providerAgent.executeTask(provTask, { ...context, sharedEvidence: accumulatedEvidence });
    expect(provResult.status).toBe("SUCCESS");
    accumulatedEvidence = mergeSharedEvidence(accumulatedEvidence, provResult.evidenceDiscovered);

    // 4. Inter-agent coordination message (ProviderAgent -> SchedulingAgent)
    const coordinationMessage = {
      id: `msg-${Date.now()}`,
      tenantId,
      caseId: testCaseId,
      senderAgent: "ProviderAgent",
      recipientAgent: "SchedulingAgent",
      correlationId: context.correlationId!,
      timestamp: new Date(),
      messageType: "TASK_DISPATCH" as const,
      payload: { providerMatchConfirmed: true },
      sharedGoal: canonicalGoal,
    };
    await recordSharedAgentMessageAudit(coordinationMessage);

    // 5. VerificationAgent: Completed First Visit Attestation
    const verificationAgent = agentRegistry.getAgent("VerificationAgent")!;
    const verTask: any = {
      taskId: "task-ver-1",
      tenantId,
      caseId: testCaseId,
      assignedAgent: "VerificationAgent",
      capabilityRequired: "verification.first_visit",
      caseGoal: canonicalGoal,
      currentState: "APPOINTMENT_COMPLETED",
      inputData: { visitConfirmed: true },
      evidenceReferences: accumulatedEvidence.map((e) => e.signal),
      priority: "HIGH",
      policyContext: { policyId: "careloop.central.policy.v2", consentOutreach: true, consentSms: true },
      createdAt: new Date(),
    };

    const verResult = await verificationAgent.executeTask(verTask, { ...context, sharedEvidence: accumulatedEvidence });
    expect(verResult.status).toBe("SUCCESS");
    expect(verResult.proposedStateTransition?.to).toBe("VERIFIED");
    accumulatedEvidence = mergeSharedEvidence(accumulatedEvidence, verResult.evidenceDiscovered);

    // Verify accumulated evidence ledger holds distinct evidence from multiple agents
    expect(accumulatedEvidence.length).toBeGreaterThanOrEqual(4);
    const sources = new Set(accumulatedEvidence.map((e) => e.source));
    expect(sources.has("ReferralAgent")).toBe(true);
    expect(sources.has("BarrierAgent")).toBe(true);
    expect(sources.has("ProviderAgent")).toBe(true);
    expect(sources.has("VerificationAgent")).toBe(true);
  });

  it("STRICTLY BLOCKS any agent attempting to independently redefine the case goal", async () => {
    const schedulingAgent = agentRegistry.getAgent("SchedulingAgent")!;

    const rogueTask: any = {
      taskId: "task-rogue-goal",
      tenantId,
      caseId: testCaseId,
      assignedAgent: "SchedulingAgent",
      capabilityRequired: "scheduling.book",
      caseGoal: "Close case without booking", // Altered goal!
      currentState: "INTERVENTION_IN_PROGRESS",
      inputData: {},
      evidenceReferences: [],
      priority: "NORMAL",
      policyContext: { policyId: "careloop.central.policy.v2", consentOutreach: true, consentSms: true },
      createdAt: new Date(),
    };

    const context: SpecializedAgentContext = {
      session: careManagerSession,
      sharedEvidence: [],
      canonicalGoal,
    };

    await expect(schedulingAgent.executeTask(rogueTask, context)).rejects.toThrow(
      CaseGoalInvariantViolationError
    );
  });
});
