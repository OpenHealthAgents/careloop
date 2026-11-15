import type { CaseStatus } from "@prisma/client";
import type { PolicyDecisionEffect, PolicyEvaluationContext } from "@/ai/policy-engine";

export type PolicyEffect = "ALLOW" | "DENY" | "REQUIRE_APPROVAL" | "REQUIRE_HUMAN";

export interface PolicyContext {
  action: string;
  userRole?: string;
  agentIdentity?: {
    isServiceIdentity: boolean;
    serviceId?: string;
    scopedPermissions?: readonly string[];
  };
  caseState?: CaseStatus | string;
  actionRisk?: "LOW" | "MEDIUM" | "HIGH";
  riskTier?: string;
  memberConsent?: {
    consentOutreach?: boolean;
    consentSms?: boolean;
  };
  communicationChannel?: "SMS" | "PHONE" | "EMAIL" | "PORTAL" | "IN_PERSON_NAVIGATOR";
  tenantPolicy?: {
    requireHumanForHighRisk?: boolean;
    requireHumanForExternalComms?: boolean;
    allowAutonomousExecution?: boolean;
  };
  phiAccess?: {
    containsPhi?: boolean;
    phiMinimized?: boolean;
    externalEgress?: boolean;
    baaExecuted?: boolean;
  };
  toolPermissions?: {
    required: readonly string[];
    granted: readonly string[];
  };
  verifiedAvailableSlotsCount?: number;
  hasVerifiedCompletion?: boolean;
  humanApproved?: boolean;
  policyCheckRequired?: boolean;
  textPayloads?: string[];
  // Legacy flat aliases supported seamlessly
  consentOutreach?: boolean;
  consentSms?: boolean;
  channel?: "SMS" | "PHONE" | "EMAIL" | "PORTAL" | "IN_PERSON_NAVIGATOR";
  sensitiveCommunication?: boolean;
  matchedProviderId?: string | null;
}

export interface PolicyRule {
  id: string;
  description: string;
  effect: PolicyEffect;
  matches(context: PolicyContext): boolean;
  reason(context: PolicyContext): string;
}

export interface Policy {
  id: string;
  name: string;
  version: string;
  rules: readonly PolicyRule[];
}

export interface PolicyDecision {
  effect: PolicyEffect | PolicyDecisionEffect;
  allowed: boolean;
  requiresHumanApproval: boolean;
  requiresApproval: boolean;
  requiresHuman: boolean;
  reason: string;
  matchedRules: string[];
  denialReasons: string[];
}

export interface PolicyEvaluator {
  evaluate(context: PolicyContext | PolicyEvaluationContext): PolicyDecision;
  assertAllowed(context: PolicyContext | PolicyEvaluationContext): PolicyDecision;
}
