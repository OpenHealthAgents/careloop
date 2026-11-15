import {
  AIPolicyViolationError,
  assertCareLoopPolicyAllowed,
  CARE_LOOP_POLICY_RULES,
  evaluateCareLoopPolicy,
  PolicyEvaluationContext,
} from "@/ai/policy-engine";
import { CaseOrchestratorToolSchema } from "@/ai/schemas";
import type { Policy, PolicyContext, PolicyDecision, PolicyEvaluator, PolicyRule } from "./contracts";

export * from "./contracts";
export {
  AIPolicyViolationError,
  assertCareLoopPolicyAllowed,
  assertNoClinicalAdvice,
  CARE_LOOP_POLICY_RULES,
  evaluateCareLoopPolicy,
} from "@/ai/policy-engine";
export type { PolicyDecisionEffect, PolicyEvaluationContext } from "@/ai/policy-engine";
export { enforceOrchestratorDecisionPolicy } from "@/ai/policy-guard";

const PRIVILEGED_ADMIN_ACTIONS = new Set(["admin.manage", "users.manage", "tenant.manage"]);

export const ENTERPRISE_POLICY_RULES: readonly PolicyRule[] = [
  {
    id: "POLICY_PHI_MINIMIZATION_REQUIRED",
    description: "IF phiAccess.containsPhi && phiAccess.phiMinimized === false THEN DENY",
    effect: "DENY",
    matches: (ctx) => Boolean(ctx.phiAccess?.containsPhi && ctx.phiAccess?.phiMinimized === false),
    reason: () => "PHI minimization violation: unminimized PHI cannot be passed to agent/tool execution.",
  },
  {
    id: "POLICY_PHI_EGRESS_REQUIRES_BAA",
    description: "IF phiAccess.externalEgress && !phiAccess.baaExecuted THEN DENY",
    effect: "DENY",
    matches: (ctx) => Boolean(ctx.phiAccess?.externalEgress && !ctx.phiAccess?.baaExecuted),
    reason: () => "Vendor BAA boundary violation: external PHI egress requires an executed BAA.",
  },
  {
    id: "POLICY_TOOL_PERMISSIONS_REQUIRED",
    description: "IF toolPermissions.required not subset of granted THEN DENY",
    effect: "DENY",
    matches: (ctx) => {
      if (!ctx.toolPermissions) return false;
      const granted = new Set(ctx.toolPermissions.granted);
      return ctx.toolPermissions.required.some((p) => !granted.has(p));
    },
    reason: () => "Authorization policy violation: caller lacks required tool permissions.",
  },
  {
    id: "POLICY_AGENT_NO_ADMIN_INHERITANCE",
    description: "IF agentIdentity.isServiceIdentity && privileged admin action THEN DENY",
    effect: "DENY",
    matches: (ctx) =>
      Boolean(
        ctx.agentIdentity?.isServiceIdentity &&
          (PRIVILEGED_ADMIN_ACTIONS.has(ctx.action) ||
            ctx.toolPermissions?.required.some((p) => PRIVILEGED_ADMIN_ACTIONS.has(p)))
      ),
    reason: () => "Least-privilege violation: agent service identities cannot execute admin actions.",
  },
  {
    id: "POLICY_TENANT_HUMAN_ONLY_EXECUTION",
    description: "IF agentIdentity.isServiceIdentity && tenantPolicy.allowAutonomousExecution === false THEN REQUIRE_HUMAN",
    effect: "REQUIRE_HUMAN",
    matches: (ctx) =>
      Boolean(
        ctx.agentIdentity?.isServiceIdentity &&
          ctx.tenantPolicy?.allowAutonomousExecution === false &&
          !ctx.humanApproved
      ),
    reason: () => "Tenant policy disables autonomous agent execution; human execution required.",
  },
  {
    id: "POLICY_TENANT_EXTERNAL_COMMS_HUMAN",
    description: "IF tenantPolicy.requireHumanForExternalComms && external comms action THEN REQUIRE_HUMAN",
    effect: "REQUIRE_HUMAN",
    matches: (ctx) =>
      Boolean(
        ctx.tenantPolicy?.requireHumanForExternalComms &&
          (ctx.action === "sendMemberMessage" ||
            ctx.action === "send_member_communication" ||
            ctx.action === "sendReminder" ||
            ctx.action === "send_reminder") &&
          !ctx.humanApproved
      ),
    reason: () => "Tenant policy requires human oversight for external member communications.",
  },
  {
    id: "POLICY_HIGH_RISK_ACTION_APPROVAL",
    description: "IF actionRisk === HIGH || tenantPolicy.requireHumanForHighRisk THEN REQUIRE_APPROVAL",
    effect: "REQUIRE_APPROVAL",
    matches: (ctx) =>
      Boolean(
        (ctx.actionRisk === "HIGH" ||
          (ctx.tenantPolicy?.requireHumanForHighRisk && ctx.riskTier === "HIGH")) &&
          !ctx.humanApproved
      ),
    reason: () => "High-risk action requires explicit human approval prior to execution.",
  },
];

