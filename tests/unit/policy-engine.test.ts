import { describe, expect, it } from "vitest";
import {
  AIPolicyViolationError,
  assertCareLoopPolicyAllowed,
  CARE_LOOP_POLICY_RULES,
  evaluateCareLoopPolicy,
} from "@/ai";
import {
  CARELOOP_CENTRAL_POLICY,
  careLoopPolicyEvaluator,
  type PolicyContext,
  type PolicyDecision,
} from "@/policy";

describe("Centralized Declarative Policy Engine", () => {
  it("exposes declarative rules covering DENY, REQUIRE_HUMAN_APPROVAL, and ALLOW", () => {
    const effects = new Set(CARE_LOOP_POLICY_RULES.map((rule) => rule.effect));
    expect(effects.has("DENY")).toBe(true);
    expect(effects.has("REQUIRE_HUMAN_APPROVAL")).toBe(true);
    expect(effects.has("ALLOW")).toBe(true);
  });

  it("allows schedule_appointment when consent, state, and availability pass on standard risk", () => {
    const verdict = evaluateCareLoopPolicy({
      action: "schedule_appointment",
      caseState: "PROVIDER_SELECTED",
      riskTier: "MODERATE",
      consentOutreach: true,
      verifiedAvailableSlotsCount: 2,
      policyCheckRequired: true,
    });

    expect(verdict.allowed).toBe(true);
    expect(verdict.decision).toBe("ALLOW");
    expect(verdict.requires_human_approval).toBe(false);
    expect(verdict.denial_reasons).toHaveLength(0);
  });

  it("denies scheduling when verified available slots count is zero or case is terminal", () => {
    const noSlots = evaluateCareLoopPolicy({
      action: "schedule_appointment",
      caseState: "PROVIDER_SELECTED",
      verifiedAvailableSlotsCount: 0,
    });
    expect(noSlots.allowed).toBe(false);
    expect(noSlots.decision).toBe("DENY");
    expect(noSlots.matched_rules.some((r) => r.id === "POLICY_VERIFIED_AVAILABILITY_FOR_BOOKING")).toBe(true);

    const terminal = evaluateCareLoopPolicy({
      action: "schedule_appointment",
      caseState: "CLOSED",
      verifiedAvailableSlotsCount: 3,
    });
    expect(terminal.allowed).toBe(false);
    expect(terminal.decision).toBe("DENY");
    expect(terminal.matched_rules.some((r) => r.id === "POLICY_SCHEDULING_PRECONDITIONS")).toBe(true);
  });

  it("denies external outreach and SMS reminders when required consent is invalid", () => {
    const noOutreachConsent = evaluateCareLoopPolicy({
      action: "send_member_communication",
      channel: "PHONE",
      consentOutreach: false,
    });
    expect(noOutreachConsent.allowed).toBe(false);
    expect(noOutreachConsent.decision).toBe("DENY");
    expect(noOutreachConsent.matched_rules.some((r) => r.id === "POLICY_COMMUNICATION_CONSENT")).toBe(true);

    const noSmsConsent = evaluateCareLoopPolicy({
      action: "send_reminder",
      channel: "SMS",
      consentOutreach: true,
      consentSms: false,
    });
    expect(noSmsConsent.allowed).toBe(false);
    expect(noSmsConsent.decision).toBe("DENY");
    expect(noSmsConsent.matched_rules.some((r) => r.id === "POLICY_SMS_CHANNEL_CONSENT")).toBe(true);
  });

  it("requires human approval for high-risk or sensitive external actions and allows once humanApproved=true", () => {
    const unapproved = evaluateCareLoopPolicy({
      action: "send_member_communication",
      channel: "SMS",
      consentOutreach: true,
      consentSms: true,
      sensitiveCommunication: true,
      humanApproved: false,
    });
    expect(unapproved.decision).toBe("REQUIRE_HUMAN_APPROVAL");
    expect(unapproved.requires_human_approval).toBe(true);
    expect(unapproved.allowed).toBe(false);
    expect(() =>
      assertCareLoopPolicyAllowed({
        action: "send_member_communication",
        channel: "SMS",
        consentOutreach: true,
        consentSms: true,
        sensitiveCommunication: true,
        humanApproved: false,
      })
    ).toThrow(AIPolicyViolationError);

    const approved = assertCareLoopPolicyAllowed({
      action: "send_member_communication",
      channel: "SMS",
      consentOutreach: true,
      consentSms: true,
      sensitiveCommunication: true,
      humanApproved: true,
    });
    expect(approved.decision).toBe("REQUIRE_HUMAN_APPROVAL");
    expect(approved.allowed).toBe(true);
  });

  it("denies clinical advice payloads, missing verified completion on closure, and policy_check_required=false", () => {
    expect(() =>
      assertCareLoopPolicyAllowed({
        action: "send_member_communication",
        channel: "PORTAL",
        textPayloads: ["Please diagnose and prescribe a dosage adjustment."],
      })
    ).toThrow(AIPolicyViolationError);

    expect(() =>
      assertCareLoopPolicyAllowed({
        action: "close_verified_case",
        hasVerifiedCompletion: false,
        humanApproved: true,
      })
    ).toThrow(AIPolicyViolationError);

    expect(() =>
      assertCareLoopPolicyAllowed({
        action: "search_providers",
        policyCheckRequired: false,
      })
    ).toThrow(AIPolicyViolationError);
  });

  it("evaluates ALLOW, DENY, REQUIRE_APPROVAL, and REQUIRE_HUMAN across all enterprise PolicyContext dimensions", () => {
    expect(CARELOOP_CENTRAL_POLICY.rules.length).toBeGreaterThanOrEqual(7);

    // 1. PHI minimization & BAA egress DENY
    const phiDenied: PolicyDecision = careLoopPolicyEvaluator.evaluate({
      action: "classifyBarrier",
      phiAccess: { containsPhi: true, phiMinimized: false },
    });
    expect(phiDenied.effect).toBe("DENY");
    expect(phiDenied.allowed).toBe(false);

    const baaDenied: PolicyDecision = careLoopPolicyEvaluator.evaluate({
      action: "classifyBarrier",
      phiAccess: { containsPhi: true, phiMinimized: true, externalEgress: true, baaExecuted: false },
    });
    expect(baaDenied.effect).toBe("DENY");

    // 2. Tool permissions & agent admin inheritance DENY
    const missingPerm = careLoopPolicyEvaluator.evaluate({
      action: "scheduleAppointment",
      toolPermissions: { required: ["appointments.write"], granted: ["cases.read"] },
    });
    expect(missingPerm.effect).toBe("DENY");

    const agentAdmin = careLoopPolicyEvaluator.evaluate({
      action: "admin.manage",
      userRole: "AGENT_SERVICE",
      agentIdentity: { isServiceIdentity: true, serviceId: "orch-1" },
    });
    expect(agentAdmin.effect).toBe("DENY");

    // 3. Tenant policy REQUIRE_HUMAN
    const tenantHumanOnly: PolicyDecision = careLoopPolicyEvaluator.evaluate({
      action: "sendMemberMessage",
      userRole: "AGENT_SERVICE",
      agentIdentity: { isServiceIdentity: true, serviceId: "orch-1" },
      tenantPolicy: { allowAutonomousExecution: false },
    });
    expect(tenantHumanOnly.effect).toBe("REQUIRE_HUMAN");
    expect(tenantHumanOnly.requiresHuman).toBe(true);

    // 4. High action risk REQUIRE_APPROVAL
    const highRiskApproval: PolicyDecision = careLoopPolicyEvaluator.evaluate({
      action: "sendMemberMessage",
      actionRisk: "HIGH",
      memberConsent: { consentOutreach: true, consentSms: true },
      communicationChannel: "SMS",
      humanApproved: false,
    });
    expect(highRiskApproval.effect).toBe("REQUIRE_APPROVAL");
    expect(highRiskApproval.requiresApproval).toBe(true);

    // 5. Full valid PolicyContext ALLOW
    const allowedCtx: PolicyContext = {
      action: "searchProviders",
      userRole: "AGENT_SERVICE",
      agentIdentity: {
        isServiceIdentity: true,
        serviceId: "matcher-1",
        scopedPermissions: ["provider.read"],
      },
      caseState: "TRIAGED",
      actionRisk: "LOW",
      phiAccess: { containsPhi: false, phiMinimized: true },
      toolPermissions: { required: ["provider.read"], granted: ["provider.read"] },
      policyCheckRequired: true,
    };
    const allowed = careLoopPolicyEvaluator.assertAllowed(allowedCtx);
    expect(allowed.effect).toBe("ALLOW");
    expect(allowed.allowed).toBe(true);
  });
});
