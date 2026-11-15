import {
  BarrierCategory,
  InterventionExecutionMode,
  InterventionType,
  RiskLevel,
} from "@prisma/client";
import {
  BARRIER_TO_INTERVENTION_MAP,
  INTERVENTION_CATALOG,
  SUB_BARRIER_TO_INTERVENTION_MAP,
} from "./catalog";

export interface InterventionEngineInput {
  caseId: string;
  primaryBarrierCategory: BarrierCategory;
  primaryBarrierCode: string;
  riskTier: RiskLevel | string;
  preferredLanguage: string;
  digitalAccessLevel: string;
  transportationAccess: string;
  consentSms: boolean;
  verifiedAvailableSlotsCount: number;
  languageConcordantProvidersCount: number;
  priorNoShowCount?: number;
  eligibilityVerified?: string;
}

export interface InterventionRecommendationSpec {
  barrier: {
    category: BarrierCategory;
    code: string;
    label: string;
  };
  intervention: {
    type: InterventionType;
    label: string;
    recommendedAction: string;
  };
  rationale: string;
  confidence: number;
  evidence: string[];
  automationEligibility: {
    eligible: boolean;
    executionMode: InterventionExecutionMode;
    reason: string;
  };
  requiredHumanInvolvement: string;
  expectedOutcome: string;
  isHighRisk: boolean;
}

function formatBarrierLabel(category: BarrierCategory, code: string): string {
  if (category === "UNKNOWN" || code === "Barrier unknown") {
    return "Barrier unknown";
  }
  return `${category.replaceAll("_", " ")} (${code})`;
}

export function resolveExecutionClassification(params: {
  type: InterventionType;
  riskTier: string;
}): {
  executionMode: InterventionExecutionMode;
  automationEligible: boolean;
  isHighRisk: boolean;
  automationReason: string;
  requiredHumanInvolvement: string;
} {
  const catalog = INTERVENTION_CATALOG[params.type];
  const isCaseHighRisk = params.riskTier === RiskLevel.HIGH || params.riskTier === "HIGH";
  const isHighRisk = isCaseHighRisk || catalog.isHighRiskByDefault;

  if (catalog.executionMode === "HUMAN_ONLY") {
    return {
      executionMode: InterventionExecutionMode.HUMAN_ONLY,
      automationEligible: false,
      isHighRisk,
      automationReason: "Classified HUMAN_ONLY: requires direct human judgment and member conversation.",
      requiredHumanInvolvement: catalog.requiredHumanInvolvement,
    };
  }

  if (isHighRisk) {
    // High-risk rule: never automatically execute a high-risk intervention.
    return {
      executionMode: InterventionExecutionMode.HUMAN_ASSISTED,
      automationEligible: false,
      isHighRisk: true,
      automationReason: isCaseHighRisk
        ? "High-risk case safety policy: automated execution blocked; Care Manager approval required."
        : "High-risk intervention safety policy: requires explicit Care Manager approval prior to execution.",
      requiredHumanInvolvement: catalog.requiredHumanInvolvement,
    };
  }

  if (catalog.executionMode === "AUTOMATED" && catalog.automationEligible) {
    return {
      executionMode: InterventionExecutionMode.AUTOMATED,
      automationEligible: true,
      isHighRisk: false,
      automationReason:
        "Low/medium-risk operational lookup/explanation eligible for policy-guarded automated execution.",
      requiredHumanInvolvement: catalog.requiredHumanInvolvement,
    };
  }

  return {
    executionMode: InterventionExecutionMode.HUMAN_ASSISTED,
    automationEligible: false,
    isHighRisk: false,
    automationReason:
      "Classified HUMAN_ASSISTED: Care Manager or Operations approval required before execution.",
    requiredHumanInvolvement: catalog.requiredHumanInvolvement,
  };
}

export function canAutomaticallyExecuteIntervention(params: {
  executionMode: InterventionExecutionMode;
  automationEligible: boolean;
  isHighRisk: boolean;
  caseRiskLevel: RiskLevel | string;
}): { allowed: boolean; reason: string } {
  if (params.caseRiskLevel === RiskLevel.HIGH || params.caseRiskLevel === "HIGH" || params.isHighRisk) {
    return {
      allowed: false,
      reason: "Blocked: CareLoop never automatically executes high-risk interventions.",
    };
  }
  if (params.executionMode === InterventionExecutionMode.HUMAN_ONLY) {
    return {
      allowed: false,
      reason: "Blocked: HUMAN_ONLY interventions require direct human execution.",
    };
  }
  if (params.executionMode === InterventionExecutionMode.HUMAN_ASSISTED || !params.automationEligible) {
    return {
      allowed: false,
      reason: "Blocked: HUMAN_ASSISTED interventions require explicit human approval first.",
    };
  }
  return {
    allowed: true,
    reason: "Permitted: low/medium-risk AUTOMATED operational intervention.",
  };
}

