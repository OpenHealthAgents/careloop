import { validateAgentProposedTransition } from "@/domain/cases/state-machine";
import { validateOutboundCommunication } from "@/domain/communications/validator";
import {
  CalculateRiskResult,
  CaseOrchestratorDecision,
  ClassifyBarrierResult,
  GenerateCommunicationResult,
  MatchProviderResult,
  RecommendInterventionResult,
  SummarizeCaseResult,
} from "./schemas";
import {
  AIPolicyViolationError,
  assertCareLoopPolicyAllowed,
  assertNoClinicalAdvice,
} from "./policy-engine";

export { AIPolicyViolationError, assertNoClinicalAdvice };

const PROTECTED_CHARACTERISTIC_PATTERNS = [
  /\brace\b/i,
  /\bethnicity\b/i,
  /\braceEthnicity/i,
  /\bhispanic\b|\blatino\b|\bblack\b|\bwhite\b|\basian\b|\bindigenous\b/i,
  /\bgender\b|\bsexual\s*orientation\b|\breligion\b/i,
];

const COMPLETION_CLAIM_PATTERNS = [
  /\b(visit|care|appointment)\s+(is\s+|was\s+)?completed\b/i,
  /\bcompleted\s+(behavioral[- ]health\s+)?visit\b/i,
  /\bverified\s+visit\s+completion\b/i,
];

export function enforceBarrierPolicy(result: ClassifyBarrierResult): ClassifyBarrierResult {
  const rawEpistemic = (result as { epistemicStatus?: string }).epistemicStatus;
  if (rawEpistemic === "FACT") {
    throw new AIPolicyViolationError(
      "AI barrier outputs cannot assert epistemicStatus='FACT'; human verification is required."
    );
  }
  if (result.primaryBarrier.category !== "UNKNOWN" && result.evidenceSignals.length === 0) {
    throw new AIPolicyViolationError(
      "Non-UNKNOWN barrier classification rejected because supporting evidenceSignals are missing."
    );
  }
  assertNoClinicalAdvice([
    result.primaryBarrier.rationale,
    ...result.recommendations.map((r) => r.action),
  ]);
  return result;
}

export function enforceRiskPolicy(result: CalculateRiskResult): CalculateRiskResult {
  const riskTexts = [
    ...result.evidenceSignals,
    ...result.signalContributions.flatMap((c) => [c.factor, c.signal]),
  ];
  for (const text of riskTexts) {
    for (const pattern of PROTECTED_CHARACTERISTIC_PATTERNS) {
      if (pattern.test(text)) {
        throw new AIPolicyViolationError(
          `Risk scoring rejected: protected characteristics (${pattern.source}) cannot be used as individual risk signals.`
        );
      }
    }
  }
  assertNoClinicalAdvice([result.explanation, ...result.recommendations.map((r) => r.action)]);
  return result;
}

export function enforceInterventionPolicy(
  result: RecommendInterventionResult,
  context?: { riskTier?: string }
): RecommendInterventionResult {
  assertNoClinicalAdvice(
    result.proposedInterventions.flatMap((p) => [p.reason, p.recommendedAction, p.expectedOutcome])
  );

  for (const prop of result.proposedInterventions) {
    const highRiskCase = context?.riskTier === "HIGH";
    if ((prop.isHighRisk || highRiskCase) && (prop.executionMode === "AUTOMATED" || prop.automationEligible)) {
      throw new AIPolicyViolationError(
        `High-risk intervention safety violation: ${prop.type} cannot be classified AUTOMATED or auto-eligible when high risk.`
      );
    }
    if (
      (prop.type === "HUMAN_OUTREACH" || prop.type === "ESCALATION") &&
      (prop.executionMode !== "HUMAN_ONLY" || prop.automationEligible)
    ) {
      throw new AIPolicyViolationError(
        `Classification policy violation: ${prop.type} must be classified HUMAN_ONLY and never automated.`
      );
    }
  }

  return result;
}