export const CARELOOP_CENTRAL_POLICY: Policy = {
  id: "careloop.central.policy.v2",
  name: "CareLoop Centralized Safety, Consent, PHI & Authorization Policy",
  version: "2.0.0",
  rules: ENTERPRISE_POLICY_RULES,
};

function toCorePolicyContext(ctx: PolicyContext): PolicyEvaluationContext | null {
  const parsedTool = CaseOrchestratorToolSchema.safeParse(ctx.action);
  if (!parsedTool.success) return null;
  return {
    action: parsedTool.data,
    caseState: ctx.caseState,
    riskTier: ctx.riskTier,
    consentOutreach: ctx.memberConsent?.consentOutreach ?? ctx.consentOutreach,
    consentSms: ctx.memberConsent?.consentSms ?? ctx.consentSms,
    channel: ctx.communicationChannel ?? ctx.channel,
    sensitiveCommunication: ctx.sensitiveCommunication,
    matchedProviderId: ctx.matchedProviderId,
    verifiedAvailableSlotsCount: ctx.verifiedAvailableSlotsCount,
    hasVerifiedCompletion: ctx.hasVerifiedCompletion,
    humanApproved: ctx.humanApproved,
    policyCheckRequired: ctx.policyCheckRequired,
    textPayloads: ctx.textPayloads,
  };
}

export class CareLoopPolicyEvaluator implements PolicyEvaluator {
  evaluate(context: PolicyContext | PolicyEvaluationContext): PolicyDecision {
    const ctx = context as PolicyContext;
    if (ctx.policyCheckRequired === false) {
      return {
        effect: "DENY",
        allowed: false,
        requiresHumanApproval: false,
        requiresApproval: false,
        requiresHuman: false,
        reason: "Policy evaluation cannot be bypassed (policyCheckRequired must remain true).",
        matchedRules: ["POLICY_CHECK_FLAG_REQUIRED"],
        denialReasons: ["Policy evaluation cannot be bypassed."],
      };
    }

    const matchedEnterprise = ENTERPRISE_POLICY_RULES.filter((r) => r.matches(ctx));
    const coreCtx = toCorePolicyContext(ctx);
    const coreResult = coreCtx ? evaluateCareLoopPolicy(coreCtx) : null;

    const denialRules = matchedEnterprise.filter((r) => r.effect === "DENY");
    const humanRules = matchedEnterprise.filter((r) => r.effect === "REQUIRE_HUMAN");
    const approvalRules = matchedEnterprise.filter((r) => r.effect === "REQUIRE_APPROVAL");

    const denialReasons = [
      ...denialRules.map((r) => r.reason(ctx)),
      ...(coreResult?.decision === "DENY" ? coreResult.denial_reasons : []),
    ];
    const matchedRules = [
      ...matchedEnterprise.map((r) => r.id),
      ...(coreResult?.matched_rules.map((r) => r.id) ?? []),
    ];

    if (denialReasons.length > 0 || (coreResult && !coreResult.allowed && coreResult.decision === "DENY")) {
      return {
        effect: "DENY",
        allowed: false,
        requiresHumanApproval: false,
        requiresApproval: false,
        requiresHuman: false,
        reason: denialReasons[0] ?? "Denied by CareLoop policy engine.",
        matchedRules,
        denialReasons,
      };
    }

    if (humanRules.length > 0) {
      return {
        effect: "REQUIRE_HUMAN",
        allowed: false,
        requiresHumanApproval: true,
        requiresApproval: true,
        requiresHuman: true,
        reason: humanRules.map((r) => r.reason(ctx)).join("; "),
        matchedRules,
        denialReasons: [],
      };
    }

    if (approvalRules.length > 0 || (coreResult?.requires_human_approval && !coreResult.allowed)) {
      const reasons = [
        ...approvalRules.map((r) => r.reason(ctx)),
        ...(coreResult?.matched_rules
          .filter((r) => r.effect === "REQUIRE_HUMAN_APPROVAL")
          .map((r) => r.reason) ?? []),
      ];
      return {
        effect: "REQUIRE_APPROVAL",
        allowed: false,
        requiresHumanApproval: true,
        requiresApproval: true,
        requiresHuman: false,
        reason: reasons.join("; ") || "Human approval required.",
        matchedRules,
        denialReasons: [],
      };
    }

    return {
      effect: "ALLOW",
      allowed: true,
      requiresHumanApproval: false,
      requiresApproval: false,
      requiresHuman: false,
      reason:
        coreResult?.matched_rules.map((r) => r.reason).join("; ") || "Allowed by CareLoop policy.",
      matchedRules,
      denialReasons: [],
    };
  }

  assertAllowed(context: PolicyContext | PolicyEvaluationContext): PolicyDecision {
    const decision = this.evaluate(context);
    if (!decision.allowed) {
      throw new AIPolicyViolationError(decision.reason, {
        effect: decision.effect,
        matchedRules: decision.matchedRules,
      });
    }
    return decision;
  }
}

export const careLoopPolicyEvaluator = new CareLoopPolicyEvaluator();
