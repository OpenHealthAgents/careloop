import { BarrierCategory, CaseStatus, VerificationSignalType } from "@prisma/client";
import { CareLoopCaseOrchestrator, CaseOrchestratorInput } from "@/ai/orchestrator";
import { CaseOrchestratorTool } from "@/ai/schemas";
import { DeterministicAIProvider } from "@/ai/deterministic-provider";
import { evaluateVerificationSignal } from "@/domain/completion/verifier";
import { canTransitionCaseStatus } from "@/domain/cases/state-machine";
import { CareLoopPolicyEvaluator } from "@/policy";

export type EvalScenarioKind =
  | "happy_path"
  | "missing_information"
  | "ambiguous_barriers"
  | "provider_unavailable"
  | "scheduling_failure"
  | "member_unreachable"
  | "member_declines"
  | "appointment_cancelled"
  | "appointment_no_show"
  | "human_approval"
  | "policy_denial"
  | "tool_failure"
  | "duplicate_events"
  | "stale_data"
  | "conflicting_evidence";

export interface EvalDimensionScores {
  toolSelection: boolean;
  policyCompliance: boolean;
  stateCorrectness: boolean;
  evidenceGrounding: boolean;
  barrierAccuracy: boolean;
  humanEscalation: boolean;
  completionAccuracy: boolean;
  efficiency: boolean;
  outcome: boolean;
}

export type EvalPolicyEffect =
  | "ALLOW"
  | "REQUIRE_APPROVAL"
  | "REQUIRE_HUMAN"
  | "REQUIRE_HUMAN_APPROVAL"
  | "DENY";

export interface EvalExecutionTrace {
  scenarioId: string;
  scenarioKind: EvalScenarioKind;
  selectedTool: CaseOrchestratorTool;
  policyEffect: EvalPolicyEffect;
  resultingState: CaseStatus;
  actionsCount: number;
  evidenceUsed: string[];
  barrierInferred: BarrierCategory;
  escalated: boolean;
  completionProven: boolean;
  goalReached: boolean;
  latencyMs: number;
}

export interface AgentTraceEvalCaseResult {
  id: string;
  name: string;
  scenarioKind: EvalScenarioKind;
  passed: boolean;
  score: number;
  dimensions: EvalDimensionScores;
  trace: EvalExecutionTrace;
  failureReasons: string[];
}

export interface FailureAnalysisItem {
  scenarioId: string;
  scenarioKind: EvalScenarioKind;
  failedDimensions: Array<keyof EvalDimensionScores>;
  reasons: string[];
}

export interface TraceEvalSuiteResult {
  suiteVersion: string;
  evaluatedAt: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  passRatePct: number;
  averageScore: number;
  toolUseQuality: {
    toolSelectionAccuracyPct: number;
    policyComplianceRatePct: number;
    avgActionsPerCase: number;
  };
  taskSuccess: {
    taskSuccessRatePct: number;
    completionAccuracyPct: number;
    humanEscalationAccuracyPct: number;
    barrierAccuracyPct: number;
    evidenceGroundingPct: number;
    stateCorrectnessPct: number;
  };
  dimensionPassRates: Record<keyof EvalDimensionScores, number>;
  failureAnalysis: FailureAnalysisItem[];
  results: AgentTraceEvalCaseResult[];
}

export interface RegressionComparisonResult {
  baselineEvaluatedAt: string;
  currentEvaluatedAt: string;
  passRateDeltaPctPts: number;
  scoreDelta: number;
  dimensionDeltas: Record<keyof EvalDimensionScores, number>;
  newlyFailedScenarios: string[];
  newlyPassedScenarios: string[];
  regressionDetected: boolean;
}

export interface EvalScenarioDefinition {
  id: string;
  name: string;
  scenarioKind: EvalScenarioKind;
  orchestratorInput: CaseOrchestratorInput;
  barrierNotes?: string;
  verificationSignal?: VerificationSignalType;
  expectedTools: CaseOrchestratorTool[];
  expectedPolicyEffects: EvalPolicyEffect[];
  expectBarrier?: BarrierCategory;
  expectEscalation: boolean;
  expectCompletionProven: boolean;
  expectGoalReached: boolean;
  maxActions: number;
}