export function enforceCommunicationPolicy(
  result: GenerateCommunicationResult,
  context: { consentSms: boolean; consentOutreach: boolean }
): GenerateCommunicationResult {
  try {
    validateOutboundCommunication({
      body: result.draftMessage,
      subject: result.subject,
      channel: result.channel,
      consentOutreach: context.consentOutreach,
      consentSms: context.consentSms,
      requireConsentForDelivery: true,
    });
  } catch (err) {
    throw new AIPolicyViolationError(
      err instanceof Error ? err.message : "Communication policy check failed."
    );
  }
  return result;
}

export function enforceProviderMatchPolicy(
  result: MatchProviderResult,
  candidatesById: Map<string, { availabilitySource: string }>
): MatchProviderResult {
  for (const match of result.rankedMatches) {
    const actual = candidatesById.get(match.providerId);
    if (!actual) {
      throw new AIPolicyViolationError(
        `AI recommended unknown providerId '${match.providerId}' not present in tenant directory.`
      );
    }
    if (actual.availabilitySource === "NOT_AVAILABLE" && match.recommendedForBooking) {
      throw new AIPolicyViolationError(
        `Unsupported recommendation: provider '${match.providerId}' is NOT_AVAILABLE for booking.`
      );
    }
    if (
      actual.availabilitySource !== "VERIFIED_AVAILABILITY" &&
      match.availabilityLabel === "VERIFIED AVAILABILITY"
    ) {
      throw new AIPolicyViolationError(
        `Availability misrepresentation rejected: provider '${match.providerId}' has '${actual.availabilitySource}', not VERIFIED_AVAILABILITY.`
      );
    }
    if (match.availabilityLabel === "NOT AVAILABLE" && match.recommendedForBooking) {
      throw new AIPolicyViolationError(
        `Unsupported booking recommendation for unavailable provider '${match.providerId}'.`
      );
    }
  }
  return result;
}

export function enforceCaseSummaryPolicy(
  result: SummarizeCaseResult,
  context?: { hasCompletedVisit?: boolean }
): SummarizeCaseResult {
  const texts = [result.operationalSummary, result.nextStepSummary, ...result.openGaps];
  assertNoClinicalAdvice(texts);

  if (context?.hasCompletedVisit === false) {
    for (const text of texts) {
      for (const pattern of COMPLETION_CLAIM_PATTERNS) {
        if (pattern.test(text)) {
          throw new AIPolicyViolationError(
            "AI summary cannot claim care/visit completion when verified visit completion does not exist."
          );
        }
      }
    }
  }

  return result;
}

/**
 * Policy guard for the CareLoop Case Orchestrator:
 * The orchestrator proposes the next executable step + tool; the system
 * guarantees clinical safety, policy check enforcement, consent boundaries,
 * verified slot integrity, verified visit integrity, and human accountability
 * driven directly from CARE_LOOP_TOOL_REGISTRY.
 */
export function enforceOrchestratorDecisionPolicy(
  decision: CaseOrchestratorDecision,
  context?: {
    riskTier?: string;
    consentOutreach?: boolean;
    hasVerifiedCompletion?: boolean;
    verifiedAvailableSlotsCount?: number;
    humanApproved?: boolean;
  }
): CaseOrchestratorDecision {
  if (decision.proposed_next_state !== undefined) {
    validateAgentProposedTransition(decision.current_state, decision.proposed_next_state);
  }

  assertCareLoopPolicyAllowed({
    action: decision.tool,
    caseState: decision.current_state,
    riskTier: context?.riskTier,
    consentOutreach: context?.consentOutreach,
    hasVerifiedCompletion: context?.hasVerifiedCompletion,
    verifiedAvailableSlotsCount: context?.verifiedAvailableSlotsCount,
    humanApproved: context?.humanApproved ?? decision.requires_human,
    policyCheckRequired: decision.policy_check_required,
    textPayloads: [
      decision.goal,
      decision.recommended_action,
      decision.reason,
      decision.expected_outcome,
      decision.fallback_action,
    ],
  });

  return decision;
}
