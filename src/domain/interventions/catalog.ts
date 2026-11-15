import { BarrierCategory, InterventionExecutionMode, InterventionType } from "@prisma/client";

export interface InterventionCatalogItem {
  type: InterventionType;
  label: string;
  description: string;
  defaultAction: string;
  executionMode: InterventionExecutionMode;
  automationEligible: boolean;
  requiresHumanJudgment: boolean;
  isHighRiskByDefault: boolean;
  requiredHumanInvolvement: string;
  expectedOutcome: string;
}

export const INTERVENTION_CATALOG: Record<InterventionType, InterventionCatalogItem> = {
  ALTERNATIVE_PROVIDER_SEARCH: {
    type: "ALTERNATIVE_PROVIDER_SEARCH",
    label: "Alternative Provider Search",
    description: "Find alternate in-network providers with shorter wait times or telehealth access.",
    defaultAction: "Find alternate in-network provider with verified near-term availability or telehealth options.",
    executionMode: "AUTOMATED",
    automationEligible: true,
    requiresHumanJudgment: false,
    isHighRiskByDefault: false,
    requiredHumanInvolvement:
      "Optional Care Manager review on LOW/MEDIUM risk; mandatory Care Manager approval when case risk is HIGH.",
    expectedOutcome:
      "Shortlist of >= 1 verified in-network alternative providers ready for scheduling within 7 days.",
  },
  LANGUAGE_COMPATIBLE_PROVIDER_SEARCH: {
    type: "LANGUAGE_COMPATIBLE_PROVIDER_SEARCH",
    label: "Language-Compatible Provider Search",
    description: "Match member to a provider fluent in their preferred language or arrange interpreter support.",
    defaultAction: "Find language-compatible in-network provider and verify availability in member's preferred language.",
    executionMode: "AUTOMATED",
    automationEligible: true,
    requiresHumanJudgment: false,
    isHighRiskByDefault: false,
    requiredHumanInvolvement:
      "Optional Care Manager review on LOW/MEDIUM risk; mandatory human interpreter coordination if no concordant slot is verified.",
    expectedOutcome:
      "Matched language-concordant behavioral-health provider or confirmed interpreter-supported visit.",
  },
  ASSISTED_SCHEDULING: {
    type: "ASSISTED_SCHEDULING",
    label: "Assisted Scheduling",
    description: "Coordinate directly with the clinic and member to lock in a confirmed appointment slot.",
    defaultAction: "Hold a verified provider slot and complete navigator-assisted appointment scheduling.",
    executionMode: "HUMAN_ASSISTED",
    automationEligible: false,
    requiresHumanJudgment: true,
    isHighRiskByDefault: false,
    requiredHumanInvolvement:
      "Care Manager or Operations Navigator approval and warm three-way scheduling coordination with clinic & member.",
    expectedOutcome:
      "Confirmed appointment booked with verified slot and preferred reminder channel activated.",
  },
  TRANSPORTATION_SUPPORT: {
    type: "TRANSPORTATION_SUPPORT",
    label: "Transportation Support",
    description: "Arrange NEMT / ride-share benefit or transition to telehealth when transit is a barrier.",
    defaultAction: "Coordinate non-emergency medical transportation (NEMT) benefit or verify telehealth alternative.",
    executionMode: "HUMAN_ASSISTED",
    automationEligible: false,
    requiresHumanJudgment: true,
    isHighRiskByDefault: false,
    requiredHumanInvolvement:
      "Care Manager approval required to authorize transit benefit voucher or confirm member home telehealth readiness.",
    expectedOutcome:
      "Round-trip transit arranged or modality switched to telehealth prior to visit.",
  },
  BENEFIT_NETWORK_EXPLANATION: {
    type: "BENEFIT_NETWORK_EXPLANATION",
    label: "Benefit & Network Explanation",
    description: "Clarify copay, deductible, authorization status, and covered in-network options.",
    defaultAction: "Verify plan coverage and deliver plain-language benefit/network and cost-share explanation.",
    executionMode: "AUTOMATED",
    automationEligible: true,
    requiresHumanJudgment: false,
    isHighRiskByDefault: false,
    requiredHumanInvolvement:
      "Automated benefit summary on LOW/MEDIUM risk; Care Manager review required for HIGH-risk cases or disputed denials.",
    expectedOutcome:
      "Member understands covered in-network options and out-of-pocket obligations without cost confusion.",
  },
  REFERRAL_COMPLETION_ASSISTANCE: {
    type: "REFERRAL_COMPLETION_ASSISTANCE",
    label: "Referral Completion Assistance",
    description: "Identify and resolve missing referral forms, prior authorization, or documentation bottlenecks.",
    defaultAction: "Identify missing referral or authorization requirements and coordinate directly with referring clinic.",
    executionMode: "HUMAN_ASSISTED",
    automationEligible: false,
    requiresHumanJudgment: true,
    isHighRiskByDefault: true,
    requiredHumanInvolvement:
      "Care Manager / Operations User approval and outreach to referring provider or payer utilization team.",
    expectedOutcome:
      "All missing referral paperwork or prior authorization requirements cleared so scheduling can proceed.",
  },
  MISSED_APPOINTMENT_REENGAGEMENT: {
    type: "MISSED_APPOINTMENT_REENGAGEMENT",
    label: "Missed-Appointment Re-engagement",
    description: "Supportive, non-punitive follow-up after missed visits to uncover logistical blockers and reschedule.",
    defaultAction: "Conduct supportive re-engagement outreach to uncover missed-visit blockers and reschedule.",
    executionMode: "HUMAN_ASSISTED",
    automationEligible: false,
    requiresHumanJudgment: true,
    isHighRiskByDefault: true,
    requiredHumanInvolvement:
      "Care Manager approval and empathetic live outreach to address ambivalence or scheduling friction.",
    expectedOutcome:
      "Member re-engaged with concrete blocker mitigation and confirmed rescheduled appointment.",
  },
  HUMAN_OUTREACH: {
    type: "HUMAN_OUTREACH",
    label: "Human Care-Coordinator Outreach",
    description: "Direct phone/navigator conversation for complex social barriers, low digital access, or unknown needs.",
    defaultAction: "Assign to Care Manager for direct supportive human outreach in member's preferred language.",
    executionMode: "HUMAN_ONLY",
    automationEligible: false,
    requiresHumanJudgment: true,
    isHighRiskByDefault: true,
    requiredHumanInvolvement:
      "Dedicated live Care Manager phone/navigator outreach required; never automated.",
    expectedOutcome:
      "Clarified member barrier, trusted human connection established, and concrete next coordination step agreed.",
  },
  ESCALATION: {
    type: "ESCALATION",
    label: "Human Escalation",
    description: "Escalate ambiguous, blocked, or high-risk cases to a senior Care Manager.",
    defaultAction: "Escalate case for immediate Care Manager supervisor review and exception handling.",
    executionMode: "HUMAN_ONLY",
    automationEligible: false,
    requiresHumanJudgment: true,
    isHighRiskByDefault: true,
    requiredHumanInvolvement:
      "Senior Care Manager review, exception clearance, and documented follow-up ownership required; never automated.",
    expectedOutcome:
      "Blocked or high-risk case assigned explicit human accountability with active mitigation plan.",
  },
};

