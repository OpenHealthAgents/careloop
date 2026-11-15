import { BarrierCategory, InterventionType } from "@prisma/client";
import { INTERVENTION_CATALOG } from "./catalog";

export type InterventionToolName =
  | "searchProviders"
  | "requestScheduling"
  | "sendMemberMessage"
  | "sendReminder"
  | "createHumanTask"
  | "escalateCase";

export type InterventionBarrierSignal =
  | BarrierCategory
  | "SCHEDULING_FRICTION"
  | "COMMUNICATION_BARRIER"
  | "ADMINISTRATIVE_BARRIER";

export interface BarrierInterventionToolMapping {
  barrierKey: InterventionBarrierSignal;
  barrierCategory: BarrierCategory;
  interventionType: InterventionType;
  interventionLabel: string;
  tool: InterventionToolName;
  expectedOutcome: string;
  successMetric: string;
}

export const BARRIER_INTERVENTION_TOOL_MAP: Record<
  InterventionBarrierSignal,
  BarrierInterventionToolMapping
> = {
  ACCESS: {
    barrierKey: "ACCESS",
    barrierCategory: "ACCESS",
    interventionType: "ALTERNATIVE_PROVIDER_SEARCH",
    interventionLabel: "Provider Search & Alternative Access",
    tool: "searchProviders",
    expectedOutcome: INTERVENTION_CATALOG.ALTERNATIVE_PROVIDER_SEARCH.expectedOutcome,
    successMetric: "verified_provider_matched_or_expanded_supply",
  },
  SCHEDULING_FRICTION: {
    barrierKey: "SCHEDULING_FRICTION",
    barrierCategory: "ACCESS",
    interventionType: "ASSISTED_SCHEDULING",
    interventionLabel: "Scheduling Assistance",
    tool: "requestScheduling",
    expectedOutcome: INTERVENTION_CATALOG.ASSISTED_SCHEDULING.expectedOutcome,
    successMetric: "appointment_scheduled_with_verified_slot",
  },
  COMMUNICATION: {
    barrierKey: "COMMUNICATION",
    barrierCategory: "COMMUNICATION",
    interventionType: "LANGUAGE_COMPATIBLE_PROVIDER_SEARCH",
    interventionLabel: "Preferred-Language Outreach",
    tool: "sendMemberMessage",
    expectedOutcome:
      "Member receives clear, preferred-language outreach and confirms communication readiness.",
    successMetric: "member_outreach_delivered_and_acknowledged",
  },
  COMMUNICATION_BARRIER: {
    barrierKey: "COMMUNICATION_BARRIER",
    barrierCategory: "COMMUNICATION",
    interventionType: "LANGUAGE_COMPATIBLE_PROVIDER_SEARCH",
    interventionLabel: "Preferred-Language Outreach",
    tool: "sendMemberMessage",
    expectedOutcome:
      "Member receives clear, preferred-language outreach and confirms communication readiness.",
    successMetric: "member_outreach_delivered_and_acknowledged",
  },
  ADMINISTRATIVE: {
    barrierKey: "ADMINISTRATIVE",
    barrierCategory: "ADMINISTRATIVE",
    interventionType: "REFERRAL_COMPLETION_ASSISTANCE",
    interventionLabel: "Human Administrative Assistance",
    tool: "createHumanTask",
    expectedOutcome: INTERVENTION_CATALOG.REFERRAL_COMPLETION_ASSISTANCE.expectedOutcome,
    successMetric: "eligibility_or_authorization_verified",
  },
  ADMINISTRATIVE_BARRIER: {
    barrierKey: "ADMINISTRATIVE_BARRIER",
    barrierCategory: "ADMINISTRATIVE",
    interventionType: "REFERRAL_COMPLETION_ASSISTANCE",
    interventionLabel: "Human Administrative Assistance",
    tool: "createHumanTask",
    expectedOutcome: INTERVENTION_CATALOG.REFERRAL_COMPLETION_ASSISTANCE.expectedOutcome,
    successMetric: "eligibility_or_authorization_verified",
  },
  FINANCIAL: {
    barrierKey: "FINANCIAL",
    barrierCategory: "FINANCIAL",
    interventionType: "BENEFIT_NETWORK_EXPLANATION",
    interventionLabel: "Benefit & Cost-Share Clarification",
    tool: "sendMemberMessage",
    expectedOutcome: INTERVENTION_CATALOG.BENEFIT_NETWORK_EXPLANATION.expectedOutcome,
    successMetric: "member_cost_share_barrier_resolved",
  },
  BEHAVIORAL: {
    barrierKey: "BEHAVIORAL",
    barrierCategory: "BEHAVIORAL",
    interventionType: "MISSED_APPOINTMENT_REENGAGEMENT",
    interventionLabel: "Motivational Engagement & Reminder Outreach",
    tool: "sendReminder",
    expectedOutcome: INTERVENTION_CATALOG.MISSED_APPOINTMENT_REENGAGEMENT.expectedOutcome,
    successMetric: "member_reengaged_for_visit",
  },
  SOCIAL_LOGISTICAL: {
    barrierKey: "SOCIAL_LOGISTICAL",
    barrierCategory: "SOCIAL_LOGISTICAL",
    interventionType: "TRANSPORTATION_SUPPORT",
    interventionLabel: "Transportation & Logistical Coordination",
    tool: "createHumanTask",
    expectedOutcome: INTERVENTION_CATALOG.TRANSPORTATION_SUPPORT.expectedOutcome,
    successMetric: "transit_or_telehealth_accommodation_confirmed",
  },
  UNKNOWN: {
    barrierKey: "UNKNOWN",
    barrierCategory: "UNKNOWN",
    interventionType: "ESCALATION",
    interventionLabel: "Human Discovery Task",
    tool: "createHumanTask",
    expectedOutcome:
      "Care Manager gathers missing evidence to classify the barrier without fabrication.",
    successMetric: "barrier_classified_with_verified_evidence",
  },
};

export interface InterventionExperimentSpec {
  caseId: string;
  barrier: InterventionBarrierSignal;
  barrierCategory: BarrierCategory;
  subBarrier?: string;
  interventionType: InterventionType;
  interventionLabel: string;
  tool: InterventionToolName;
  expectedOutcome: string;
  successMetric: string;
  hypothesis: string;
}

export function selectInterventionForBarrier(params: {
  caseId: string;
  barrier: InterventionBarrierSignal;
  subBarrier?: string;
}): InterventionExperimentSpec {
  // If ACCESS subBarrier is specifically scheduling/wait-time friction, map to SCHEDULING_FRICTION
  let resolvedKey: InterventionBarrierSignal = params.barrier;
  if (
    params.barrier === "ACCESS" &&
    params.subBarrier &&
    /wait|unavail|schedul/i.test(params.subBarrier)
  ) {
    resolvedKey = "SCHEDULING_FRICTION";
  }

  const mapping = BARRIER_INTERVENTION_TOOL_MAP[resolvedKey] ?? BARRIER_INTERVENTION_TOOL_MAP.UNKNOWN;

  return {
    caseId: params.caseId,
    barrier: resolvedKey,
    barrierCategory: mapping.barrierCategory,
    subBarrier: params.subBarrier,
    interventionType: mapping.interventionType,
    interventionLabel: mapping.interventionLabel,
    tool: mapping.tool,
    expectedOutcome: mapping.expectedOutcome,
    successMetric: mapping.successMetric,
    hypothesis: `If we apply '${mapping.interventionLabel}' via '${mapping.tool}' for barrier '${resolvedKey}', then '${mapping.expectedOutcome}' (${mapping.successMetric}).`,
  };
}