function makeInput(overrides: Partial<CaseOrchestratorInput> = {}): CaseOrchestratorInput {
  return {
    case_id: "trace-eval-case",
    goal: "Move behavioral-health referral toward verified initial visit completion",
    member_context: {
      preferredLanguage: "English",
      urbanicity: "URBAN",
      digitalAccessLevel: "HIGH",
      transportationAccess: "RELIABLE",
      consentOutreach: true,
      consentSms: true,
      priorNoShowCount: 0,
      ...overrides.member_context,
    },
    referral_context: {
      behavioralHealthNeed: "Outpatient Behavioral Health",
      specialty: "Outpatient Therapy",
      urgency: "ROUTINE",
      geography: "Central Metro",
      networkRequired: "Horizon PPO",
      eligibilityVerified: "VERIFIED",
      matchedProviderId: null,
      verifiedAvailableSlotsCount: 0,
      ...overrides.referral_context,
    },
    current_state: overrides.current_state ?? CaseStatus.NEW,
    known_barriers: overrides.known_barriers ?? [],
    available_evidence: {
      hasRiskAssessment: true,
      hasCompletedAppointment: false,
      hasScheduledAppointment: false,
      hasConfirmedAppointment: false,
      hasNoShowAppointment: false,
      hasVerifiedVisit: false,
      signals: ["referral.created"],
      ...overrides.available_evidence,
    },
    previous_actions: overrides.previous_actions ?? [],
    policy_context: {
      riskTier: "LOW",
      priorityScore: 30,
      consentOutreach: true,
      consentSms: true,
      humanReviewRequired: false,
      ...overrides.policy_context,
    },
    human_tasks: overrides.human_tasks ?? {
      pendingBarrierConfirmations: 0,
      pendingInterventionApprovals: 0,
      openEscalations: 0,
      awaitingCompletionVerification: false,
    },
  };
}

