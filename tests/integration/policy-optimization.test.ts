import { beforeAll, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { createSessionToken, SESSION_COOKIE_NAME, SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  AutonomousPolicyRewriteProhibitedError,
  PipelineStageOrderViolationError,
} from "@/domain/policy-optimization";
import { policyOptimizationService } from "@/services/policy-optimization-service";

const mockCookieMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieMap.get(name);
      return value ? { name, value } : undefined;
    },
  }),
}));

import {
  GET as getProposalsRoute,
  POST as postProposalRoute,
} from "@/app/api/governance/policy-optimization/proposals/route";
import { GET as getSingleProposalRoute } from "@/app/api/governance/policy-optimization/proposals/[id]/route";
import { POST as postOfflineEvalRoute } from "@/app/api/governance/policy-optimization/proposals/[id]/offline-eval/route";
import { POST as postSimulateRoute } from "@/app/api/governance/policy-optimization/proposals/[id]/simulate/route";
import { POST as postSafetyEvalRoute } from "@/app/api/governance/policy-optimization/proposals/[id]/safety-eval/route";
import { POST as postHumanReviewRoute } from "@/app/api/governance/policy-optimization/proposals/[id]/human-review/route";
import { POST as postVersionRoute } from "@/app/api/governance/policy-optimization/proposals/[id]/version/route";
import { POST as postDeployRoute } from "@/app/api/governance/policy-optimization/proposals/[id]/deploy/route";
import { POST as postTelemetryRoute } from "@/app/api/governance/policy-optimization/proposals/[id]/telemetry/route";
import { POST as postRollbackRoute } from "@/app/api/governance/policy-optimization/proposals/[id]/rollback/route";