export const BARRIER_TO_INTERVENTION_MAP: Record<BarrierCategory, InterventionType[]> = {
  ACCESS: ["ALTERNATIVE_PROVIDER_SEARCH", "ASSISTED_SCHEDULING"],
  ADMINISTRATIVE: ["REFERRAL_COMPLETION_ASSISTANCE", "BENEFIT_NETWORK_EXPLANATION"],
  FINANCIAL: ["BENEFIT_NETWORK_EXPLANATION", "HUMAN_OUTREACH"],
  COMMUNICATION: ["LANGUAGE_COMPATIBLE_PROVIDER_SEARCH", "HUMAN_OUTREACH"],
  BEHAVIORAL: ["MISSED_APPOINTMENT_REENGAGEMENT", "ASSISTED_SCHEDULING"],
  SOCIAL_LOGISTICAL: ["TRANSPORTATION_SUPPORT", "ASSISTED_SCHEDULING"],
  UNKNOWN: ["HUMAN_OUTREACH", "ESCALATION"],
};

export const SUB_BARRIER_TO_INTERVENTION_MAP: Record<string, InterventionType[]> = {
  // ACCESS
  "unavailable appointments": ["ALTERNATIVE_PROVIDER_SEARCH", "ASSISTED_SCHEDULING"],
  "provider shortage": ["ALTERNATIVE_PROVIDER_SEARCH", "ASSISTED_SCHEDULING"],
  "long wait time": ["ALTERNATIVE_PROVIDER_SEARCH", "ASSISTED_SCHEDULING"],
  "geographic distance": ["ALTERNATIVE_PROVIDER_SEARCH", "TRANSPORTATION_SUPPORT"],
  // COMMUNICATION
  language: ["LANGUAGE_COMPATIBLE_PROVIDER_SEARCH", "HUMAN_OUTREACH"],
  "digital access": ["HUMAN_OUTREACH", "ASSISTED_SCHEDULING"],
  "inability to understand healthcare instructions": ["HUMAN_OUTREACH", "BENEFIT_NETWORK_EXPLANATION"],
  // SOCIAL_LOGISTICAL
  transportation: ["TRANSPORTATION_SUPPORT", "ASSISTED_SCHEDULING"],
  "work schedule": ["ASSISTED_SCHEDULING", "ALTERNATIVE_PROVIDER_SEARCH"],
  "caregiving responsibilities": ["ASSISTED_SCHEDULING", "TRANSPORTATION_SUPPORT"],
  // ADMINISTRATIVE
  "incomplete referral": ["REFERRAL_COMPLETION_ASSISTANCE", "ASSISTED_SCHEDULING"],
  "authorization requirement": ["REFERRAL_COMPLETION_ASSISTANCE", "BENEFIT_NETWORK_EXPLANATION"],
  "documentation requirement": ["REFERRAL_COMPLETION_ASSISTANCE"],
  "network confusion": ["BENEFIT_NETWORK_EXPLANATION", "ALTERNATIVE_PROVIDER_SEARCH"],
  // FINANCIAL
  "copay concern": ["BENEFIT_NETWORK_EXPLANATION", "HUMAN_OUTREACH"],
  "coverage uncertainty": ["BENEFIT_NETWORK_EXPLANATION", "REFERRAL_COMPLETION_ASSISTANCE"],
  affordability: ["BENEFIT_NETWORK_EXPLANATION", "HUMAN_OUTREACH"],
  // BEHAVIORAL
  "prior missed appointments": ["MISSED_APPOINTMENT_REENGAGEMENT", "ASSISTED_SCHEDULING"],
  "low engagement": ["MISSED_APPOINTMENT_REENGAGEMENT", "HUMAN_OUTREACH"],
  "treatment uncertainty": ["HUMAN_OUTREACH", "MISSED_APPOINTMENT_REENGAGEMENT"],
  // UNKNOWN
  "Barrier unknown": ["HUMAN_OUTREACH"],
};