function buildContextDetails(
  type: InterventionType,
  input: InterventionEngineInput
): {
  rationale: string;
  recommendedAction: string;
  confidence: number;
  expectedOutcome: string;
} {
  const cat = INTERVENTION_CATALOG[type];

  switch (type) {
    case "ALTERNATIVE_PROVIDER_SEARCH":
      return {
        rationale:
          input.verifiedAvailableSlotsCount === 0
            ? `Primary provider access constraint (${input.primaryBarrierCode}) with 0 verified immediate slots; alternate in-network search prevents scheduling stall.`
            : `Expand in-network options to address ${input.primaryBarrierCode} with verified short-wait or telehealth slots.`,
        recommendedAction: `Find alternate in-network provider with verified availability or telehealth options matching ${input.preferredLanguage} preferences.`,
        confidence: input.verifiedAvailableSlotsCount === 0 ? 0.88 : 0.83,
        expectedOutcome:
          "Identify >= 1 in-network alternative provider with verified availability within 7 days.",
      };
    case "LANGUAGE_COMPATIBLE_PROVIDER_SEARCH":
      return {
        rationale: `Member prefers ${input.preferredLanguage} (${input.languageConcordantProvidersCount} concordant providers currently in tenant roster); language-concordant matching improves first-visit completion.`,
        recommendedAction: `Find ${input.preferredLanguage}-compatible in-network provider and check verified slots (or pair with medical interpreter support).`,
        confidence: 0.9,
        expectedOutcome: `Match member to verified ${input.preferredLanguage}-speaking behavioral-health clinician.`,
      };
    case "ASSISTED_SCHEDULING":
      return {
        rationale: `Barrier '${input.primaryBarrierCode}' (digital access: ${input.digitalAccessLevel}) creates scheduling friction best resolved by navigator-assisted booking.`,
        recommendedAction:
          "Hold verified clinic slot and execute navigator-assisted scheduling call with member.",
        confidence: 0.84,
        expectedOutcome:
          "Confirmed appointment scheduled and synced with member's preferred contact channel.",
      };
    case "TRANSPORTATION_SUPPORT":
      return {
        rationale: `Member transportation status is '${input.transportationAccess}'; transit barriers frequently cause missed initial behavioral-health visits.`,
        recommendedAction:
          "Coordinate plan NEMT / ride-share voucher for in-person visit or confirm telehealth suitability.",
        confidence: 0.89,
        expectedOutcome:
          "Verified round-trip transit benefit arranged or visit transitioned to telehealth.",
      };
    case "BENEFIT_NETWORK_EXPLANATION":
      return {
        rationale: `Administrative/financial barrier '${input.primaryBarrierCode}' can stall scheduling due to uncertainty over coverage, copay, or in-network status.`,
        recommendedAction:
          "Deliver clear in-network benefit, eligibility, and out-of-pocket cost-share explanation.",
        confidence: 0.86,
        expectedOutcome:
          "Member confirms understanding of covered in-network benefits and cost-share obligations.",
      };
    case "REFERRAL_COMPLETION_ASSISTANCE":
      return {
        rationale: `Referral shows '${input.primaryBarrierCode}' (eligibility: ${input.eligibilityVerified ?? "check required"}); missing requirements block clinic scheduling.`,
        recommendedAction:
          "Identify missing referral documentation or prior authorization requirement and resolve with referring clinic/utilization team.",
        confidence: 0.87,
        expectedOutcome:
          "All missing referral or authorization artifacts cleared for immediate appointment scheduling.",
      };
    case "MISSED_APPOINTMENT_REENGAGEMENT":
      return {
        rationale: `Prior missed visit / engagement friction (${input.priorNoShowCount ?? 1} prior no-show signal) elevates drop-off risk without empathetic follow-up.`,
        recommendedAction:
          "Conduct supportive, non-punitive missed-appointment re-engagement outreach to address blockers and rebook.",
        confidence: 0.85,
        expectedOutcome:
          "Member re-engaged with scheduling friction removed and confirmed new appointment date.",
      };
    case "HUMAN_OUTREACH":
      return {
        rationale:
          input.primaryBarrierCategory === "UNKNOWN"
            ? "Evidence is currently insufficient to confirm a specific barrier; human outreach is required without assuming causes."
            : `Communication/social complexity (${input.primaryBarrierCode}, digital access: ${input.digitalAccessLevel}) requires human conversation.`,
        recommendedAction: `Assign Care Manager for direct supportive outreach in ${input.preferredLanguage}.`,
        confidence: input.primaryBarrierCategory === "UNKNOWN" ? 0.74 : 0.82,
        expectedOutcome:
          "Clarified operational barrier directly with member and documented agreed coordination step.",
      };
    case "ESCALATION":
      return {
        rationale: `Case carries HIGH risk tier requiring senior Care Manager oversight and accountable exception handling.`,
        recommendedAction: cat.defaultAction,
        confidence: 0.8,
        expectedOutcome:
          "Senior Care Manager assumes oversight with documented mitigation timeline.",
      };
  }
}