describe("Agent Policy Optimization Framework Integration Tests", () => {
  let horizonTenantId = "";
  let adminSession: SessionUser;
  let cmSession: SessionUser;
  let agentSession: SessionUser;
  let adminToken = "";
  let cmToken = "";
  let agentToken = "";

  beforeAll(async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    horizonTenantId = horizon.id;

    const admin = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizonTenantId, role: UserRole.ADMIN },
    });
    const cm = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizonTenantId, role: UserRole.CARE_MANAGER },
    });

    adminSession = {
      userId: admin.id,
      tenantId: horizon.id,
      tenantSlug: horizon.slug,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    cmSession = {
      userId: cm.id,
      tenantId: horizon.id,
      tenantSlug: horizon.slug,
      email: cm.email,
      name: cm.name,
      role: cm.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    agentSession = {
      userId: "agent-service-worker-1",
      tenantId: horizon.id,
      tenantSlug: horizon.slug,
      email: "agent@careloop.service",
      name: "Autonomous Optimizer Agent",
      role: UserRole.AGENT_SERVICE,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    adminToken = await createSessionToken(adminSession);
    cmToken = await createSessionToken(cmSession);
    agentToken = await createSessionToken(agentSession);
  });

  it("executes the complete 8-stage policy optimization lifecycle end-to-end", async () => {
    // 1. Stage 1: Proposal Submission
    const proposal = await policyOptimizationService.createProposal(cmSession, {
      title: "Telehealth Default for Transportation Barriers",
      description: "Automatically offers telehealth modality when transportation barrier is detected.",
      scope: "INTERVENTION_MAPPING",
      baselinePolicyVersion: "2.0.0",
      proposedRules: [
        {
          id: "RULE_TELEHEALTH_TRANSPORT_MAPPING",
          name: "Telehealth Default on Transportation Barrier",
          description: "Recommends telehealth modality when social logistical transportation barrier exists.",
          effect: "ALLOW",
          conditionExpression: "barrier === 'SOCIAL_LOGISTICAL'",
          rationale: "Eliminates transit hurdles.",
        },
      ],
      parameterAdjustments: {
        autoExecutionConfidenceThreshold: 0.85,
      },
      expectedBenefitsRationale: "Expected to improve attendance by 14% and eliminate 4 days transit lag.",
      isAiGenerated: true,
    });

    expect(proposal.id).toBeDefined();
    expect(proposal.currentStage).toBe("PROPOSAL");
    expect(proposal.prohibitsAutonomousMutation).toBe(true);

    // 2. Stage 2: Offline Evaluation
    const offlineResult = await policyOptimizationService.runOfflineEvaluation(cmSession, proposal.id);
    expect(offlineResult.passed).toBe(true);
    expect(offlineResult.decisionConcordancePct).toBeGreaterThanOrEqual(90);
    expect(proposal.currentStage).toBe("OFFLINE_EVALUATION");

    // 3. Stage 3: Population Simulation
    const simResult = await policyOptimizationService.runSimulation(cmSession, proposal.id, 500);
    expect(simResult.passed).toBe(true);
    expect(simResult.simulatedPopulationSize).toBe(500);
    expect(proposal.currentStage).toBe("SIMULATION");

    // 4. Stage 4: Safety Evaluation
    const safetyResult = await policyOptimizationService.runSafetyEvaluation(cmSession, proposal.id);
    expect(safetyResult.passed).toBe(true);
    expect(safetyResult.safetyBreachesCount).toBe(0);
    expect(proposal.currentStage).toBe("SAFETY_EVALUATION");

    // 5. Stage 5: Invariant Enforcement: Agent ATTEMPTS TO REVIEW
    await expect(
      policyOptimizationService.submitHumanReview(agentSession, proposal.id, {
        decision: "APPROVE",
        clinicalJustification: "Agent self-approval attempt.",
      })
    ).rejects.toThrowError(AutonomousPolicyRewriteProhibitedError);

    // Unprivileged human role (CARE_MANAGER) ATTEMPTS TO APPROVE
    await expect(
      policyOptimizationService.submitHumanReview(cmSession, proposal.id, {
        decision: "APPROVE",
        clinicalJustification: "CM unprivileged review attempt.",
      })
    ).rejects.toThrowError(/Human Review requires role 'ADMIN' or 'CLINICAL_SUPERVISOR'/);

    // Authorized supervisor approves
    const reviewRecord = await policyOptimizationService.submitHumanReview(adminSession, proposal.id, {
      decision: "APPROVE",
      clinicalJustification: "Clinical evaluation confirms telehealth default preserves safety and reduces travel delays.",
    });
    expect(reviewRecord.decision).toBe("APPROVE");
    expect(proposal.currentStage).toBe("HUMAN_REVIEW");

    // 6. Stage 6: Semantic Versioning
    // Agent attempts to version -> blocked
    await expect(
      policyOptimizationService.publishPolicyVersion(agentSession, proposal.id)
    ).rejects.toThrowError(AutonomousPolicyRewriteProhibitedError);

    // Admin publishes version
    const versionedProposal = await policyOptimizationService.publishPolicyVersion(adminSession, proposal.id);
    expect(versionedProposal.versionRecord?.version).toBe("2.1.0");
    expect(versionedProposal.versionRecord?.rulesHash).toHaveLength(64);
    expect(versionedProposal.currentStage).toBe("VERSIONING");

    // 7. Stage 7: Controlled Deployment
    // Agent attempts to deploy -> blocked
    await expect(
      policyOptimizationService.deployControlledRollout(agentSession, proposal.id, {
        phase: "CANARY",
        trafficAllocationPct: 15,
      })
    ).rejects.toThrowError(AutonomousPolicyRewriteProhibitedError);

    // Admin initiates canary deployment
    const deployment = await policyOptimizationService.deployControlledRollout(adminSession, proposal.id, {
      phase: "CANARY",
      trafficAllocationPct: 15,
      targetTenants: [horizonTenantId],
    });
    expect(deployment.phase).toBe("CANARY");
    expect(deployment.trafficAllocationPct).toBe(15);
    expect(deployment.isActive).toBe(true);
    expect(proposal.currentStage).toBe("CONTROLLED_DEPLOYMENT");

    // 8. Stage 8: Live Monitoring Telemetry & Circuit Breaker Rollback
    // Healthy telemetry keeps deployment running
    const monitoredProposal = await policyOptimizationService.ingestTelemetryAndMonitor(
      adminSession,
      proposal.id,
      [
        { success: true, latencyMs: 95, completionAchieved: true },
        { success: true, latencyMs: 110, completionAchieved: true },
        { success: true, latencyMs: 130, completionAchieved: false },
      ]
    );
    expect(monitoredProposal.monitoring?.healthStatus).toBe("HEALTHY");
    expect(monitoredProposal.currentStage).toBe("MONITORING");

    // Spiked safety breach triggers automated rollback
    const rolledBackProposal = await policyOptimizationService.ingestTelemetryAndMonitor(
      adminSession,
      proposal.id,
      [
        { success: false, latencyMs: 250, isSafetyBreach: true },
      ]
    );
    expect(rolledBackProposal.currentStage).toBe("ROLLED_BACK");
    expect(rolledBackProposal.deployment?.isActive).toBe(false);
    expect(rolledBackProposal.monitoring?.rollbackTriggered).toBe(true);
    expect(rolledBackProposal.monitoring?.healthStatus).toBe("CRITICAL_ROLLBACK_TRIGGERED");

    // Verify audit logs were written to PostgreSQL
    const auditLogs = await prisma.auditEvent.findMany({
      where: {
        tenantId: horizonTenantId,
        entityId: proposal.id,
      },
      orderBy: { createdAt: "asc" },
    });
    expect(auditLogs.length).toBeGreaterThanOrEqual(6);
  });

  describe("REST API Endpoints for Policy Optimization", () => {
    it("enforces authentication on all policy optimization endpoints", async () => {
      mockCookieMap.clear();

      const reqGet = new Request("http://localhost/api/governance/policy-optimization/proposals");
      const resGet = await getProposalsRoute(reqGet);
      expect(resGet.status).toBe(401);

      const reqOffline = new Request("http://localhost/api/governance/policy-optimization/proposals/test-id/offline-eval", { method: "POST" });
      const resOffline = await postOfflineEvalRoute(reqOffline, { params: Promise.resolve({ id: "test-id" }) });
      expect(resOffline.status).toBe(401);

      const reqReview = new Request("http://localhost/api/governance/policy-optimization/proposals/test-id/human-review", { method: "POST" });
      const resReview = await postHumanReviewRoute(reqReview, { params: Promise.resolve({ id: "test-id" }) });
      expect(resReview.status).toBe(401);
    });

    it("runs complete lifecycle via REST API routes", async () => {
      mockCookieMap.set(SESSION_COOKIE_NAME, adminToken);

      // 1. POST Proposal
      const createReq = new Request("http://localhost/api/governance/policy-optimization/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "API-Driven Assisted Scheduling Fast-Track",
          description: "Enables assisted scheduling fast-track for members with prior missed appointments.",
          scope: "ESCALATION_THRESHOLDS",
          baselinePolicyVersion: "2.0.0",
          proposedRules: [
            {
              id: "RULE_ASSISTED_SCHEDULING_FAST_TRACK",
              name: "Assisted Scheduling Fast-Track",
              description: "Prioritizes navigators for members with history of missed appointments.",
              effect: "ALLOW",
              conditionExpression: "priorNoShowCount > 0",
              rationale: "Prevents repeat disengagement.",
            },
          ],
          expectedBenefitsRationale: "Reduces recurrent no-shows by 18%.",
        }),
      });

      const createRes = await postProposalRoute(createReq);
      expect(createRes.status).toBe(201);
      const createdProposal = await createRes.json();
      const propId = createdProposal.id;

      // 2. GET Proposal
      const getReq = new Request(`http://localhost/api/governance/policy-optimization/proposals/${propId}`);
      const getRes = await getSingleProposalRoute(getReq, { params: Promise.resolve({ id: propId }) });
      expect(getRes.status).toBe(200);

      // 3. POST Offline Eval
      const offReq = new Request(`http://localhost/api/governance/policy-optimization/proposals/${propId}/offline-eval`, { method: "POST" });
      const offRes = await postOfflineEvalRoute(offReq, { params: Promise.resolve({ id: propId }) });
      expect(offRes.status).toBe(200);

      // 4. POST Simulate
      const simReq = new Request(`http://localhost/api/governance/policy-optimization/proposals/${propId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ populationSize: 200 }),
      });
      const simRes = await postSimulateRoute(simReq, { params: Promise.resolve({ id: propId }) });
      expect(simRes.status).toBe(200);

      // 5. POST Safety Eval
      const safeReq = new Request(`http://localhost/api/governance/policy-optimization/proposals/${propId}/safety-eval`, { method: "POST" });
      const safeRes = await postSafetyEvalRoute(safeReq, { params: Promise.resolve({ id: propId }) });
      expect(safeRes.status).toBe(200);

      // 6. POST Human Review as Agent (should fail 403)
      mockCookieMap.set(SESSION_COOKIE_NAME, agentToken);
      const agentReviewReq = new Request(`http://localhost/api/governance/policy-optimization/proposals/${propId}/human-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "APPROVE",
          clinicalJustification: "Agent autonomous review.",
        }),
      });
      const agentReviewRes = await postHumanReviewRoute(agentReviewReq, { params: Promise.resolve({ id: propId }) });
      expect(agentReviewRes.status).toBe(403);

      // 6. POST Human Review as Admin (passes 200)
      mockCookieMap.set(SESSION_COOKIE_NAME, adminToken);
      const humanReviewReq = new Request(`http://localhost/api/governance/policy-optimization/proposals/${propId}/human-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "APPROVE",
          clinicalJustification: "Administrative clinical review approves assisted scheduling rule.",
        }),
      });
      const humanReviewRes = await postHumanReviewRoute(humanReviewReq, { params: Promise.resolve({ id: propId }) });
      expect(humanReviewRes.status).toBe(200);

      // 7. POST Version
      const verReq = new Request(`http://localhost/api/governance/policy-optimization/proposals/${propId}/version`, { method: "POST" });
      const verRes = await postVersionRoute(verReq, { params: Promise.resolve({ id: propId }) });
      expect(verRes.status).toBe(200);

      // 8. POST Deploy
      const depReq = new Request(`http://localhost/api/governance/policy-optimization/proposals/${propId}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "CANARY",
          trafficAllocationPct: 10,
        }),
      });
      const depRes = await postDeployRoute(depReq, { params: Promise.resolve({ id: propId }) });
      expect(depRes.status).toBe(200);

      // 9. POST Telemetry (healthy)
      const telReq = new Request(`http://localhost/api/governance/policy-optimization/proposals/${propId}/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          samples: [
            { success: true, latencyMs: 80, completionAchieved: true },
          ],
        }),
      });
      const telRes = await postTelemetryRoute(telReq, { params: Promise.resolve({ id: propId }) });
      expect(telRes.status).toBe(200);

      // 10. POST Manual Rollback
      const rbReq = new Request(`http://localhost/api/governance/policy-optimization/proposals/${propId}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Controlled supervisory drill rollback." }),
      });
      const rbRes = await postRollbackRoute(rbReq, { params: Promise.resolve({ id: propId }) });
      expect(rbRes.status).toBe(200);
      const finalized = await rbRes.json();
      expect(finalized.currentStage).toBe("ROLLED_BACK");
    });
  });
});