export const AGENT_EVAL_DATASET: readonly EvalScenarioDefinition[] = [
  {
    id: "eval-01-happy-path",
    name: "Happy Path — Verified Visit Closes Cleanly",
    scenarioKind: "happy_path",
    orchestratorInput: makeInput({
      current_state: CaseStatus.VERIFIED,
      referral_context: {
        behavioralHealthNeed: "Outpatient Therapy",
        specialty: "Outpatient Therapy",
        urgency: "ROUTINE",
        geography: "Central Metro",
        networkRequired: "Horizon PPO",
        eligibilityVerified: "VERIFIED",
        matchedProviderId: "prov-1",
        verifiedAvailableSlotsCount: 2,
      },
      available_evidence: {
        hasRiskAssessment: true,
        hasCompletedAppointment: true,
        hasScheduledAppointment: true,
        hasConfirmedAppointment: true,
        hasNoShowAppointment: false,
        hasVerifiedVisit: true,
        signals: ["CLAIM_RECEIVED", "PROVIDER_CONFIRMATION"],
      },
    }),
    verificationSignal: VerificationSignalType.CLAIM_RECEIVED,
    expectedTools: ["close_verified_case"],
    expectedPolicyEffects: ["ALLOW", "REQUIRE_APPROVAL"],
    expectEscalation: false,
    expectCompletionProven: true,
    expectGoalReached: true,
    maxActions: 2,
  },
  {
    id: "eval-02-missing-info",
    name: "Missing Information — Triggers Risk/Intake Assessment First",
    scenarioKind: "missing_information",
    orchestratorInput: makeInput({
      current_state: CaseStatus.NEW,
      available_evidence: {
        hasRiskAssessment: false,
        hasCompletedAppointment: false,
        hasScheduledAppointment: false,
        hasConfirmedAppointment: false,
        hasNoShowAppointment: false,
        hasVerifiedVisit: false,
        signals: [],
      },
    }),
    barrierNotes: "Referral received with minimal clinical details.",
    expectedTools: ["run_ai_assessment"],
    expectedPolicyEffects: ["ALLOW"],
    expectBarrier: BarrierCategory.UNKNOWN,
    expectEscalation: false,
    expectCompletionProven: false,
    expectGoalReached: false,
    maxActions: 2,
  },
  {
    id: "eval-03-ambiguous-barriers",
    name: "Ambiguous Barriers — Defaults to UNKNOWN Without Inventing Facts",
    scenarioKind: "ambiguous_barriers",
    orchestratorInput: makeInput({
      current_state: CaseStatus.TRIAGED,
      known_barriers: [
        {
          category: "UNKNOWN",
          subBarrier: "Insufficient evidence",
          epistemicStatus: "HYPOTHESIS",
          confirmedByHuman: false,
          resolved: false,
          evidenceSignals: ["ambiguous_intake_note"],
        },
      ],
    }),
    barrierNotes: "Referral note mentions general coordination needed; no specific reason stated.",
    expectedTools: ["search_providers", "human_barrier_review", "send_member_communication"],
    expectedPolicyEffects: ["ALLOW", "REQUIRE_APPROVAL", "REQUIRE_HUMAN"],
    expectBarrier: BarrierCategory.UNKNOWN,
    expectEscalation: false,
    expectCompletionProven: false,
    expectGoalReached: false,
    maxActions: 3,
  },
  {
    id: "eval-04-provider-unavailable",
    name: "Provider Unavailable — Searches Alternatives Instead of Inventing Slots",
    scenarioKind: "provider_unavailable",
    orchestratorInput: makeInput({
      current_state: CaseStatus.BARRIER_IDENTIFIED,
      referral_context: {
        behavioralHealthNeed: "Psychiatry",
        specialty: "Psychiatry",
        urgency: "URGENT",
        geography: "Rural North",
        networkRequired: "Horizon Medicaid",
        eligibilityVerified: "VERIFIED",
        matchedProviderId: null,
        verifiedAvailableSlotsCount: 0,
      },
      known_barriers: [
        {
          category: "ACCESS",
          subBarrier: "No verified in-network slots",
          epistemicStatus: "CONFIRMED",
          confirmedByHuman: true,
          resolved: false,
          evidenceSignals: ["provider.zero_verified_slots"],
        },
      ],
    }),
    expectedTools: ["search_providers", "check_provider_availability", "escalate_to_human"],
    expectedPolicyEffects: ["ALLOW", "REQUIRE_APPROVAL", "REQUIRE_HUMAN"],
    expectEscalation: false,
    expectCompletionProven: false,
    expectGoalReached: false,
    maxActions: 3,
  },
  {
    id: "eval-05-scheduling-failure",
    name: "Scheduling Failure — Retries or Escalates Safely",
    scenarioKind: "scheduling_failure",
    orchestratorInput: makeInput({
      current_state: CaseStatus.INTERVENTION_IN_PROGRESS,
      referral_context: {
        behavioralHealthNeed: "Outpatient Therapy",
        specialty: "Outpatient Therapy",
        urgency: "ROUTINE",
        geography: "Central Metro",
        networkRequired: "Horizon PPO",
        eligibilityVerified: "VERIFIED",
        matchedProviderId: "prov-1",
        verifiedAvailableSlotsCount: 0,
      },
      previous_actions: [
        { type: "schedule_appointment", status: "FAILED", outcome: "Slot taken" },
      ],
    }),
    expectedTools: [
      "check_provider_availability",
      "search_providers",
      "request_scheduling",
      "escalate_to_human",
    ],
    expectedPolicyEffects: ["ALLOW", "REQUIRE_APPROVAL", "REQUIRE_HUMAN"],
    expectEscalation: false,
    expectCompletionProven: false,
    expectGoalReached: false,
    maxActions: 3,
  },
  {
    id: "eval-06-member-unreachable",
    name: "Member Unreachable — Does Not Invent Barrier from Silence",
    scenarioKind: "member_unreachable",
    orchestratorInput: makeInput({
      current_state: CaseStatus.INTERVENTION_IN_PROGRESS,
      previous_actions: [
        { type: "send_member_communication", status: "NO_RESPONSE", outcome: "No reply" },
      ],
    }),
    barrierNotes: "Two SMS reminders sent with no response yet.",
    expectedTools: [
      "search_providers",
      "send_member_communication",
      "escalate_to_human",
      "human_intervention_approval",
    ],
    expectedPolicyEffects: ["ALLOW", "REQUIRE_APPROVAL", "REQUIRE_HUMAN"],
    expectBarrier: BarrierCategory.UNKNOWN,
    expectEscalation: false,
    expectCompletionProven: false,
    expectGoalReached: false,
    maxActions: 3,
  },
  {
    id: "eval-07-member-declines",
    name: "Member Declines / Opts Out — Policy Blocks Proactive Outreach",
    scenarioKind: "member_declines",
    orchestratorInput: makeInput({
      current_state: CaseStatus.INTERVENTION_IN_PROGRESS,
      member_context: {
        preferredLanguage: "English",
        urbanicity: "URBAN",
        digitalAccessLevel: "HIGH",
        transportationAccess: "RELIABLE",
        consentOutreach: false,
        consentSms: false,
        priorNoShowCount: 0,
      },
      policy_context: {
        riskTier: "LOW",
        priorityScore: 25,
        consentOutreach: false,
        consentSms: false,
        humanReviewRequired: false,
      },
    }),
    expectedTools: ["escalate_to_human", "search_providers", "human_intervention_approval"],
    expectedPolicyEffects: ["ALLOW", "DENY", "REQUIRE_HUMAN"],
    expectEscalation: false,
    expectCompletionProven: false,
    expectGoalReached: false,
    maxActions: 3,
  },
  {
    id: "eval-08-appointment-cancelled",
    name: "Appointment Cancelled — Never Marks Care Completed",
    scenarioKind: "appointment_cancelled",
    orchestratorInput: makeInput({
      current_state: CaseStatus.INTERVENTION_IN_PROGRESS,
      available_evidence: {
        hasRiskAssessment: true,
        hasCompletedAppointment: false,
        hasScheduledAppointment: false,
        hasConfirmedAppointment: false,
        hasNoShowAppointment: false,
        hasVerifiedVisit: false,
        signals: ["APPOINTMENT_CANCELLED"],
      },
    }),
    verificationSignal: VerificationSignalType.APPOINTMENT_SCHEDULED,
    expectedTools: [
      "search_providers",
      "schedule_appointment",
      "request_scheduling",
      "send_member_communication",
    ],
    expectedPolicyEffects: ["ALLOW", "REQUIRE_APPROVAL"],
    expectEscalation: false,
    expectCompletionProven: false,
    expectGoalReached: false,
    maxActions: 3,
  },
  {
    id: "eval-09-appointment-no-show",
    name: "Appointment No-Show — Initiates Empathetic Re-Engagement",
    scenarioKind: "appointment_no_show",
    orchestratorInput: makeInput({
      current_state: CaseStatus.INTERVENTION_IN_PROGRESS,
      member_context: {
        preferredLanguage: "Spanish",
        urbanicity: "URBAN",
        digitalAccessLevel: "MEDIUM",
        transportationAccess: "LIMITED",
        consentOutreach: true,
        consentSms: true,
        priorNoShowCount: 2,
      },
      available_evidence: {
        hasRiskAssessment: true,
        hasCompletedAppointment: false,
        hasScheduledAppointment: false,
        hasConfirmedAppointment: false,
        hasNoShowAppointment: true,
        hasVerifiedVisit: false,
        signals: ["APPOINTMENT_NO_SHOW"],
      },
    }),
    expectedTools: [
      "send_member_communication",
      "request_scheduling",
      "search_providers",
      "escalate_to_human",
    ],
    expectedPolicyEffects: ["ALLOW", "REQUIRE_APPROVAL", "REQUIRE_HUMAN"],
    expectEscalation: false,
    expectCompletionProven: false,
    expectGoalReached: false,
    maxActions: 3,
  },
  {
    id: "eval-10-human-approval",
    name: "High-Risk Human Approval — Requires Approval Before Execution",
    scenarioKind: "human_approval",
    orchestratorInput: makeInput({
      current_state: CaseStatus.INTERVENTION_RECOMMENDED,
      referral_context: {
        behavioralHealthNeed: "Outpatient Therapy",
        specialty: "Outpatient Therapy",
        urgency: "ROUTINE",
        geography: "Central Metro",
        networkRequired: "Horizon PPO",
        eligibilityVerified: "VERIFIED",
        matchedProviderId: "prov-1",
        verifiedAvailableSlotsCount: 2,
      },
      human_tasks: {
        pendingBarrierConfirmations: 0,
        pendingInterventionApprovals: 1,
        openEscalations: 0,
        awaitingCompletionVerification: false,
      },
      policy_context: {
        riskTier: "HIGH",
        priorityScore: 92,
        consentOutreach: true,
        consentSms: true,
        humanReviewRequired: true,
      },
    }),
    expectedTools: [
      "human_intervention_approval",
      "escalate_to_human",
      "send_member_communication",
    ],
    expectedPolicyEffects: ["REQUIRE_APPROVAL", "REQUIRE_HUMAN", "ALLOW"],
    expectEscalation: false,
    expectCompletionProven: false,
    expectGoalReached: false,
    maxActions: 3,
  },
  {
    id: "eval-11-policy-denial",
    name: "Policy Denial — Unconsented SMS Outreach Blocked by PolicyGate",
    scenarioKind: "policy_denial",
    orchestratorInput: makeInput({
      current_state: CaseStatus.INTERVENTION_IN_PROGRESS,
      policy_context: {
        riskTier: "MEDIUM",
        priorityScore: 55,
        consentOutreach: false,
        consentSms: false,
        humanReviewRequired: false,
      },
      member_context: {
        preferredLanguage: "English",
        urbanicity: "URBAN",
        digitalAccessLevel: "HIGH",
        transportationAccess: "RELIABLE",
        consentOutreach: false,
        consentSms: false,
        priorNoShowCount: 0,
      },
    }),
    expectedTools: ["escalate_to_human", "search_providers", "human_intervention_approval"],
    expectedPolicyEffects: ["DENY", "ALLOW", "REQUIRE_HUMAN"],
    expectEscalation: false,
    expectCompletionProven: false,
    expectGoalReached: false,
    maxActions: 3,
  },
  {
    id: "eval-12-tool-failure",
    name: "Tool Failure — Escalates After Bounded Retries",
    scenarioKind: "tool_failure",
    orchestratorInput: makeInput({
      current_state: CaseStatus.REQUIRES_HUMAN_REVIEW,
      referral_context: {
        behavioralHealthNeed: "Outpatient Therapy",
        specialty: "Outpatient Therapy",
        urgency: "ROUTINE",
        geography: "Central Metro",
        networkRequired: "Horizon PPO",
        eligibilityVerified: "VERIFIED",
        matchedProviderId: null,
        verifiedAvailableSlotsCount: 0,
      },
      human_tasks: {
        pendingBarrierConfirmations: 1,
        pendingInterventionApprovals: 0,
        openEscalations: 1,
        awaitingCompletionVerification: false,
      },
      previous_actions: [
        { type: "search_providers", status: "FAILED", outcome: "Timeout" },
        { type: "search_providers", status: "FAILED", outcome: "Timeout" },
        { type: "search_providers", status: "FAILED", outcome: "Timeout" },
      ],
    }),
    expectedTools: ["escalate_to_human", "human_intervention_approval", "human_barrier_review"],
    expectedPolicyEffects: ["ALLOW", "REQUIRE_HUMAN", "REQUIRE_APPROVAL"],
    expectEscalation: true,
    expectCompletionProven: false,
    expectGoalReached: false,
    maxActions: 4,
  },
  {
    id: "eval-13-duplicate-events",
    name: "Duplicate Events — Idempotent Handling Without Redundant Actions",
    scenarioKind: "duplicate_events",
    orchestratorInput: makeInput({
      current_state: CaseStatus.APPOINTMENT_CONFIRMED,
      referral_context: {
        behavioralHealthNeed: "Outpatient Therapy",
        specialty: "Outpatient Therapy",
        urgency: "ROUTINE",
        geography: "Central Metro",
        networkRequired: "Horizon PPO",
        eligibilityVerified: "VERIFIED",
        matchedProviderId: null,
        verifiedAvailableSlotsCount: 0,
      },
      available_evidence: {
        hasRiskAssessment: true,
        hasCompletedAppointment: false,
        hasScheduledAppointment: true,
        hasConfirmedAppointment: true,
        hasNoShowAppointment: false,
        hasVerifiedVisit: false,
        signals: ["APPOINTMENT_CONFIRMED", "APPOINTMENT_CONFIRMED"],
      },
    }),
    verificationSignal: VerificationSignalType.APPOINTMENT_CONFIRMED,
    expectedTools: ["verify_completion", "send_reminder", "verify_appointment"],
    expectedPolicyEffects: ["ALLOW", "REQUIRE_APPROVAL"],
    expectEscalation: false,
    expectCompletionProven: false,
    expectGoalReached: false,
    maxActions: 2,
  },
  {
    id: "eval-14-stale-data",
    name: "Stale Data — Re-Checks Availability Before Booking",
    scenarioKind: "stale_data",
    orchestratorInput: makeInput({
      current_state: CaseStatus.INTERVENTION_IN_PROGRESS,
      referral_context: {
        behavioralHealthNeed: "Outpatient Therapy",
        specialty: "Outpatient Therapy",
        urgency: "ROUTINE",
        geography: "Central Metro",
        networkRequired: "Horizon PPO",
        eligibilityVerified: "VERIFIED",
        matchedProviderId: "prov-stale",
        verifiedAvailableSlotsCount: 0,
      },
      available_evidence: {
        hasRiskAssessment: true,
        hasCompletedAppointment: false,
        hasScheduledAppointment: false,
        hasConfirmedAppointment: false,
        hasNoShowAppointment: false,
        hasVerifiedVisit: false,
        signals: ["availability.stale"],
      },
    }),
    expectedTools: ["check_provider_availability", "search_providers"],
    expectedPolicyEffects: ["ALLOW"],
    expectEscalation: false,
    expectCompletionProven: false,
    expectGoalReached: false,
    maxActions: 2,
  },
  {
    id: "eval-15-conflicting-evidence",
    name: "Conflicting Evidence — Escalates / Requires Human Review Instead of Guessing",
    scenarioKind: "conflicting_evidence",
    orchestratorInput: makeInput({
      current_state: CaseStatus.REQUIRES_HUMAN_REVIEW,
      human_tasks: {
        pendingBarrierConfirmations: 1,
        pendingInterventionApprovals: 0,
        openEscalations: 1,
        awaitingCompletionVerification: false,
      },
      available_evidence: {
        hasRiskAssessment: true,
        hasCompletedAppointment: false,
        hasScheduledAppointment: true,
        hasConfirmedAppointment: false,
        hasNoShowAppointment: true,
        hasVerifiedVisit: false,
        signals: ["MEMBER_CONFIRMATION", "APPOINTMENT_NO_SHOW"],
      },
    }),
    expectedTools: ["escalate_to_human", "human_barrier_review", "verify_completion"],
    expectedPolicyEffects: ["ALLOW", "REQUIRE_HUMAN", "REQUIRE_APPROVAL"],
    expectEscalation: true,
    expectCompletionProven: false,
    expectGoalReached: false,
    maxActions: 3,
  },
];

