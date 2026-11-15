import { CaseStatus } from "@prisma/client";
import { ValidationError } from "@/lib/errors";
import { CaseOrchestratorTool } from "./schemas";
import { getToolDefinition, requiresHumanApprovalForTool } from "./tool-registry";

export const PROHIBITED_CLINICAL_PATTERNS = [
  /\bprescrib(e|ing|ed)\b/i,
  /\bdiagnos(e|is|ing)\b/i,
  /\bdosage\b/i,
  /\bpsychotherapy session\b/i,
  /\bcall 911\b/i,
  /\bsuicid(e|al)\b/i,
];

export class AIPolicyViolationError extends ValidationError {
  constructor(message: string, details?: unknown) {
    super(`AI Policy Rejection: ${message}`, details);
  }
}

export function assertNoClinicalAdvice(texts: string[]): void {
  for (const text of texts) {
    for (const pattern of PROHIBITED_CLINICAL_PATTERNS) {
      if (pattern.test(text)) {
        throw new AIPolicyViolationError(
          `AI output violated non-clinical scope boundary (${pattern.source}).`
        );
      }
    }
  }
}

export type PolicyDecisionEffect = "ALLOW" | "REQUIRE_HUMAN_APPROVAL" | "DENY";

export interface PolicyEvaluationContext {
  action: CaseOrchestratorTool;
  caseState?: CaseStatus | string;
  riskTier?: string;
  consentOutreach?: boolean;
  consentSms?: boolean;
  channel?: "SMS" | "PHONE" | "EMAIL" | "PORTAL" | "IN_PERSON_NAVIGATOR";
  sensitiveCommunication?: boolean;
  matchedProviderId?: string | null;
  verifiedAvailableSlotsCount?: number;
  hasVerifiedCompletion?: boolean;
  humanApproved?: boolean;
  policyCheckRequired?: boolean;
  textPayloads?: string[];
}

export interface DeclarativePolicyRule {
  id: string;
  description: string;
  effect: PolicyDecisionEffect;
  matches: (ctx: PolicyEvaluationContext) => boolean;
  reason: (ctx: PolicyEvaluationContext) => string;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  decision: PolicyDecisionEffect;
  requires_human_approval: boolean;
  matched_rules: Array<{ id: string; effect: PolicyDecisionEffect; reason: string }>;
  denial_reasons: string[];
}

const NON_SCHEDULABLE_TERMINAL_STATES = new Set<string>([
  "CLOSED",
  "LOST_TO_FOLLOW_UP",
]);

/**
 * Declarative centralized CareLoop Policy Engine.
 * The agent proposes an action; these declarative rules determine whether
 * the action is ALLOWED, requires HUMAN APPROVAL, or is DENIED.
 */
