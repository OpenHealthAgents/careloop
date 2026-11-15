import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getCostAndPerformanceMetrics } from "@/services/cost-performance-service";
import { recordAIDecisionTrace } from "@/services/decision-trace-service";
import { startAgentRun } from "@/services/observability-service";

describe("Cost and Performance Optimization Integration (PostgreSQL + Observability)", () => {
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
        externalMemberId: `MEM-COST-${Date.now()}`,
        firstName: "Cost",
        lastName: "Opt",
        dobYear: 1988,
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
        externalReferralId: `REF-COST-${Date.now()}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient psychiatric consultation",
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

    const careCase = await prisma.case.create({
      data: {
        tenantId,
        referralId: referral.id,
        memberId: member.id,
        status: "NEW",
        riskLevel: "MEDIUM",
        priorityScore: 50,
      },
    });
    testCaseId = careCase.id;

    // Create an agent run with tokens and latency
    const run = await startAgentRun({
      tenantId,
      caseId: careCase.id,
      agent: "CareLoopCaseOrchestrator",
      model: "gpt-4o-mini",
      promptVersion: "2.1.0",
      correlationId: `corr-cost-${Date.now()}`,
    });

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        latencyMs: 1450,
        promptTokens: 2500,
        completionTokens: 450,
        totalTokens: 2950,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    // Create a decision trace
    await recordAIDecisionTrace({
      tenantId,
      caseId: careCase.id,
      decision: "Coordinate psychiatric consultation with in-network clinic",
      confidence: 0.94,
      evidence: ["In-network provider found"],
      policyResult: "ALLOW",
      toolSelected: "search_providers",
      humanApprovalRequired: false,
    });
  });

  afterAll(async () => {
    await prisma.aIDecisionTrace.deleteMany({ where: { caseId: testCaseId } });
    await prisma.agentRun.deleteMany({ where: { caseId: testCaseId } });
    await prisma.case.deleteMany({ where: { id: testCaseId } });
    await prisma.referral.deleteMany({ where: { id: testReferralId } });
    await prisma.member.deleteMany({ where: { id: testMemberId } });
  });

  it("measures LLM calls per case, tokens per case, tool calls per case, latency, human time, and cost per completed referral", async () => {
    const metrics = await getCostAndPerformanceMetrics(careManagerSession);

    // 1. LLM calls per case
    expect(metrics.llm_calls_per_case.total_cases).toBeGreaterThanOrEqual(1);
    expect(metrics.llm_calls_per_case.total_llm_calls).toBeGreaterThanOrEqual(1);
    expect(metrics.llm_calls_per_case.average_llm_calls_per_case).toBeGreaterThanOrEqual(0);

    // 2. Tokens per case
    expect(metrics.tokens_per_case.total_tokens).toBeGreaterThanOrEqual(2950);
    expect(metrics.tokens_per_case.total_tokens_per_case).toBeGreaterThan(0);
    expect(metrics.tokens_per_case.prompt_tokens_per_case).toBeGreaterThan(0);
    expect(metrics.tokens_per_case.completion_tokens_per_case).toBeGreaterThan(0);

    // 3. Tool calls per case
    expect(metrics.tool_calls_per_case.total_tool_calls).toBeGreaterThanOrEqual(0);
    expect(metrics.tool_calls_per_case.average_tool_calls_per_case).toBeGreaterThanOrEqual(0);

    // 4. Latency
    expect(metrics.latency.avg_latency_ms).toBeGreaterThanOrEqual(0);
    expect(metrics.latency.p50_latency_ms).toBeGreaterThanOrEqual(0);
    expect(metrics.latency.p95_latency_ms).toBeGreaterThanOrEqual(0);

    // 5. Human time
    expect(metrics.human_time.total_approvals).toBeGreaterThanOrEqual(0);
    expect(metrics.human_time.estimated_active_human_minutes_per_case).toBeGreaterThan(0);
    expect(metrics.human_time.human_in_the_loop_pct).toBeGreaterThanOrEqual(0);

    // 6. Cost per completed referral
    expect(metrics.cost_per_completed_referral.total_cost_dollars).toBeGreaterThan(0);
    expect(metrics.cost_per_completed_referral.cost_per_completed_referral_dollars).toBeGreaterThan(0);
    expect(metrics.cost_per_completed_referral.cost_per_case_dollars).toBeGreaterThan(0);

    // 7. Savings breakdown
    expect(metrics.optimization_savings.tokens_saved_by_deterministic_shortcuts).toBeGreaterThanOrEqual(0);
    expect(metrics.optimization_savings.dollars_saved_by_small_models).toBeGreaterThanOrEqual(0);
  });
});
