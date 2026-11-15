import { describe, expect, it } from "vitest";
import {
  agentRegistry,
  assertCaseGoalImmutable,
  BARRIER_AGENT_SPEC,
  CareLoopAgentRegistry,
  CaseGoalInvariantViolationError,
  ENGAGEMENT_AGENT_SPEC,
  EQUITY_AGENT_SPEC,
  evaluateSharedAgentPolicy,
  mergeSharedEvidence,
  PROVIDER_AGENT_SPEC,
  REFERRAL_AGENT_SPEC,
  SCHEDULING_AGENT_SPEC,
  SpecializedAgentSpec,
  validateSharedStateTransition,
  VERIFICATION_AGENT_SPEC,
} from "@/agent/multi_agent";

describe("Multi-Agent Readiness Unit Tests — Shared State, Policy, Audit, Evidence & Goal", () => {
  const canonicalGoal = "Complete the member's psychiatry referral through a verified first visit.";

  // --------------------------------------------------------------------------
  // 1. AgentRegistry & Specialized Agents
  // --------------------------------------------------------------------------
  describe("AgentRegistry & Catalog", () => {
    it("registers and lists all 7 required specialized agents", () => {
      const agents = agentRegistry.listAgents();
      expect(agents.length).toBeGreaterThanOrEqual(7);

      const expectedNames = [
        "ReferralAgent",
        "BarrierAgent",
        "ProviderAgent",
        "SchedulingAgent",
        "EngagementAgent",
        "VerificationAgent",
        "EquityAgent",
      ];

      for (const name of expectedNames) {
        expect(agentRegistry.hasAgent(name)).toBe(true);
        const agent = agentRegistry.getAgent(name);
        expect(agent).toBeDefined();
        expect(agent?.capabilities.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("retrieves specialized agents by capability identifier", () => {
      const referralAgents = agentRegistry.getAgentsByCapability("referral.validate");
      expect(referralAgents.length).toBe(1);
      expect(referralAgents[0].name).toBe("ReferralAgent");

      const providerAgents = agentRegistry.getAgentsByCapability("provider.search");
      expect(providerAgents.length).toBe(1);
      expect(providerAgents[0].name).toBe("ProviderAgent");

      const equityAgents = agentRegistry.getAgentsByCapability("equity.disparity_audit");
      expect(equityAgents.length).toBe(1);
      expect(equityAgents[0].name).toBe("EquityAgent");
    });

    it("validates task assignments and rejects unsupported capabilities or unregistered agents", () => {
      // Valid assignment
      const validTask: any = {
        taskId: "task-001",
        assignedAgent: "ReferralAgent",
        capabilityRequired: "referral.validate",
        caseGoal: canonicalGoal,
      };
      const validCheck = agentRegistry.validateTaskAssignment(validTask);
      expect(validCheck.valid).toBe(true);

      // Unknown agent
      const unknownTask: any = {
        taskId: "task-002",
        assignedAgent: "NonExistentAgent",
        capabilityRequired: "referral.validate",
        caseGoal: canonicalGoal,
      };
      const unknownCheck = agentRegistry.validateTaskAssignment(unknownTask);
      expect(unknownCheck.valid).toBe(false);
      expect(unknownCheck.reason).toContain("not registered");

      // Unsupported capability
      const unsupportedTask: any = {
        taskId: "task-003",
        assignedAgent: "BarrierAgent",
        capabilityRequired: "provider.search",
        caseGoal: canonicalGoal,
      };
      const unsupportedCheck = agentRegistry.validateTaskAssignment(unsupportedTask);
      expect(unsupportedCheck.valid).toBe(false);
      expect(unsupportedCheck.reason).toContain("does not support required capability");
    });

    it("supports custom agent registration and unregistration", () => {
      const customRegistry = new CareLoopAgentRegistry([]);
      expect(customRegistry.listAgents().length).toBe(0);

      const mockSpec: SpecializedAgentSpec = {
        name: "CustomTriageAgent",
        role: "ReferralAgent",
        version: "1.0.0",
        domain: "REFERRAL",
        description: "Custom triage agent",
        capabilities: [
          {
            id: "custom.triage",
            name: "Custom Triage",
            description: "Custom triage",
            domain: "REFERRAL",
            allowedTools: [],
            requiredPermissions: [],
            riskTier: "LOW",
            canProposeStateTransition: false,
            requiresHumanApproval: false,
          },
        ],
        executeTask: async () => ({} as any),
      };

      customRegistry.register(mockSpec);
      expect(customRegistry.hasAgent("CustomTriageAgent")).toBe(true);

      const unregistered = customRegistry.unregister("CustomTriageAgent");
      expect(unregistered).toBe(true);
      expect(customRegistry.hasAgent("CustomTriageAgent")).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Shared Case Goal Invariant (NON-NEGOTIABLE)
  // --------------------------------------------------------------------------
  describe("Shared Case Goal Invariant", () => {
    it("permits exact and case-insensitive matching of canonical case goal", () => {
      expect(() => {
        assertCaseGoalImmutable(
          canonicalGoal,
          "Complete the member's psychiatry referral through a verified first visit.",
          "SchedulingAgent"
        );
      }).not.toThrow();

      // Case insensitive & whitespace tolerant
      expect(() => {
        assertCaseGoalImmutable(
          canonicalGoal,
          "  complete the member's psychiatry referral through a verified first visit.  ",
          "VerificationAgent"
        );
      }).not.toThrow();

      // Undefined or omitted proposed goal implicitly accepts canonical goal
      expect(() => {
        assertCaseGoalImmutable(canonicalGoal, undefined, "BarrierAgent");
      }).not.toThrow();
    });

    it("STRICTLY REJECTS any agent attempting to independently redefine the case goal", () => {
      const rogueGoals = [
        "Schedule any provider as quickly as possible and close case.",
        "Discharge member due to non-responsiveness.",
        "Lower referral priority to routine follow-up.",
        "Change goal to phone consultation only.",
      ];

      for (const rogueGoal of rogueGoals) {
        expect(() => {
          assertCaseGoalImmutable(canonicalGoal, rogueGoal, "RogueAgent");
        }).toThrow(CaseGoalInvariantViolationError);
      }
    });

    it("returns descriptive GOAL_MUTATION_REJECTED code and error message", () => {
      try {
        assertCaseGoalImmutable(
          canonicalGoal,
          "Bypass first visit verification and mark complete.",
          "VerificationAgent"
        );
        expect.unreachable("Should have thrown CaseGoalInvariantViolationError");
      } catch (err) {
        expect(err).toBeInstanceOf(CaseGoalInvariantViolationError);
        const goalErr = err as CaseGoalInvariantViolationError;
        expect(goalErr.code).toBe("GOAL_MUTATION_REJECTED");
        expect(goalErr.message).toContain("VerificationAgent");
        expect(goalErr.message).toContain("attempted to independently redefine the case goal");
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. Shared State Invariant
  // --------------------------------------------------------------------------
  describe("Shared State Invariant", () => {
    it("validates valid state transitions proposed by specialized agents", () => {
      // Scheduling agent transitions from INTERVENTION_IN_PROGRESS to APPOINTMENT_SCHEDULED
      const valid = validateSharedStateTransition(
        "INTERVENTION_IN_PROGRESS",
        "APPOINTMENT_SCHEDULED",
        "SchedulingAgent"
      );
      expect(valid.isValid).toBe(true);
      expect(valid.error).toBeUndefined();
    });

    it("rejects illegal state hops proposed by specialized agents", () => {
      // Verification agent cannot jump from BLOCKED to VERIFIED directly
      const invalid = validateSharedStateTransition("BLOCKED", "VERIFIED", "VerificationAgent");
      expect(invalid.isValid).toBe(false);
      expect(invalid.error).toContain("proposed illegal transition");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Shared Policy Invariant
  // --------------------------------------------------------------------------
  describe("Shared Policy Invariant", () => {
    it("evaluates actions through centralized policy engine", () => {
      // Outreach without consent is blocked
      const noConsentPolicy = evaluateSharedAgentPolicy({
        action: "send_member_communication",
        consentOutreach: false,
        channel: "SMS",
      });
      expect(noConsentPolicy.effect).toBe("DENY");

      // High-risk intervention requires approval
      const highRiskPolicy = evaluateSharedAgentPolicy({
        action: "human_intervention_approval",
        riskTier: "HIGH",
        humanApproved: false,
      });
      expect(highRiskPolicy.effect).toBe("REQUIRE_APPROVAL");
    });
  });

  // --------------------------------------------------------------------------
  // 5. Shared Evidence Invariant
  // --------------------------------------------------------------------------
  describe("Shared Evidence Invariant", () => {
    it("merges and deduplicates evidence signals discovered across agents", () => {
      const existing = [
        {
          category: "BARRIER",
          source: "BarrierAgent",
          signal: "Transportation deficit detected",
          confidence: 0.95,
        },
      ];
      const newlyDiscovered = [
        {
          category: "BARRIER",
          source: "BarrierAgent",
          signal: "Transportation deficit detected", // duplicate
          confidence: 0.95,
        },
        {
          category: "PROVIDER",
          source: "ProviderAgent",
          signal: "Dr. Smith has 2 open slots tomorrow",
          confidence: 0.99,
        },
      ];

      const merged = mergeSharedEvidence(existing, newlyDiscovered);
      expect(merged.length).toBe(2);
      expect(merged[0].category).toBe("BARRIER");
      expect(merged[1].category).toBe("PROVIDER");
    });
  });

  // --------------------------------------------------------------------------
  // 6. Execution Contracts on All 7 Agent Specs
  // --------------------------------------------------------------------------
  describe("Execution Contracts on All 7 Agent Specs", () => {
    const mockContext: any = {
      session: { userId: "user-1", tenantId: "tenant-1", role: "CARE_MANAGER" },
      canonicalGoal,
      sharedEvidence: [],
    };

    it("executes all 7 agent specs cleanly while preserving case goal integrity", async () => {
      const specs = [
        REFERRAL_AGENT_SPEC,
        BARRIER_AGENT_SPEC,
        PROVIDER_AGENT_SPEC,
        SCHEDULING_AGENT_SPEC,
        ENGAGEMENT_AGENT_SPEC,
        VERIFICATION_AGENT_SPEC,
        EQUITY_AGENT_SPEC,
      ];

      for (const spec of specs) {
        const task: any = {
          taskId: `task-${spec.name}`,
          caseId: "case-123",
          tenantId: "tenant-1",
          assignedAgent: spec.name,
          capabilityRequired: spec.capabilities[0].id,
          caseGoal: canonicalGoal,
          inputData: {},
        };

        const result = await spec.executeTask(task, mockContext);
        expect(result.status).toBe("SUCCESS");
        expect(result.agentName).toBe(spec.name);
        expect(result.caseGoalAcknowledged).toBe(canonicalGoal);
      }
    });

    it("rejects execution if an agent task carries an altered case goal", async () => {
      const rogueTask: any = {
        taskId: "task-rogue",
        caseId: "case-123",
        tenantId: "tenant-1",
        assignedAgent: "SchedulingAgent",
        capabilityRequired: SCHEDULING_AGENT_SPEC.capabilities[0].id,
        caseGoal: "Close case without scheduling appointment",
        inputData: {},
      };

      await expect(SCHEDULING_AGENT_SPEC.executeTask(rogueTask, mockContext)).rejects.toThrow(
        CaseGoalInvariantViolationError
      );
    });
  });
});
