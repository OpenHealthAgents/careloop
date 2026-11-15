import { CaseStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { careLoopAgent, type Agent, type AgentDecision } from "@/agent";
import { careLoopAgentRuntime, type AgentRun, type AgentRuntime } from "@/agent_runtime";
import { careLoopAnalyticsProvider, type AnalyticsProvider } from "@/analytics";
import { type Approval, type ApprovalStatus } from "@/approval";
import { careLoopAuditLogger, type AuditEvent, type AuditLogger } from "@/audit";
import { type CaseMemory } from "@/domain";
import { evidenceStore, type Evidence } from "@/evidence";
import { type IntegrationAdapter } from "@/integrations";
import { careLoopPolicyEvaluator, type PolicyDecision, type PolicyEvaluator } from "@/policy";
import { getToolDefinition, type Tool, type ToolCall, type ToolResult } from "@/tools";
import {
  caseWorkflowEngine,
  type StateTransition,
  type WorkflowState,
} from "@/workflow";

describe("Target Architecture Foundational Contracts", () => {
  it("exposes Agent and AgentDecision contracts via @/agent", async () => {
    const agent: Agent = careLoopAgent;
    const decision: AgentDecision = await agent.decide({
      case_id: "case-contract-1",
      goal: "Complete behavioral health intake",
      member_context: {
        preferredLanguage: "English",
        urbanicity: "URBAN",
        digitalAccessLevel: "HIGH",
        transportationAccess: "RELIABLE",
        consentOutreach: true,
        consentSms: true,
        priorNoShowCount: 0,
      },
      referral_context: {
        behavioralHealthNeed: "Outpatient Therapy",
        specialty: "OUTPATIENT_THERAPY",
        urgency: "ROUTINE",
        geography: "Austin, TX",
        networkRequired: "Horizon PPO",
        eligibilityVerified: "VERIFIED",
        matchedProviderId: null,
        verifiedAvailableSlotsCount: 0,
      },
      current_state: CaseStatus.NEW,
      known_barriers: [],
      available_evidence: {
        hasRiskAssessment: false,
        hasCompletedAppointment: false,
        hasScheduledAppointment: false,
        hasConfirmedAppointment: false,
        hasNoShowAppointment: false,
        hasVerifiedVisit: false,
        signals: [],
      },
      previous_actions: [],
      policy_context: {
        riskTier: "MEDIUM",
        priorityScore: 50,
        consentOutreach: true,
        consentSms: true,
        humanReviewRequired: false,
      },
      human_tasks: {
        pendingBarrierConfirmations: 0,
        pendingInterventionApprovals: 0,
        openEscalations: 0,
        awaitingCompletionVerification: false,
      },
    });

    expect(agent.name).toBe("CareLoopCaseOrchestrator");
    expect(decision.tool).toBe("run_ai_assessment");
    expect(decision.proposed_next_state).toBe(CaseStatus.TRIAGED);
  });

  it("exposes Policy and PolicyDecision contracts via @/policy", () => {
    const evaluator: PolicyEvaluator = careLoopPolicyEvaluator;

    const denied: PolicyDecision = evaluator.evaluate({
      action: "send_member_communication",
      consentOutreach: false,
      channel: "SMS",
    });
    expect(denied.effect).toBe("DENY");
    expect(denied.allowed).toBe(false);

    const allowed: PolicyDecision = evaluator.evaluate({
      action: "search_providers",
      caseState: CaseStatus.TRIAGED,
    });
    expect(allowed.effect).toBe("ALLOW");
    expect(allowed.allowed).toBe(true);
  });

  it("exposes WorkflowState and StateTransition contracts via @/workflow", () => {
    const state: WorkflowState = CaseStatus.NEW;
    const valid: StateTransition = caseWorkflowEngine.validateTransition(state, CaseStatus.TRIAGED);
    expect(valid.allowed).toBe(true);
    expect(valid.from).toBe(CaseStatus.NEW);
    expect(valid.to).toBe(CaseStatus.TRIAGED);

    const invalid: StateTransition = caseWorkflowEngine.validateTransition(
      CaseStatus.NEW,
      CaseStatus.CLOSED
    );
    expect(invalid.allowed).toBe(false);
    expect(invalid.reason).toBeTruthy();
  });

  it("exposes Evidence contract with SHA-256 integrity verification via @/evidence", () => {
    const payload = { slotId: "slot-123", verified: true };
    const ev: Evidence = evidenceStore.record({
      caseId: "case-1",
      tenantId: "tenant-1",
      sourceType: "VERIFIED_AVAILABILITY",
      summary: "Clinic confirmed slot-123 open",
      capturedBy: "system",
      payload,
    });

    expect(ev.payloadHash).toHaveLength(64);
    expect(evidenceStore.verifyIntegrity(ev, payload)).toBe(true);
    expect(evidenceStore.verifyIntegrity(ev, { slotId: "slot-999", verified: false })).toBe(false);
  });

  it("exposes Tool, ToolCall, ToolResult, AgentRun, Approval, AuditEvent, CaseMemory, Analytics, and Integration contracts", () => {
    const tool: Tool = getToolDefinition("search_providers");
    expect(tool.name).toBe("search_providers");

    const call: ToolCall = {
      tool: "search_providers",
      input: { caseId: "case-1" },
    };
    const result: ToolResult = {
      success: true,
      data: { matches: [] },
      evidence: [],
      error: null,
      metadata: { tool: call.tool },
    };
    expect(result.success).toBe(true);

    const runtime: AgentRuntime = careLoopAgentRuntime;
    expect(typeof runtime.startRun).toBe("function");

    const logger: AuditLogger = careLoopAuditLogger;
    expect(typeof logger.log).toBe("function");

    const analytics: AnalyticsProvider = careLoopAnalyticsProvider;
    expect(typeof analytics.getEvaluation).toBe("function");

    // Type-level contract assertions for remaining core abstractions
    const status: ApprovalStatus = "PENDING";
    const approvalShape: Pick<Approval, "status" | "action"> = {
      status,
      action: "schedule_appointment",
    };
    const runShape: Pick<AgentRun, "agent" | "status"> = {
      agent: "CareLoopCaseOrchestrator",
      status: "STARTED",
    };
    const auditShape: AuditEvent = {
      tenantId: "tenant-1",
      action: "TOOL_EXECUTED",
      entityType: "Case",
      entityId: "case-1",
    };
    const memoryShape: Pick<CaseMemory, "case_id" | "canonical_storage_policy"> = {
      case_id: "case-1",
      canonical_storage_policy: "STRUCTURED_RELATIONAL_ONLY_NO_RAW_LLM_TRANSCRIPTS",
    };
    const adapterShape: IntegrationAdapter = {
      name: "MockAdapter",
      mode: "MOCK",
      async healthCheck() {
        return { healthy: true };
      },
    };

    expect(approvalShape.status).toBe("PENDING");
    expect(runShape.status).toBe("STARTED");
    expect(auditShape.entityType).toBe("Case");
    expect(memoryShape.canonical_storage_policy).toBe(
      "STRUCTURED_RELATIONAL_ONLY_NO_RAW_LLM_TRANSCRIPTS"
    );
    expect(adapterShape.mode).toBe("MOCK");
  });
});
