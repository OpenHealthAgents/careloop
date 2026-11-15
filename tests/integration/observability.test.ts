import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AIPolicyViolationError } from "@/ai";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import {
  decideHumanApproval,
  resumeAgentFromApproval,
  runOrchestratorWithApprovalGate,
} from "@/services/approval-service";
import {
  getCaseExecutionTrace,
  getObservabilityMetrics,
} from "@/services/observability-service";
import { executeCareLoopTool } from "@/services/tool-executor";

describe("Observability & End-to-End Trace Integration", () => {
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
        externalMemberId: `MEM-OBS-${Date.now()}`,
        firstName: "Observe",
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
    testMemberIds.push(member.id);

    const referral = await prisma.referral.create({
      data: {
        tenantId,
        memberId: member.id,
        externalReferralId: `REF-OBS-${Date.now()}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient counseling",
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
        status: "NEW",
        riskLevel: "HIGH",
        priorityScore: 80,
      },
    });
    testCaseId = careCase.id;
    testCaseIds.push(careCase.id);
  });

  afterAll(async () => {
    await prisma.toolExecutionSpan.deleteMany({ where: { caseId: { in: testCaseIds } } });
    await prisma.agentRun.deleteMany({ where: { caseId: { in: testCaseIds } } });
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

  it("traces Case -> Agent Run -> Decision -> Policy Check -> Tool Call -> Tool Result -> Evidence -> State Transition", async () => {
    const correlationId = `corr-obs-${Date.now()}`;

    // 1. Trigger a failed tool span (unapproved high-risk action)
    await expect(
      executeCareLoopTool({
        session: careManagerSession,
        tool: "run_ai_assessment",
        input: { tenantId, caseId: testCaseId },
        humanApproved: false,
        correlationId,
      })
    ).rejects.toThrow(AIPolicyViolationError);

    // 2. Run orchestrator with approval gate (creates AgentRun + AIDecisionTrace + ApprovalRequest)
    const gated = await runOrchestratorWithApprovalGate({
      session: careManagerSession,
      caseId: testCaseId,
      toolInput: { tenantId, caseId: testCaseId },
      correlationId,
    });
    expect(gated.gated).toBe(true);
    if (!gated.gated) throw new Error("Expected gated=true");

    // 3. Approve and resume agent
    await decideHumanApproval({
      session: careManagerSession,
      approvalId: gated.approval.approval_id,
      decision: "APPROVED",
      comments: "Approved for initial assessment.",
      correlationId,
    });

    await resumeAgentFromApproval({
      session: careManagerSession,
      approvalId: gated.approval.approval_id,
      correlationId,
    });

    // 4. Inspect end-to-end case trace
    const trace = await getCaseExecutionTrace(careManagerSession, testCaseId);
    expect(trace.case_id).toBe(testCaseId);
    expect(trace.agent_runs.length).toBeGreaterThanOrEqual(2);
    expect(trace.decisions.length).toBeGreaterThanOrEqual(2);
    expect(trace.tool_calls.length).toBeGreaterThanOrEqual(2);
    expect(trace.tool_calls.some((t) => t.status === "FAILED")).toBe(true);
    expect(trace.tool_calls.some((t) => t.status === "SUCCEEDED")).toBe(true);
    expect(trace.approvals.length).toBeGreaterThanOrEqual(1);
    expect(trace.approvals[0].wait_time_ms).not.toBeNull();
    expect(trace.journal_events.length).toBeGreaterThanOrEqual(4);
    expect(trace.state_transitions.length).toBeGreaterThanOrEqual(1);

    // 5. Inspect tenant-wide observability metrics and dashboard payloads
    const metrics = await getObservabilityMetrics(careManagerSession);
    expect(metrics.latency.avg_agent_latency_ms).toBeGreaterThanOrEqual(0);
    expect(metrics.token_usage.total_tokens).toBeGreaterThanOrEqual(0);
    expect(metrics.tool_latency.avg_tool_latency_ms).toBeGreaterThanOrEqual(0);
    expect(metrics.tool_latency.by_tool.run_ai_assessment.count).toBeGreaterThanOrEqual(2);
    expect(metrics.failures.failed_tool_calls).toBeGreaterThanOrEqual(1);
    expect(metrics.retries.total_retries).toBeGreaterThanOrEqual(0);
    expect(metrics.approval_wait_time.decided_count).toBeGreaterThanOrEqual(1);
    expect(metrics.completion_rate.total_cases).toBeGreaterThanOrEqual(1);
    expect(metrics.agent_success_rate.total_runs).toBeGreaterThanOrEqual(2);
    expect(metrics.intervention_success_rate.rate).toBeGreaterThanOrEqual(0);

    // 5b. Verify the 5 specialized dashboards
    expect(metrics.dashboards).toBeDefined();
    expect(metrics.dashboards.agent_reliability.total_runs).toBeGreaterThanOrEqual(2);
    expect(metrics.dashboards.agent_reliability.succeeded_runs).toBeGreaterThanOrEqual(1);
    expect(metrics.dashboards.tool_reliability.total_tool_calls).toBeGreaterThanOrEqual(2);
    expect(metrics.dashboards.tool_reliability.failed_tool_calls).toBeGreaterThanOrEqual(1);
    expect(metrics.dashboards.workflow_reliability.total_state_transitions).toBeGreaterThanOrEqual(1);
    expect(metrics.dashboards.human_workload.total_approvals_requested).toBeGreaterThanOrEqual(1);
    expect(metrics.dashboards.case_outcomes.total_cases).toBeGreaterThanOrEqual(1);

    // 6. Cross-tenant trace access blocked
    await expect(getCaseExecutionTrace(otherTenantSession, testCaseId)).rejects.toThrow(
      NotFoundError
    );
  });
});