export const CARE_LOOP_POLICY_RULES: readonly DeclarativePolicyRule[] = [
  {
    id: "POLICY_CHECK_FLAG_REQUIRED",
    description: "IF policy_check_required != true THEN denied",
    effect: "DENY",
    matches: (ctx) => ctx.policyCheckRequired === false,
    reason: () => "Policy evaluation cannot be bypassed (policy_check_required must remain true).",
  },
  {
    id: "POLICY_NON_CLINICAL_BOUNDARY",
    description: "IF payload contains clinical diagnosis, prescribing, dosage, or crisis directives THEN denied",
    effect: "DENY",
    matches: (ctx) =>
      (ctx.textPayloads ?? []).some((t) =>
        PROHIBITED_CLINICAL_PATTERNS.some((pattern) => pattern.test(t))
      ),
    reason: () => "Action rejected: violated CareLoop non-clinical care coordination boundary.",
  },
  {
    id: "POLICY_COMMUNICATION_CONSENT",
    description: "IF action is external communication/reminder AND communication_consent != valid THEN denied",
    effect: "DENY",
    matches: (ctx) =>
      (ctx.action === "send_member_communication" || ctx.action === "send_reminder") &&
      ctx.channel !== "PORTAL" &&
      ctx.consentOutreach === false,
    reason: () =>
      "Consent policy violation: external outreach or reminder cannot execute when member outreach consent is false.",
  },
  {
    id: "POLICY_SMS_CHANNEL_CONSENT",
    description: "IF channel = SMS AND sms_consent != valid THEN denied",
    effect: "DENY",
    matches: (ctx) =>
      (ctx.action === "send_member_communication" || ctx.action === "send_reminder") &&
      ctx.channel === "SMS" &&
      ctx.consentSms === false,
    reason: () => "Consent policy violation: SMS channel requires verified member SMS consent.",
  },
  {
    id: "POLICY_VERIFIED_AVAILABILITY_FOR_BOOKING",
    description: "IF action = schedule_appointment AND verified_available_slots == 0 THEN denied",
    effect: "DENY",
    matches: (ctx) =>
      ctx.action === "schedule_appointment" && ctx.verifiedAvailableSlotsCount === 0,
    reason: () =>
      "Verified availability violation: 'schedule_appointment' cannot run without verified available provider slots.",
  },
  {
    id: "POLICY_SCHEDULING_PRECONDITIONS",
    description: "IF action = schedule_appointment AND case_state is terminal THEN denied",
    effect: "DENY",
    matches: (ctx) =>
      ctx.action === "schedule_appointment" &&
      typeof ctx.caseState === "string" &&
      NON_SCHEDULABLE_TERMINAL_STATES.has(ctx.caseState),
    reason: (ctx) =>
      `Scheduling policy violation: cannot schedule appointment while case is in terminal state '${ctx.caseState}'.`,
  },
  {
    id: "POLICY_VERIFIED_COMPLETION_FOR_CLOSURE",
    description: "IF action = close_verified_case AND verified_completion != true THEN denied",
    effect: "DENY",
    matches: (ctx) =>
      ctx.action === "close_verified_case" && ctx.hasVerifiedCompletion === false,
    reason: () =>
      "Completion policy violation: 'close_verified_case' requires an attested CompletionVerification or firstCompletedVisitAt.",
  },
  {
    id: "POLICY_HIGH_RISK_OR_HUMAN_TOOL_APPROVAL",
    description:
      "IF action is high-risk, sensitive communication, or ALWAYS_REQUIRED human tool THEN human_approval_required",
    effect: "REQUIRE_HUMAN_APPROVAL",
    matches: (ctx) =>
      requiresHumanApprovalForTool(ctx.action, {
        riskTier: ctx.riskTier,
        sensitiveCommunication: ctx.sensitiveCommunication,
      }),
    reason: (ctx) => {
      const def = getToolDefinition(ctx.action);
      return `Human approval required for '${ctx.action}' (risk=${def.risk_level}, approval=${def.human_approval_requirement}, caseRisk=${ctx.riskTier ?? "UNSPECIFIED"}).`;
    },
  },
  {
    id: "POLICY_LOW_MEDIUM_GUARDED_EXECUTION",
    description:
      "IF action = schedule_appointment (or low/medium tool) AND consent/preconditions pass THEN allowed",
    effect: "ALLOW",
    matches: () => true,
    reason: (ctx) => `Policy checks passed for action '${ctx.action}'.`,
  },
];

export function evaluateCareLoopPolicy(ctx: PolicyEvaluationContext): PolicyEvaluationResult {
  const matched = CARE_LOOP_POLICY_RULES.filter((rule) => rule.matches(ctx)).map((rule) => ({
    id: rule.id,
    effect: rule.effect,
    reason: rule.reason(ctx),
  }));

  const denials = matched.filter((m) => m.effect === "DENY");
  const humanApprovals = matched.filter((m) => m.effect === "REQUIRE_HUMAN_APPROVAL");

  if (denials.length > 0) {
    return {
      allowed: false,
      decision: "DENY",
      requires_human_approval: humanApprovals.length > 0,
      matched_rules: matched,
      denial_reasons: denials.map((d) => d.reason),
    };
  }

  if (humanApprovals.length > 0) {
    return {
      allowed: Boolean(ctx.humanApproved),
      decision: "REQUIRE_HUMAN_APPROVAL",
      requires_human_approval: true,
      matched_rules: matched,
      denial_reasons: ctx.humanApproved ? [] : humanApprovals.map((h) => h.reason),
    };
  }

  return {
    allowed: true,
    decision: "ALLOW",
    requires_human_approval: false,
    matched_rules: matched,
    denial_reasons: [],
  };
}

export function assertCareLoopPolicyAllowed(ctx: PolicyEvaluationContext): PolicyEvaluationResult {
  const verdict = evaluateCareLoopPolicy(ctx);
  if (!verdict.allowed) {
    throw new AIPolicyViolationError(
      verdict.denial_reasons[0] ?? `Action '${ctx.action}' denied by CareLoop policy engine.`,
      { matched_rules: verdict.matched_rules }
    );
  }
  return verdict;
}