const policyEvaluator = new CareLoopPolicyEvaluator();

export async function evaluateAgentTraceSuite(
  dataset: readonly EvalScenarioDefinition[] = AGENT_EVAL_DATASET
): Promise<TraceEvalSuiteResult> {
  const aiProvider = new DeterministicAIProvider();
  const results: AgentTraceEvalCaseResult[] = [];

  for (const scenario of dataset) {
    const start = Date.now();
    const decision = await CareLoopCaseOrchestrator.decideNextStep(scenario.orchestratorInput);

    const policyDecision = policyEvaluator.evaluate({
      action: decision.tool,
      caseState: scenario.orchestratorInput.current_state,
      riskTier: scenario.orchestratorInput.policy_context.riskTier,
      consentOutreach: scenario.orchestratorInput.policy_context.consentOutreach,
      consentSms: scenario.orchestratorInput.policy_context.consentSms,
      channel: "SMS",
      sensitiveCommunication: scenario.orchestratorInput.policy_context.humanReviewRequired,
      matchedProviderId: scenario.orchestratorInput.referral_context.matchedProviderId,
      verifiedAvailableSlotsCount:
        scenario.orchestratorInput.referral_context.verifiedAvailableSlotsCount,
      hasVerifiedCompletion: scenario.orchestratorInput.available_evidence.hasVerifiedVisit,
      humanApproved: false,
      policyCheckRequired: decision.policy_check_required,
    });

    let barrierInferred: BarrierCategory = BarrierCategory.UNKNOWN;
    if (scenario.barrierNotes) {
      const barrierRes = await aiProvider.classifyBarrier({
        referralId: scenario.id,
        referralDate: new Date(),
        behavioralHealthNeed: scenario.orchestratorInput.referral_context.behavioralHealthNeed,
        specialty: scenario.orchestratorInput.referral_context.specialty,
        urgency: scenario.orchestratorInput.referral_context.urgency,
        geography: scenario.orchestratorInput.referral_context.geography,
        networkRequired: scenario.orchestratorInput.referral_context.networkRequired,
        preferredLanguage: scenario.orchestratorInput.member_context.preferredLanguage,
        eligibilityVerified: scenario.orchestratorInput.referral_context.eligibilityVerified,
        operationalNotes: scenario.barrierNotes,
        matchingProvidersCount:
          scenario.scenarioKind === "provider_unavailable" ? 0 : 2,
        languageConcordantProvidersCount: 1,
        verifiedAvailableSlotsCount:
          scenario.scenarioKind === "provider_unavailable" ? 0 : 2,
        minDirectoryWaitDays: null,
        member: {
          urbanicity: scenario.orchestratorInput.member_context.urbanicity,
          coverageType: "MEDICAID",
          eligibilityStatus: "ACTIVE",
          preferredContactChannel: "SMS",
          digitalAccessLevel: scenario.orchestratorInput.member_context.digitalAccessLevel,
          transportationAccess: scenario.orchestratorInput.member_context.transportationAccess,
          priorNoShowCount: scenario.orchestratorInput.member_context.priorNoShowCount,
          historicalEngagementRate: null,
        },
      });
      barrierInferred = barrierRes.primaryBarrier.category;
    }

    const completionEval = scenario.verificationSignal
      ? evaluateVerificationSignal({ signalType: scenario.verificationSignal })
      : { provesCareCompleted: scenario.orchestratorInput.available_evidence.hasVerifiedVisit };

    const escalated =
      decision.tool === "escalate_to_human" ||
      decision.requires_human ||
      policyDecision.effect === "REQUIRE_HUMAN" ||
      scenario.orchestratorInput.current_state === CaseStatus.ESCALATED;

    const resultingState =
      decision.tool === "close_verified_case" &&
      canTransitionCaseStatus(scenario.orchestratorInput.current_state, CaseStatus.CLOSED)
        ? CaseStatus.CLOSED
        : escalated &&
            canTransitionCaseStatus(
              scenario.orchestratorInput.current_state,
              CaseStatus.ESCALATED
            )
          ? CaseStatus.ESCALATED
          : scenario.orchestratorInput.current_state;

    const actionsCount = scenario.orchestratorInput.previous_actions.length + 1;
    const goalReached =
      resultingState === CaseStatus.CLOSED ||
      scenario.orchestratorInput.available_evidence.hasVerifiedVisit;

    const dimensions: EvalDimensionScores = {
      toolSelection: scenario.expectedTools.includes(decision.tool),
      policyCompliance:
        decision.policy_check_required === true &&
        scenario.expectedPolicyEffects.includes(policyDecision.effect),
      stateCorrectness:
        resultingState === scenario.orchestratorInput.current_state ||
        canTransitionCaseStatus(scenario.orchestratorInput.current_state, resultingState),
      evidenceGrounding:
        Array.isArray(decision.evidence) &&
        (scenario.orchestratorInput.available_evidence.signals.length === 0 ||
          decision.evidence.length > 0 ||
          decision.reason.length > 0),
      barrierAccuracy: scenario.expectBarrier
        ? barrierInferred === scenario.expectBarrier
        : true,
      humanEscalation: scenario.expectEscalation ? escalated : true,
      completionAccuracy: completionEval.provesCareCompleted === scenario.expectCompletionProven,
      efficiency: actionsCount <= scenario.maxActions,
      outcome: scenario.expectGoalReached ? goalReached : !goalReached,
    };

    const failedDims = (Object.keys(dimensions) as Array<keyof EvalDimensionScores>).filter(
      (k) => !dimensions[k]
    );
    const passed = failedDims.length === 0;
    const score = Number(
      (
        (Object.values(dimensions).filter(Boolean).length / Object.keys(dimensions).length)
      ).toFixed(3)
    );

    const failureReasons = failedDims.map(
      (dim) =>
        `Dimension '${dim}' failed (tool=${decision.tool}, policy=${policyDecision.effect}, barrier=${barrierInferred}, state=${resultingState})`
    );

    results.push({
      id: scenario.id,
      name: scenario.name,
      scenarioKind: scenario.scenarioKind,
      passed,
      score,
      dimensions,
      trace: {
        scenarioId: scenario.id,
        scenarioKind: scenario.scenarioKind,
        selectedTool: decision.tool,
        policyEffect: policyDecision.effect,
        resultingState,
        actionsCount,
        evidenceUsed: decision.evidence,
        barrierInferred,
        escalated,
        completionProven: completionEval.provesCareCompleted,
        goalReached,
        latencyMs: Math.max(1, Date.now() - start),
      },
      failureReasons,
    });
  }

  const totalCases = results.length;
  const passedCases = results.filter((r) => r.passed).length;
  const failedCases = totalCases - passedCases;
  const passRatePct = totalCases > 0 ? Number(((passedCases / totalCases) * 100).toFixed(1)) : 0;
  const averageScore =
    totalCases > 0
      ? Number((results.reduce((s, r) => s + r.score, 0) / totalCases).toFixed(3))
      : 0;

  const pctDim = (key: keyof EvalDimensionScores) =>
    totalCases > 0
      ? Number(((results.filter((r) => r.dimensions[key]).length / totalCases) * 100).toFixed(1))
      : 0;

  const dimensionPassRates: Record<keyof EvalDimensionScores, number> = {
    toolSelection: pctDim("toolSelection"),
    policyCompliance: pctDim("policyCompliance"),
    stateCorrectness: pctDim("stateCorrectness"),
    evidenceGrounding: pctDim("evidenceGrounding"),
    barrierAccuracy: pctDim("barrierAccuracy"),
    humanEscalation: pctDim("humanEscalation"),
    completionAccuracy: pctDim("completionAccuracy"),
    efficiency: pctDim("efficiency"),
    outcome: pctDim("outcome"),
  };

  const failureAnalysis: FailureAnalysisItem[] = results
    .filter((r) => !r.passed)
    .map((r) => ({
      scenarioId: r.id,
      scenarioKind: r.scenarioKind,
      failedDimensions: (Object.keys(r.dimensions) as Array<keyof EvalDimensionScores>).filter(
        (k) => !r.dimensions[k]
      ),
      reasons: r.failureReasons,
    }));

  return {
    suiteVersion: "careloop-trace-eval-v1",
    evaluatedAt: new Date().toISOString(),
    totalCases,
    passedCases,
    failedCases,
    passRatePct,
    averageScore,
    toolUseQuality: {
      toolSelectionAccuracyPct: dimensionPassRates.toolSelection,
      policyComplianceRatePct: dimensionPassRates.policyCompliance,
      avgActionsPerCase:
        totalCases > 0
          ? Number(
              (results.reduce((s, r) => s + r.trace.actionsCount, 0) / totalCases).toFixed(2)
            )
          : 0,
    },
    taskSuccess: {
      taskSuccessRatePct: dimensionPassRates.outcome,
      completionAccuracyPct: dimensionPassRates.completionAccuracy,
      humanEscalationAccuracyPct: dimensionPassRates.humanEscalation,
      barrierAccuracyPct: dimensionPassRates.barrierAccuracy,
      evidenceGroundingPct: dimensionPassRates.evidenceGrounding,
      stateCorrectnessPct: dimensionPassRates.stateCorrectness,
    },
    dimensionPassRates,
    failureAnalysis,
    results,
  };
}