/**
 * CareLoop deterministic Intervention Engine.
 * Maps canonical barriers + operational context into explicit, auditable recommendations.
 */
export function generateInterventionRecommendations(
  input: InterventionEngineInput
): InterventionRecommendationSpec[] {
  const mappedTypes =
    SUB_BARRIER_TO_INTERVENTION_MAP[input.primaryBarrierCode] ??
    BARRIER_TO_INTERVENTION_MAP[input.primaryBarrierCategory] ?? ["HUMAN_OUTREACH"];

  const selectedTypes: InterventionType[] = [...mappedTypes];

  // Context-aware augmentations (never fabricate clinical causes)
  if (
    input.transportationAccess === "NONE" &&
    !selectedTypes.includes("TRANSPORTATION_SUPPORT")
  ) {
    selectedTypes.push("TRANSPORTATION_SUPPORT");
  }
  if (
    input.digitalAccessLevel === "NONE" &&
    !selectedTypes.includes("ASSISTED_SCHEDULING")
  ) {
    selectedTypes.push("ASSISTED_SCHEDULING");
  }
  if (
    (input.riskTier === "HIGH" || input.riskTier === RiskLevel.HIGH) &&
    !selectedTypes.includes("ESCALATION")
  ) {
    selectedTypes.push("ESCALATION");
  }

  const baseEvidence: string[] = [
    `Barrier: ${formatBarrierLabel(input.primaryBarrierCategory, input.primaryBarrierCode)}`,
    `Risk tier: ${input.riskTier}; verified slots available: ${input.verifiedAvailableSlotsCount}`,
    `Preferred language: ${input.preferredLanguage} (concordant providers: ${input.languageConcordantProvidersCount})`,
    `Member access profile — digital: ${input.digitalAccessLevel}, transportation: ${input.transportationAccess}`,
  ];
  if (typeof input.priorNoShowCount === "number" && input.priorNoShowCount > 0) {
    baseEvidence.push(`Prior no-show count: ${input.priorNoShowCount}`);
  }
  if (input.eligibilityVerified && input.eligibilityVerified !== "VERIFIED") {
    baseEvidence.push(`Eligibility status: ${input.eligibilityVerified}`);
  }

  return selectedTypes.map((type) => {
    const cat = INTERVENTION_CATALOG[type];
    const details = buildContextDetails(type, input);
    const classification = resolveExecutionClassification({
      type,
      riskTier: String(input.riskTier),
    });

    return {
      barrier: {
        category: input.primaryBarrierCategory,
        code: input.primaryBarrierCode,
        label: formatBarrierLabel(input.primaryBarrierCategory, input.primaryBarrierCode),
      },
      intervention: {
        type,
        label: cat.label,
        recommendedAction: details.recommendedAction,
      },
      rationale: details.rationale,
      confidence: details.confidence,
      evidence: baseEvidence,
      automationEligibility: {
        eligible: classification.automationEligible,
        executionMode: classification.executionMode,
        reason: classification.automationReason,
      },
      requiredHumanInvolvement: classification.requiredHumanInvolvement,
      expectedOutcome: details.expectedOutcome,
      isHighRisk: classification.isHighRisk,
    };
  });
}
