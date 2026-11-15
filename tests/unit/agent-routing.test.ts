import { describe, expect, it } from "vitest";
import {
  agentRouter,
  HIGH_RISK_ACTION_SET,
  routeAgentTask,
  RoutingTask,
  validateDateWindow,
  validateEmail,
  validateMemberCommunicationConsent,
  validateNPI,
  validatePhoneNumber,
  validateStateMachineTransition,
} from "@/lib/routing";

describe("Agent Routing Unit Tests — Minimum AI Necessary to Achieve Outcome Safely", () => {
  const tenantId = "tenant-horizon";

  // --------------------------------------------------------------------------
  // ARCHETYPE 1: Simple validation -> Deterministic code
  // --------------------------------------------------------------------------
  describe("Archetype 1: Simple validation -> Deterministic code", () => {
    it("routes phone, email, NPI, date, and consent validations to deterministic code with 0 tokens", () => {
      const task: RoutingTask = {
        taskType: "VALIDATION",
        actionName: "VALIDATE_PHONE",
        tenantId,
        inputPayload: { phone: "(555) 234-5678" },
      };

      const decision = routeAgentTask(task);
      expect(decision.route).toBe("DETERMINISTIC_CODE");
      expect(decision.estimatedAiTokens).toBe(0);
      expect(decision.estimatedCostUSD).toBe(0);
      expect(decision.isHumanGated).toBe(false);
      expect(decision.minimumAiJustification).toContain("cheaper");
    });

    it("deterministically validates and normalizes phone numbers (NANP / E.164)", () => {
      // Valid NANP numbers
      const valid1 = validatePhoneNumber("5552345678");
      expect(valid1.isValid).toBe(true);
      expect(valid1.normalized).toBe("+15552345678");

      const valid2 = validatePhoneNumber("+1 (555) 345-6789");
      expect(valid2.isValid).toBe(true);
      expect(valid2.normalized).toBe("+15553456789");

      // Invalid area codes (NANP area codes cannot begin with 0 or 1)
      const invalidArea = validatePhoneNumber("0123456789");
      expect(invalidArea.isValid).toBe(false);
      expect(invalidArea.errorCode).toBe("INVALID_PHONE_NANP_AREA_CODE");

      // Invalid length
      const invalidLen = validatePhoneNumber("12345");
      expect(invalidLen.isValid).toBe(false);
      expect(invalidLen.errorCode).toBe("INVALID_PHONE_LENGTH");
    });

    it("deterministically validates emails without LLM invocation", () => {
      const valid = validateEmail("care.manager@horizonhealth.org");
      expect(valid.isValid).toBe(true);
      expect(valid.normalized).toBe("care.manager@horizonhealth.org");

      const invalid = validateEmail("not-an-email@");
      expect(invalid.isValid).toBe(false);
      expect(invalid.errorCode).toBe("INVALID_EMAIL_FORMAT");
    });

    it("deterministically validates 10-digit NPIs using the official CMS Luhn checksum", () => {
      // Valid NPI example matching CMS Luhn Check Digit specification:
      // Base: "123456789", check digit "3" -> 1234567893
      // Prefix 80840 + 1234567893 -> sum is divisible by 10
      const validNPI = validateNPI("1234567893");
      expect(validNPI.isValid).toBe(true);
      expect(validNPI.normalized).toBe("1234567893");

      // Invalid checksum
      const invalidNPI = validateNPI("1234567890");
      expect(invalidNPI.isValid).toBe(false);
      expect(invalidNPI.errorCode).toBe("INVALID_NPI_CHECKSUM");

      // Invalid length
      const shortNPI = validateNPI("12345");
      expect(shortNPI.isValid).toBe(false);
      expect(shortNPI.errorCode).toBe("INVALID_NPI_LENGTH");
    });

    it("deterministically validates appointment date windows and order", () => {
      const now = new Date(Date.now() + 86400000); // Tomorrow
      const later = new Date(now.getTime() + 30 * 60000); // +30 minutes

      const validWindow = validateDateWindow(now.toISOString(), later.toISOString());
      expect(validWindow.isValid).toBe(true);
      expect(validWindow.normalized?.start).toBeInstanceOf(Date);

      // Inverted order
      const inverted = validateDateWindow(later.toISOString(), now.toISOString());
      expect(inverted.isValid).toBe(false);
      expect(inverted.errorCode).toBe("INVALID_DATE_ORDER");

      // Past appointment
      const pastStart = new Date(Date.now() - 3600000);
      const pastEnd = new Date(Date.now() - 1800000);
      const pastWindow = validateDateWindow(pastStart.toISOString(), pastEnd.toISOString());
      expect(pastWindow.isValid).toBe(false);
      expect(pastWindow.errorCode).toBe("APPOINTMENT_IN_PAST");
    });

    it("deterministically validates member consent by channel", () => {
      // Outreach false blocks everything
      const noOutreach = validateMemberCommunicationConsent({
        consentOutreach: false,
        consentSms: true,
        channel: "SMS",
      });
      expect(noOutreach.isValid).toBe(false);
      expect(noOutreach.errorCode).toBe("CONSENT_OUTREACH_DENIED");

      // SMS false blocks SMS channel but allows Portal
      const noSms = validateMemberCommunicationConsent({
        consentOutreach: true,
        consentSms: false,
        channel: "SMS",
      });
      expect(noSms.isValid).toBe(false);
      expect(noSms.errorCode).toBe("CONSENT_SMS_DENIED");

      const portalAllowed = validateMemberCommunicationConsent({
        consentOutreach: true,
        consentSms: false,
        channel: "PORTAL",
      });
      expect(portalAllowed.isValid).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // ARCHETYPE 2: Barrier classification -> Low-cost model
  // --------------------------------------------------------------------------
  describe("Archetype 2: Barrier classification -> Low-cost model", () => {
    it("routes routine unstructured barrier extraction to low-cost model (gpt-4o-mini)", () => {
      const task: RoutingTask = {
        taskType: "BARRIER_CLASSIFICATION",
        actionName: "classify_barrier",
        tenantId,
        inputPayload: {
          referralId: "ref-101",
          operationalNotes: "Patient was referred for behavioral health evaluation. Expressed hesitation regarding schedule.",
        },
      };

      const decision = routeAgentTask(task);
      expect(decision.route).toBe("LOW_COST_MODEL");
      expect(decision.target).toBe("gpt-4o-mini");
      expect(decision.estimatedAiTokens).toBeLessThan(700);
      expect(decision.estimatedCostUSD).toBeLessThan(0.001);
      expect(decision.isHumanGated).toBe(false);
      expect(decision.minimumAiJustification).toContain("94% cost reduction");
    });

    it("short-circuits to deterministic code when clear operational keywords match", () => {
      const task: RoutingTask = {
        taskType: "BARRIER_CLASSIFICATION",
        actionName: "classify_barrier",
        tenantId,
        inputPayload: {
          referralId: "ref-transit",
          operationalNotes: "Member cannot attend due to lack of reliable bus transportation or vehicle.",
          verifiedAvailableSlotsCount: 3,
          matchingProvidersCount: 2,
        },
      };

      const decision = routeAgentTask(task);
      expect(decision.route).toBe("DETERMINISTIC_CODE");
      expect(decision.estimatedAiTokens).toBe(0);
      expect(decision.target).toContain("evaluateDeterministicBarrierShortcut");
    });
  });

  // --------------------------------------------------------------------------
  // ARCHETYPE 3: Complex ambiguous case -> Stronger model
  // --------------------------------------------------------------------------
  describe("Archetype 3: Complex ambiguous case -> Stronger model", () => {
    it("routes contradictory multi-signal cases to stronger model (gpt-4o)", () => {
      const task: RoutingTask = {
        taskType: "COMPLEX_REASONING",
        tenantId,
        isAmbiguous: true,
        ambiguitySignals: {
          conflictingEvidenceCount: 2,
          hasContradictoryNotes: true,
          confidenceScore: 0.52,
        },
        inputPayload: {
          notes: "Intake note states patient eagerly consented to therapy, but subsequent note reports patient refused navigator outreach and denied referral.",
        },
      };

      const decision = routeAgentTask(task);
      expect(decision.route).toBe("STRONGER_MODEL");
      expect(decision.target).toBe("gpt-4o");
      expect(decision.estimatedAiTokens).toBeGreaterThanOrEqual(1000);
      expect(decision.minimumAiJustification).toContain("cheaper deterministic");
    });

    it("elevates barrier classification to stronger model when conflicting evidence is detected", () => {
      const task: RoutingTask = {
        taskType: "BARRIER_CLASSIFICATION",
        actionName: "classify_barrier",
        tenantId,
        ambiguitySignals: {
          conflictingEvidenceCount: 3,
          multipleCompetingBarriers: true,
        },
        inputPayload: {
          notes: "Patient reports transportation deficit, clinic reports member missed appointments due to childcare, and EHR notes active eviction proceeding.",
        },
      };

      const decision = routeAgentTask(task);
      expect(decision.route).toBe("STRONGER_MODEL");
      expect(decision.target).toBe("gpt-4o");
    });
  });

  // --------------------------------------------------------------------------
  // ARCHETYPE 4: High-risk action -> Human approval
  // --------------------------------------------------------------------------
  describe("Archetype 4: High-risk action -> Human approval gate", () => {
    it("routes high-risk clinical actions and policy overrides to human approval gate", () => {
      const highRiskActions = [
        "APPROVE_CLINICAL_INTERVENTION",
        "EXECUTE_CLINICAL_INTERVENTION",
        "OVERRIDE_SAFETY_POLICY",
        "CLOSE_HIGH_RISK_CASE",
        "INVOLUNTARY_DISENROLLMENT",
      ];

      for (const action of highRiskActions) {
        const task: RoutingTask = {
          taskType: "ACTION_EXECUTION",
          actionName: action,
          riskLevel: "HIGH",
          tenantId,
          caseId: "case-999",
          inputPayload: { interventionId: "int-1" },
        };

        const decision = routeAgentTask(task);
        expect(decision.route).toBe("HUMAN_APPROVAL_GATE");
        expect(decision.isHumanGated).toBe(true);
        expect(decision.estimatedAiTokens).toBe(0);
        expect(decision.target).toContain("requestHumanApproval");
      }
    });

    it("recognizes all standard high-risk actions in HIGH_RISK_ACTION_SET", () => {
      expect(HIGH_RISK_ACTION_SET.has("APPROVE_CLINICAL_INTERVENTION")).toBe(true);
      expect(HIGH_RISK_ACTION_SET.has("OVERRIDE_SAFETY_POLICY")).toBe(true);
      expect(HIGH_RISK_ACTION_SET.has("CLOSE_HIGH_RISK_CASE")).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // ARCHETYPE 5: Provider search -> Deterministic provider tool
  // --------------------------------------------------------------------------
  describe("Archetype 5: Provider search -> Deterministic provider tool", () => {
    it("routes provider search and availability checks to deterministic tool", () => {
      const task: RoutingTask = {
        taskType: "PROVIDER_SEARCH",
        actionName: "search_providers",
        tenantId,
        inputPayload: {
          specialty: "PSYCHIATRY",
          maxDistanceMiles: 15,
          language: "SPANISH",
        },
      };

      const decision = routeAgentTask(task);
      expect(decision.route).toBe("DETERMINISTIC_TOOL");
      expect(decision.target).toBe("toolExecutor.search_providers");
      expect(decision.estimatedAiTokens).toBe(0);
      expect(decision.minimumAiJustification).toContain("must never be hallucinated");
    });
  });

  // --------------------------------------------------------------------------
  // ARCHETYPE 6: State transition -> Deterministic state machine
  // --------------------------------------------------------------------------
  describe("Archetype 6: State transition -> Deterministic state machine", () => {
    it("routes state transitions to the deterministic state machine validator", () => {
      const task: RoutingTask = {
        taskType: "STATE_TRANSITION",
        actionName: "TRANSITION_STATE",
        tenantId,
        inputPayload: {
          fromStatus: "NEW",
          toStatus: "TRIAGED",
        },
      };

      const decision = routeAgentTask(task);
      expect(decision.route).toBe("DETERMINISTIC_STATE_MACHINE");
      expect(decision.estimatedAiTokens).toBe(0);
      expect(decision.target).toContain("validateTransition");
    });

    it("strictly permits valid case transitions and rejects illegal transitions", () => {
      // Valid transition
      const valid = validateStateMachineTransition("NEW", "TRIAGED");
      expect(valid.isValid).toBe(true);
      expect(valid.normalized?.from).toBe("NEW");
      expect(valid.normalized?.to).toBe("TRIAGED");

      // Illegal transition (cannot jump from CANCELLED to COMPLETED)
      const invalid = validateStateMachineTransition("CANCELLED", "APPOINTMENT_COMPLETED");
      expect(invalid.isValid).toBe(false);
      expect(invalid.errorCode).toBe("INVALID_STATE_TRANSITION");
    });
  });

  // --------------------------------------------------------------------------
  // ARCHETYPE 7: Execution via AgentRouter Dispatcher
  // --------------------------------------------------------------------------
  describe("AgentRouter Dispatcher & Execution", () => {
    const mockSession: any = {
      userId: "cm-user-1",
      tenantId,
      role: "CARE_MANAGER",
      permissions: ["cases.read", "cases.write", "providers.read"],
    };

    it("executes simple validation deterministically with zero latency overhead", async () => {
      const task: RoutingTask = {
        taskType: "VALIDATION",
        actionName: "VALIDATE_PHONE",
        tenantId,
        inputPayload: { phone: "555-432-1098" },
      };

      const result = await agentRouter.execute(task, { session: mockSession });
      expect(result.success).toBe(true);
      expect(result.tokensConsumed).toBe(0);
      expect(result.costUSD).toBe(0);
      expect(result.humanApprovalRequired).toBe(false);
      expect((result.output as any).isValid).toBe(true);
      expect((result.output as any).normalized).toBe("+15554321098");
    });

    it("executes state transitions deterministically via state machine", async () => {
      const task: RoutingTask = {
        taskType: "STATE_TRANSITION",
        tenantId,
        inputPayload: { fromStatus: "NEW", toStatus: "TRIAGED" },
      };

      const result = await agentRouter.execute(task, { session: mockSession });
      expect(result.success).toBe(true);
      expect(result.tokensConsumed).toBe(0);
      expect((result.output as any).isValid).toBe(true);
    });

    it("intercepts high-risk actions into pending human approval status", async () => {
      const task: RoutingTask = {
        taskType: "ACTION_EXECUTION",
        actionName: "APPROVE_CLINICAL_INTERVENTION",
        riskLevel: "HIGH",
        tenantId,
        caseId: "case-sample-123",
        inputPayload: { interventionId: "int-5" },
      };

      const result = await agentRouter.execute(task, { session: mockSession });
      expect(result.success).toBe(true);
      expect(result.humanApprovalRequired).toBe(true);
      expect((result.output as any).status).toBe("APPROVAL_PENDING");
      expect(result.tokensConsumed).toBe(0);
    });
  });
});