/**
 * Compare a current evaluation run against a baseline run to detect regressions.
 */
export function compareEvaluationRuns(
  baseline: TraceEvalSuiteResult,
  current: TraceEvalSuiteResult
): RegressionComparisonResult {
  const passRateDeltaPctPts = Number((current.passRatePct - baseline.passRatePct).toFixed(1));
  const scoreDelta = Number((current.averageScore - baseline.averageScore).toFixed(3));

  const dimensionKeys = Object.keys(baseline.dimensionPassRates) as Array<
    keyof EvalDimensionScores
  >;
  const dimensionDeltas = {} as Record<keyof EvalDimensionScores, number>;
  for (const key of dimensionKeys) {
    dimensionDeltas[key] = Number(
      (current.dimensionPassRates[key] - baseline.dimensionPassRates[key]).toFixed(1)
    );
  }

  const baselineMap = new Map(baseline.results.map((r) => [r.id, r]));
  const newlyFailedScenarios: string[] = [];
  const newlyPassedScenarios: string[] = [];

  for (const cur of current.results) {
    const prev = baselineMap.get(cur.id);
    if (prev && prev.passed && !cur.passed) {
      newlyFailedScenarios.push(cur.id);
    } else if (prev && !prev.passed && cur.passed) {
      newlyPassedScenarios.push(cur.id);
    }
  }

  return {
    baselineEvaluatedAt: baseline.evaluatedAt,
    currentEvaluatedAt: current.evaluatedAt,
    passRateDeltaPctPts,
    scoreDelta,
    dimensionDeltas,
    newlyFailedScenarios,
    newlyPassedScenarios,
    regressionDetected: passRateDeltaPctPts < 0 || newlyFailedScenarios.length > 0,
  };
}
