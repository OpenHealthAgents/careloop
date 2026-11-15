import {
  BarrierCategory,
  CaseStatus,
  RiskLevel,
  VerificationSignalType,
} from "@prisma/client";
import { CareLoopCaseOrchestrator, CaseOrchestratorInput } from "@/ai/orchestrator";
import { CaseOrchestratorDecision } from "@/ai/schemas";
import { canTransitionCaseStatus } from "@/domain/cases/state-machine";
import { evaluateVerificationSignal } from "@/domain/completion/verifier";
import { CareLoopPolicyEvaluator } from "@/policy";
import type { PolicyDecision } from "@/policy/contracts";

type CorePolicyDecisionEffect = PolicyDecision["effect"];

export const SIMULATION_SCENARIOS = [
  "provider_available",
  "provider_unavailable",
  "member_responds",
  "member_does_not_respond",
  "member_requests_different_provider",
  "scheduling_fails",
  "appointment_cancelled",
  "appointment_completed",
  "claim_arrives",
  "evidence_conflicts",
  "human_approval_required",
] as const;

export type SimulationScenarioType = (typeof SIMULATION_SCENARIOS)[number];

export type SimulationTerminalOutcome =
  | "GOAL_ACHIEVED"
  | "HUMAN_REQUIRED"
  | "BLOCKED"
  | "MEMBER_DECLINED"
  | "CASE_CLOSED"
  | "MAX_STEPS_REACHED";

export interface SyntheticMember {
  id: string;
  syntheticMrn: string;
  displayName: string;
  preferredLanguage: "en" | "es" | "zh";
  preferredChannel: "SMS" | "EMAIL" | "PORTAL";
  consentOutreach: boolean;
  consentSms: boolean;
  geography: string;
  urbanicity: "URBAN" | "SUBURBAN" | "RURAL";
  networkPlan: string;
  digitalAccessLevel: "HIGH" | "MEDIUM" | "LOW";
  transportationAccess: "RELIABLE" | "LIMITED" | "NONE";
  priorNoShowCount: number;
  isSynthetic: true;
  containsRealPhi: false;
}

export interface SyntheticReferral {
  id: string;
  memberId: string;
  specialty: string;
  behavioralHealthNeed: string;
  urgency: "ROUTINE" | "PRIORITY" | "URGENT";
  geography: string;
  networkRequired: string;
  eligibilityVerified: "VERIFIED" | "PENDING";
  createdAt: string;
}

export interface SyntheticAvailabilitySlot {
  id: string;
  providerId: string;
  startsAt: string;
  isBooked: boolean;
}

export interface SyntheticProvider {
  id: string;
  name: string;
  specialty: string;
  geography: string;
  networkPlans: string[];
  languages: Array<"en" | "es" | "zh">;
  status: "AVAILABLE" | "UNAVAILABLE";
  acceptingNewPatients: boolean;
  slots: SyntheticAvailabilitySlot[];
}

export interface SyntheticAppointment {
  id: string;
  referralId: string;
  providerId: string;
  slotId: string;
  status: "REQUESTED" | "SCHEDULED" | "CONFIRMED" | "CANCELLED" | "NO_SHOW" | "COMPLETED";
  scheduledAt: string;
}

export interface SyntheticCommunicationResponse {
  id: string;
  memberId: string;
  channel: "SMS" | "EMAIL" | "PORTAL";
  status: "SENT" | "DELIVERED" | "RESPONDED";
  responseType:
    | "CONFIRMS"
    | "NO_RESPONSE"
    | "REQUESTS_DIFFERENT_PROVIDER"
    | "REPORTS_BARRIER"
    | "DECLINES";
  messageSummary: string;
  timestamp: string;
}

export interface SyntheticClaim {
  id: string;
  referralId: string;
  appointmentId: string | null;
  providerId: string | null;
  serviceCode: string;
  status: "PAID" | "PENDING" | "DENIED";
  serviceDate: string;
  source: "SYNTHETIC_CLAIMS_CLEARINGHOUSE";
}

export interface SyntheticBarrier {
  id: string;
  category: BarrierCategory;
  subBarrier: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  confirmedByMember: boolean;
  description: string;
}

export interface SyntheticFailureEvent {
  id: string;
  stage: "PROVIDER_SEARCH" | "SCHEDULING" | "COMMUNICATION" | "EVIDENCE_SYNC";
  reason: string;
  retryable: boolean;
  timestamp: string;
}

export interface SyntheticEvidenceSignal {
  id: string;
  signalType: VerificationSignalType | "NO_SHOW" | "APPOINTMENT_CANCELLED";
  source: string;
  confidence: number;
  timestamp: string;
  provesCompletion: boolean;
  conflictsWithId?: string;
}

export interface SimulatedCaseWorld {
  caseId: string;
  scenario: SimulationScenarioType;
  seed: number;
  stepCount: number;
  caseStatus: CaseStatus;
  riskLevel: RiskLevel;
  priorityScore: number;
  humanReviewRequired: boolean;
  pendingBarrierConfirmations: number;
  pendingInterventionApprovals: number;
  openEscalations: number;
  matchedProviderId: string | null;
  rejectedProviderIds: string[];
  member: SyntheticMember;
  referral: SyntheticReferral;
  providers: SyntheticProvider[];
  appointments: SyntheticAppointment[];
  communications: SyntheticCommunicationResponse[];
  claims: SyntheticClaim[];
  barriers: SyntheticBarrier[];
  failures: SyntheticFailureEvent[];
  evidenceSignals: SyntheticEvidenceSignal[];
  previousActions: Array<{
    type: string;
    status: string;
    outcome?: string | null;
  }>;
  hasEvidenceConflict: boolean;
  hasVerifiedCompletion: boolean;
  hasRiskAssessment: boolean;
  isSynthetic: true;
  containsRealPhi: false;
}

export interface SimulationStepTrace {
  step: number;
  observedState: CaseStatus;
  selectedTool: string;
  policyEffect: CorePolicyDecisionEffect;
  resultingState: CaseStatus;
  eventGenerated: string;
}

export interface SimulatedCaseResult {
  caseId: string;
  scenario: SimulationScenarioType;
  terminalOutcome: SimulationTerminalOutcome;
  finalState: CaseStatus;
  stepsTaken: number;
  completionProven: boolean;
  humanEscalated: boolean;
  hasEvidenceConflict: boolean;
  failuresEncountered: number;
  failuresRecovered: number;
  traces: SimulationStepTrace[];
  world: SimulatedCaseWorld;
  zeroPhiGuaranteed: true;
}

export interface SimulationBatchOptions {
  count: number;
  seed?: number;
  scenarios?: SimulationScenarioType[];
  maxStepsPerCase?: number;
  sampleLimit?: number;
}

export interface SimulationBatchReport {
  totalCases: number;
  seed: number;
  durationMs: number;
  zeroPhiGuaranteed: true;
  outcomesByStatus: Record<SimulationTerminalOutcome, number>;
  scenariosCovered: Record<SimulationScenarioType, number>;
  averageStepsPerCase: number;
  completionRate: number;
  humanEscalationRate: number;
  policyBlockRate: number;
  conflictDetectionCount: number;
  failureRecoveryCount: number;
  sampleCases: SimulatedCaseResult[];
}

/**
 * Deterministic Mulberry32 PRNG so thousands of synthetic cases can be
 * generated and replayed identically without touching real PHI.
 */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

const SYNTHETIC_FIRST_NAMES = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Avery", "Quinn"] as const;
const SYNTHETIC_LAST_NAMES = ["Sample", "Testwell", "Demo", "Placeholder", "Fictional", "Mockson"] as const;
const SYNTHETIC_GEOGRAPHIES = ["Metro North", "Central Metro", "River Valley", "Eastside"] as const;
const SYNTHETIC_SPECIALTIES = [
  "Outpatient Therapy",
  "Psychiatry Medication Management",
  "Substance Use Counseling",
  "Adolescent Behavioral Health",
] as const;
const SYNTHETIC_NETWORKS = ["Horizon PPO", "Medicaid CarePlus", "Beacon Health Plan"] as const;

export function generateSyntheticMember(
  index: number,
  rng: () => number,
  overrides: Partial<SyntheticMember> = {}
): SyntheticMember {
  const first = pick(rng, SYNTHETIC_FIRST_NAMES);
  const last = pick(rng, SYNTHETIC_LAST_NAMES);
  return {
    id: `sim-mem-${index}`,
    syntheticMrn: `SYNTH-MRN-${String(100000 + index)}`,
    displayName: `${first} ${last} #${index}`,
    preferredLanguage: pick(rng, ["en", "es", "zh"] as const),
    preferredChannel: pick(rng, ["SMS", "EMAIL", "PORTAL"] as const),
    consentOutreach: true,
    consentSms: true,
    geography: pick(rng, SYNTHETIC_GEOGRAPHIES),
    urbanicity: pick(rng, ["URBAN", "SUBURBAN", "RURAL"] as const),
    networkPlan: pick(rng, SYNTHETIC_NETWORKS),
    digitalAccessLevel: pick(rng, ["HIGH", "MEDIUM", "LOW"] as const),
    transportationAccess: pick(rng, ["RELIABLE", "LIMITED", "NONE"] as const),
    priorNoShowCount: Math.floor(rng() * 3),
    isSynthetic: true,
    containsRealPhi: false,
    ...overrides,
  };
}

export function generateSyntheticReferral(
  index: number,
  member: SyntheticMember,
  rng: () => number,
  overrides: Partial<SyntheticReferral> = {}
): SyntheticReferral {
  const specialty = pick(rng, SYNTHETIC_SPECIALTIES);
  return {
    id: `sim-ref-${index}`,
    memberId: member.id,
    specialty,
    behavioralHealthNeed: specialty,
    urgency: pick(rng, ["ROUTINE", "PRIORITY", "URGENT"] as const),
    geography: member.geography,
    networkRequired: member.networkPlan,
    eligibilityVerified: "VERIFIED",
    createdAt: "2026-11-12T08:00:00.000Z",
    ...overrides,
  };
}

export function generateSyntheticProviders(
  index: number,
  referral: SyntheticReferral,
  scenario: SimulationScenarioType
): SyntheticProvider[] {
  const unavailableOnly = scenario === "provider_unavailable";
  return [
    {
      id: `sim-prov-${index}-a`,
      name: `Synthetic Clinic A-${index}`,
      specialty: referral.specialty,
      geography: referral.geography,
      networkPlans: [referral.networkRequired],
      languages: ["en", "es", "zh"],
      status: unavailableOnly ? "UNAVAILABLE" : "AVAILABLE",
      acceptingNewPatients: !unavailableOnly,
      slots: unavailableOnly
        ? []
        : [
            {
              id: `sim-slot-${index}-a1`,
              providerId: `sim-prov-${index}-a`,
              startsAt: "2026-11-14T10:00:00.000Z",
              isBooked: false,
            },
            {
              id: `sim-slot-${index}-a2`,
              providerId: `sim-prov-${index}-a`,
              startsAt: "2026-11-15T14:00:00.000Z",
              isBooked: false,
            },
          ],
    },
    {
      id: `sim-prov-${index}-b`,
      name: `Synthetic Clinic B-${index}`,
      specialty: referral.specialty,
      geography: referral.geography,
      networkPlans: [referral.networkRequired],
      languages: ["en", "es"],
      status: unavailableOnly ? "UNAVAILABLE" : "AVAILABLE",
      acceptingNewPatients: !unavailableOnly,
      slots: unavailableOnly
        ? []
        : [
            {
              id: `sim-slot-${index}-b1`,
              providerId: `sim-prov-${index}-b`,
              startsAt: "2026-11-16T09:30:00.000Z",
              isBooked: false,
            },
          ],
    },
  ];
}

export function generateSyntheticWorld(params: {
  caseIndex: number;
  scenario: SimulationScenarioType;
  seed?: number;
}): SimulatedCaseWorld {
  const seed = params.seed ?? 1000 + params.caseIndex;
  const rng = createSeededRng(seed);
  const member = generateSyntheticMember(params.caseIndex, rng);
  const urgencyOverride = params.scenario === "human_approval_required" ? "URGENT" : "ROUTINE";
  const referral = generateSyntheticReferral(params.caseIndex, member, rng, {
    urgency: urgencyOverride,
  });
  const providers = generateSyntheticProviders(params.caseIndex, referral, params.scenario);

  const world: SimulatedCaseWorld = {
    caseId: `sim-case-${params.caseIndex}`,
    scenario: params.scenario,
    seed,
    stepCount: 0,
    caseStatus: CaseStatus.NEW,
    riskLevel: referral.urgency === "URGENT" ? RiskLevel.HIGH : RiskLevel.MEDIUM,
    priorityScore: referral.urgency === "URGENT" ? 86 : 58,
    humanReviewRequired: params.scenario === "human_approval_required",
    pendingBarrierConfirmations: 0,
    pendingInterventionApprovals: params.scenario === "human_approval_required" ? 1 : 0,
    openEscalations: 0,
    matchedProviderId: null,
    rejectedProviderIds: [],
    member,
    referral,
    providers,
    appointments: [],
    communications: [],
    claims: [],
    barriers: [],
    failures: [],
    evidenceSignals: [],
    previousActions: [],
    hasEvidenceConflict: false,
    hasVerifiedCompletion: false,
    hasRiskAssessment: params.scenario !== "provider_available" && params.scenario !== "member_responds",
    isSynthetic: true,
    containsRealPhi: false,
  };

  if (params.scenario === "appointment_completed") {
    const prov = providers[0]!;
    const slot = prov.slots[0]!;
    slot.isBooked = true;
    world.matchedProviderId = prov.id;
    world.caseStatus = CaseStatus.APPOINTMENT_COMPLETED;
    world.appointments.push({
      id: `sim-appt-${params.caseIndex}-1`,
      referralId: referral.id,
      providerId: prov.id,
      slotId: slot.id,
      status: "COMPLETED",
      scheduledAt: slot.startsAt,
    });
    world.evidenceSignals.push({
      id: `sim-sig-${params.caseIndex}-1`,
      signalType: VerificationSignalType.APPOINTMENT_COMPLETED,
      source: "SYNTHETIC_EHR",
      confidence: 0.94,
      timestamp: "2026-11-14T11:00:00.000Z",
      provesCompletion: true,
    });
    world.hasVerifiedCompletion = true;
  } else if (params.scenario === "claim_arrives") {
    const prov = providers[0]!;
    const slot = prov.slots[0]!;
    slot.isBooked = true;
    world.matchedProviderId = prov.id;
    world.caseStatus = CaseStatus.APPOINTMENT_CONFIRMED;
    const apptId = `sim-appt-${params.caseIndex}-1`;
    world.appointments.push({
      id: apptId,
      referralId: referral.id,
      providerId: prov.id,
      slotId: slot.id,
      status: "CONFIRMED",
      scheduledAt: slot.startsAt,
    });
    world.claims.push({
      id: `sim-claim-${params.caseIndex}-1`,
      referralId: referral.id,
      appointmentId: apptId,
      providerId: prov.id,
      serviceCode: "CPT-90834",
      status: "PAID",
      serviceDate: "2026-11-14",
      source: "SYNTHETIC_CLAIMS_CLEARINGHOUSE",
    });
    world.evidenceSignals.push({
      id: `sim-sig-${params.caseIndex}-claim`,
      signalType: VerificationSignalType.CLAIM_RECEIVED,
      source: "SYNTHETIC_CLAIMS_CLEARINGHOUSE",
      confidence: 0.99,
      timestamp: "2026-11-15T09:00:00.000Z",
      provesCompletion: true,
    });
    world.hasVerifiedCompletion = true;
  } else if (params.scenario === "evidence_conflicts") {
    const prov = providers[0]!;
    const slot = prov.slots[0]!;
    slot.isBooked = true;
    world.matchedProviderId = prov.id;
    world.caseStatus = CaseStatus.APPOINTMENT_SCHEDULED;
    world.appointments.push({
      id: `sim-appt-${params.caseIndex}-1`,
      referralId: referral.id,
      providerId: prov.id,
      slotId: slot.id,
      status: "NO_SHOW",
      scheduledAt: slot.startsAt,
    });
    world.evidenceSignals.push(
      {
        id: `sim-sig-${params.caseIndex}-ehr`,
        signalType: VerificationSignalType.APPOINTMENT_COMPLETED,
        source: "SYNTHETIC_EHR",
        confidence: 0.91,
        timestamp: "2026-11-14T11:00:00.000Z",
        provesCompletion: true,
      },
      {
        id: `sim-sig-${params.caseIndex}-noshow`,
        signalType: "NO_SHOW",
        source: "SYNTHETIC_PROVIDER_PORTAL",
        confidence: 0.95,
        timestamp: "2026-11-14T11:15:00.000Z",
        provesCompletion: false,
        conflictsWithId: `sim-sig-${params.caseIndex}-ehr`,
      }
    );
    world.hasEvidenceConflict = true;
    world.pendingBarrierConfirmations = 1;
    world.openEscalations = 1;
  } else if (params.scenario === "appointment_cancelled") {
    const prov = providers[0]!;
    const slot = prov.slots[0]!;
    world.matchedProviderId = prov.id;
    world.caseStatus = CaseStatus.BARRIER_IDENTIFIED;
    world.appointments.push({
      id: `sim-appt-${params.caseIndex}-1`,
      referralId: referral.id,
      providerId: prov.id,
      slotId: slot.id,
      status: "CANCELLED",
      scheduledAt: slot.startsAt,
    });
    world.barriers.push({
      id: `sim-bar-${params.caseIndex}-1`,
      category: BarrierCategory.ACCESS,
      subBarrier: "appointment_cancelled",
      severity: "MEDIUM",
      confirmedByMember: false,
      description: "Initial synthetic appointment cancelled prior to visit.",
    });
    world.evidenceSignals.push({
      id: `sim-sig-${params.caseIndex}-cancel`,
      signalType: "APPOINTMENT_CANCELLED",
      source: "SYNTHETIC_SCHEDULER",
      confidence: 0.95,
      timestamp: "2026-11-13T16:00:00.000Z",
      provesCompletion: false,
    });
  } else if (params.scenario === "member_requests_different_provider") {
    world.matchedProviderId = providers[0]!.id;
    world.caseStatus = CaseStatus.INTERVENTION_IN_PROGRESS;
  }

  return world;
}

function buildOrchestratorInput(world: SimulatedCaseWorld): CaseOrchestratorInput {
  const availableProviders = world.providers.filter(
    (p) =>
      p.status === "AVAILABLE" &&
      p.acceptingNewPatients &&
      !world.rejectedProviderIds.includes(p.id)
  );
  const verifiedSlots = availableProviders.reduce(
    (sum, p) => sum + p.slots.filter((s) => !s.isBooked).length,
    0
  );

  const hasScheduledAppointment = world.appointments.some(
    (a) => a.status === "SCHEDULED" || a.status === "REQUESTED"
  );
  const hasConfirmedAppointment = world.appointments.some((a) => a.status === "CONFIRMED");
  const hasCompletedAppointment = world.appointments.some((a) => a.status === "COMPLETED");
  const hasNoShowAppointment = world.appointments.some((a) => a.status === "NO_SHOW");

  return {
    case_id: world.caseId,
    current_state: world.caseStatus,
    member_context: {
      preferredLanguage: world.member.preferredLanguage,
      urbanicity: world.member.urbanicity,
      digitalAccessLevel: world.member.digitalAccessLevel,
      transportationAccess: world.member.transportationAccess,
      consentOutreach: world.member.consentOutreach,
      consentSms: world.member.consentSms,
      priorNoShowCount: world.member.priorNoShowCount,
    },
    referral_context: {
      behavioralHealthNeed: world.referral.behavioralHealthNeed,
      specialty: world.referral.specialty,
      urgency: world.referral.urgency,
      geography: world.referral.geography,
      networkRequired: world.referral.networkRequired,
      eligibilityVerified: world.referral.eligibilityVerified,
      matchedProviderId: world.matchedProviderId,
      verifiedAvailableSlotsCount: verifiedSlots,
    },
    known_barriers: world.barriers.map((b) => ({
      category: b.category,
      subBarrier: b.subBarrier,
      epistemicStatus: b.confirmedByMember ? "FACT" : "INFERENCE",
      confirmedByHuman: b.confirmedByMember,
      resolved: false,
      evidenceSignals: [b.description],
    })),
    available_evidence: {
      hasRiskAssessment: world.hasRiskAssessment,
      hasScheduledAppointment,
      hasConfirmedAppointment,
      hasCompletedAppointment,
      hasNoShowAppointment,
      hasVerifiedVisit: world.hasVerifiedCompletion && !world.hasEvidenceConflict,
      signals: world.evidenceSignals.map((s) => `${s.signalType}:${s.source}`),
    },
    previous_actions: world.previousActions,
    policy_context: {
      riskTier: world.riskLevel,
      priorityScore: world.priorityScore,
      consentOutreach: world.member.consentOutreach,
      consentSms: world.member.consentSms,
      humanReviewRequired: world.humanReviewRequired || world.hasEvidenceConflict,
    },
    human_tasks: {
      pendingBarrierConfirmations: world.pendingBarrierConfirmations,
      pendingInterventionApprovals: world.pendingInterventionApprovals,
      openEscalations: world.openEscalations,
      awaitingCompletionVerification:
        world.hasVerifiedCompletion &&
        !world.hasEvidenceConflict &&
        world.caseStatus !== CaseStatus.CLOSED,
    },
  };
}

function transitionIfAllowed(world: SimulatedCaseWorld, nextState: CaseStatus): void {
  if (world.caseStatus === nextState) return;
  if (canTransitionCaseStatus(world.caseStatus, nextState)) {
    world.caseStatus = nextState;
  }
}

function applyEnvironmentStep(
  world: SimulatedCaseWorld,
  decision: CaseOrchestratorDecision,
  policyEffect: CorePolicyDecisionEffect
): { eventGenerated: string; terminalOutcome?: SimulationTerminalOutcome } {
  const stepNum = world.stepCount;

  // Evidence conflict must always route to human review, never auto-close
  if (world.hasEvidenceConflict) {
    transitionIfAllowed(world, CaseStatus.ESCALATED);
    world.previousActions.push({
      type: decision.tool,
      status: "SUCCEEDED",
      outcome: "Routed conflicting evidence to human review",
    });
    return {
      eventGenerated: "evidence_conflict_routed_to_human",
      terminalOutcome: "HUMAN_REQUIRED",
    };
  }

  // Policy blocks or requires human approval
  if (policyEffect === "DENY") {
    world.previousActions.push({
      type: decision.tool,
      status: "FAILED",
      outcome: "Blocked by policy engine",
    });
    return { eventGenerated: "policy_denied", terminalOutcome: "BLOCKED" };
  }

  if (
    policyEffect === "REQUIRE_HUMAN_APPROVAL" ||
    decision.tool === "escalate_to_human" ||
    decision.tool === "human_intervention_approval" ||
    decision.tool === "human_barrier_review"
  ) {
    transitionIfAllowed(world, CaseStatus.REQUIRES_HUMAN_REVIEW);
    world.previousActions.push({
      type: decision.tool,
      status: "SUCCEEDED",
      outcome: "Paused for human approval/review",
    });
    return {
      eventGenerated: `human_required_${decision.tool}`,
      terminalOutcome: "HUMAN_REQUIRED",
    };
  }

  // Completion verified -> close case
  if (
    decision.tool === "close_verified_case" ||
    (decision.tool === "verify_completion" && world.hasVerifiedCompletion)
  ) {
    const completionSignal = world.evidenceSignals.find((s) => s.provesCompletion);
    if (
      completionSignal &&
      completionSignal.signalType !== "NO_SHOW" &&
      completionSignal.signalType !== "APPOINTMENT_CANCELLED"
    ) {
      const check = evaluateVerificationSignal({
        signalType: completionSignal.signalType,
        confidence: completionSignal.confidence,
      });
      if (check.provesCareCompleted) {
        transitionIfAllowed(world, CaseStatus.APPOINTMENT_COMPLETED);
        transitionIfAllowed(world, CaseStatus.VERIFIED);
        transitionIfAllowed(world, CaseStatus.CLOSED);
        world.previousActions.push({
          type: decision.tool,
          status: "SUCCEEDED",
          outcome: `Verified via ${completionSignal.signalType}`,
        });
        return {
          eventGenerated: `case_closed_via_${completionSignal.signalType}`,
          terminalOutcome: "GOAL_ACHIEVED",
        };
      }
    }
  }

  // Provider search
  if (decision.tool === "search_providers") {
    const candidate = world.providers.find(
      (p) =>
        p.status === "AVAILABLE" &&
        p.acceptingNewPatients &&
        !world.rejectedProviderIds.includes(p.id) &&
        p.slots.some((s) => !s.isBooked)
    );
    if (!candidate) {
      world.failures.push({
        id: `sim-fail-${world.caseId}-${stepNum}`,
        stage: "PROVIDER_SEARCH",
        reason: "No available in-network provider with open slots",
        retryable: false,
        timestamp: "2026-11-12T10:00:00.000Z",
      });
      transitionIfAllowed(world, CaseStatus.REQUIRES_HUMAN_REVIEW);
      world.previousActions.push({
        type: decision.tool,
        status: "FAILED",
        outcome: "No available providers found",
      });
      return { eventGenerated: "provider_unavailable_escalated", terminalOutcome: "HUMAN_REQUIRED" };
    }
    world.matchedProviderId = candidate.id;
    transitionIfAllowed(world, CaseStatus.TRIAGED);
    world.previousActions.push({
      type: decision.tool,
      status: "SUCCEEDED",
      outcome: `Matched provider ${candidate.id}`,
    });
    return { eventGenerated: `provider_matched_${candidate.id}` };
  }

  // Outreach / communication
  if (decision.tool === "send_member_communication") {
    if (world.scenario === "member_does_not_respond") {
      world.communications.push({
        id: `sim-comm-${world.caseId}-${stepNum}`,
        memberId: world.member.id,
        channel: world.member.preferredChannel,
        status: "DELIVERED",
        responseType: "NO_RESPONSE",
        messageSummary: "Member did not respond to outreach attempt.",
        timestamp: "2026-11-12T12:00:00.000Z",
      });
      transitionIfAllowed(world, CaseStatus.INTERVENTION_IN_PROGRESS);
      world.previousActions.push({
        type: decision.tool,
        status: "SUCCEEDED",
        outcome: "Delivered with no response yet",
      });
      const noRespCount = world.communications.filter((c) => c.responseType === "NO_RESPONSE").length;
      if (noRespCount >= 2) {
        transitionIfAllowed(world, CaseStatus.REQUIRES_HUMAN_REVIEW);
        return {
          eventGenerated: "member_unreachable_after_retries",
          terminalOutcome: "HUMAN_REQUIRED",
        };
      }
      return { eventGenerated: "member_no_response" };
    }

    if (
      world.scenario === "member_requests_different_provider" &&
      world.rejectedProviderIds.length === 0 &&
      world.matchedProviderId
    ) {
      world.rejectedProviderIds.push(world.matchedProviderId);
      world.matchedProviderId = null;
      world.communications.push({
        id: `sim-comm-${world.caseId}-${stepNum}`,
        memberId: world.member.id,
        channel: world.member.preferredChannel,
        status: "RESPONDED",
        responseType: "REQUESTS_DIFFERENT_PROVIDER",
        messageSummary: "Member requested a different provider.",
        timestamp: "2026-11-12T12:30:00.000Z",
      });
      world.previousActions.push({
        type: decision.tool,
        status: "SUCCEEDED",
        outcome: "Member requested alternate provider",
      });
      return { eventGenerated: "member_requested_different_provider" };
    }

    world.communications.push({
      id: `sim-comm-${world.caseId}-${stepNum}`,
      memberId: world.member.id,
      channel: world.member.preferredChannel,
      status: "RESPONDED",
      responseType: "CONFIRMS",
      messageSummary: "Member confirmed preference and availability.",
      timestamp: "2026-11-12T12:15:00.000Z",
    });
    transitionIfAllowed(world, CaseStatus.INTERVENTION_IN_PROGRESS);
    world.previousActions.push({
      type: decision.tool,
      status: "SUCCEEDED",
      outcome: "Member responded affirmatively",
    });
    return { eventGenerated: "member_responded_confirmed" };
  }

  // Scheduling
  if (decision.tool === "schedule_appointment" || decision.tool === "request_scheduling") {
    const schedulingFailureCount = world.failures.filter((f) => f.stage === "SCHEDULING").length;
    if (world.scenario === "scheduling_fails" && schedulingFailureCount < 2) {
      world.failures.push({
        id: `sim-fail-${world.caseId}-${stepNum}`,
        stage: "SCHEDULING",
        reason: "Synthetic EHR slot hold timeout",
        retryable: schedulingFailureCount === 0,
        timestamp: "2026-11-12T13:00:00.000Z",
      });
      world.previousActions.push({
        type: decision.tool,
        status: "FAILED",
        outcome: "Scheduling slot hold timeout",
      });
      if (schedulingFailureCount >= 1) {
        transitionIfAllowed(world, CaseStatus.REQUIRES_HUMAN_REVIEW);
        return { eventGenerated: "scheduling_failed_escalated", terminalOutcome: "HUMAN_REQUIRED" };
      }
      return { eventGenerated: "scheduling_failed_retryable" };
    }

    const provider = world.providers.find(
      (p) =>
        (world.matchedProviderId ? p.id === world.matchedProviderId : true) &&
        p.status === "AVAILABLE" &&
        p.slots.some((s) => !s.isBooked)
    );
    const slot = provider?.slots.find((s) => !s.isBooked);
    if (!provider || !slot) {
      transitionIfAllowed(world, CaseStatus.REQUIRES_HUMAN_REVIEW);
      return { eventGenerated: "no_open_slot_available", terminalOutcome: "HUMAN_REQUIRED" };
    }

    if (world.scenario === "member_does_not_respond") {
      world.communications.push({
        id: `sim-comm-${world.caseId}-${stepNum}`,
        memberId: world.member.id,
        channel: world.member.preferredChannel,
        status: "DELIVERED",
        responseType: "NO_RESPONSE",
        messageSummary: "Member did not respond to scheduling outreach.",
        timestamp: "2026-11-12T13:10:00.000Z",
      });
      if (world.appointments.length === 0) {
        world.appointments.push({
          id: `sim-appt-${world.caseId}-${stepNum}`,
          referralId: world.referral.id,
          providerId: provider.id,
          slotId: slot.id,
          status: "REQUESTED",
          scheduledAt: slot.startsAt,
        });
      }
      world.previousActions.push({
        type: decision.tool,
        status: "SUCCEEDED",
        outcome: "Appointment requested; awaiting member response",
      });
      const noRespCount = world.communications.filter((c) => c.responseType === "NO_RESPONSE").length;
      if (noRespCount >= 2) {
        transitionIfAllowed(world, CaseStatus.REQUIRES_HUMAN_REVIEW);
        return {
          eventGenerated: "member_unreachable_after_retries",
          terminalOutcome: "HUMAN_REQUIRED",
        };
      }
      return { eventGenerated: "member_no_response" };
    }

    if (
      world.scenario === "member_requests_different_provider" &&
      world.rejectedProviderIds.length === 0 &&
      world.matchedProviderId
    ) {
      world.rejectedProviderIds.push(world.matchedProviderId);
      world.matchedProviderId = null;
      world.communications.push({
        id: `sim-comm-${world.caseId}-${stepNum}`,
        memberId: world.member.id,
        channel: world.member.preferredChannel,
        status: "RESPONDED",
        responseType: "REQUESTS_DIFFERENT_PROVIDER",
        messageSummary: "Member requested a different provider.",
        timestamp: "2026-11-12T13:15:00.000Z",
      });
      world.previousActions.push({
        type: decision.tool,
        status: "SUCCEEDED",
        outcome: "Member requested alternate provider",
      });
      return { eventGenerated: "member_requested_different_provider" };
    }

    slot.isBooked = true;
    const apptId = `sim-appt-${world.caseId}-${stepNum}`;
    world.appointments.push({
      id: apptId,
      referralId: world.referral.id,
      providerId: provider.id,
      slotId: slot.id,
      status: "COMPLETED",
      scheduledAt: slot.startsAt,
    });
    world.evidenceSignals.push({
      id: `sim-sig-${world.caseId}-${stepNum}`,
      signalType: VerificationSignalType.APPOINTMENT_COMPLETED,
      source: "SYNTHETIC_EHR",
      confidence: 0.93,
      timestamp: "2026-11-14T11:00:00.000Z",
      provesCompletion: true,
    });
    world.hasVerifiedCompletion = true;
    transitionIfAllowed(world, CaseStatus.INTERVENTION_RECOMMENDED);
    transitionIfAllowed(world, CaseStatus.INTERVENTION_IN_PROGRESS);
    transitionIfAllowed(world, CaseStatus.APPOINTMENT_SCHEDULED);
    world.previousActions.push({
      type: decision.tool,
      status: "SUCCEEDED",
      outcome: `Scheduled and completed appointment ${apptId}`,
    });
    return { eventGenerated: "appointment_scheduled_and_completed" };
  }

  // AI assessment / triage
  if (decision.tool === "run_ai_assessment") {
    world.hasRiskAssessment = true;
    transitionIfAllowed(world, CaseStatus.TRIAGED);
    world.previousActions.push({
      type: decision.tool,
      status: "SUCCEEDED",
      outcome: "Completed synthetic AI triage assessment",
    });
    return { eventGenerated: "ai_assessment_triaged" };
  }

  world.previousActions.push({
    type: decision.tool,
    status: "SUCCEEDED",
    outcome: `Executed ${decision.tool}`,
  });
  return { eventGenerated: `executed_${decision.tool}` };
}

export async function runSimulatedCase(params: {
  caseIndex: number;
  scenario: SimulationScenarioType;
  seed?: number;
  maxSteps?: number;
}): Promise<SimulatedCaseResult> {
  const maxSteps = params.maxSteps ?? 8;
  const world = generateSyntheticWorld({
    caseIndex: params.caseIndex,
    scenario: params.scenario,
    seed: params.seed,
  });

  const policyEvaluator = new CareLoopPolicyEvaluator();
  const traces: SimulationStepTrace[] = [];
  let terminalOutcome: SimulationTerminalOutcome = "MAX_STEPS_REACHED";

  for (let step = 1; step <= maxSteps; step += 1) {
    world.stepCount = step;
    const observedState = world.caseStatus;
    const input = buildOrchestratorInput(world);
    const decision = await CareLoopCaseOrchestrator.decideNextStep(input);
    const policyDecision = policyEvaluator.evaluate({
      action: decision.tool,
      caseState: input.current_state,
      riskTier: input.policy_context.riskTier,
      consentOutreach: input.policy_context.consentOutreach,
      consentSms: input.policy_context.consentSms,
      channel: world.member.preferredChannel,
      sensitiveCommunication: input.policy_context.humanReviewRequired,
      matchedProviderId: input.referral_context.matchedProviderId,
      verifiedAvailableSlotsCount: input.referral_context.verifiedAvailableSlotsCount,
      hasVerifiedCompletion: input.available_evidence.hasVerifiedVisit,
      humanApproved:
        world.scenario !== "human_approval_required" &&
        !world.hasEvidenceConflict &&
        (decision.tool === "verify_completion" || decision.tool === "close_verified_case") &&
        world.hasVerifiedCompletion,
      policyCheckRequired: decision.policy_check_required,
    });

    const stepResult = applyEnvironmentStep(world, decision, policyDecision.effect);

    traces.push({
      step,
      observedState,
      selectedTool: decision.tool,
      policyEffect: policyDecision.effect,
      resultingState: world.caseStatus,
      eventGenerated: stepResult.eventGenerated,
    });

    if (stepResult.terminalOutcome) {
      terminalOutcome = stepResult.terminalOutcome;
      break;
    }
  }

  const failuresEncountered = world.failures.length;
  const failuresRecovered = terminalOutcome === "GOAL_ACHIEVED" ? failuresEncountered : 0;

  return {
    caseId: world.caseId,
    scenario: world.scenario,
    terminalOutcome,
    finalState: world.caseStatus,
    stepsTaken: traces.length,
    completionProven: world.hasVerifiedCompletion && !world.hasEvidenceConflict,
    humanEscalated:
      terminalOutcome === "HUMAN_REQUIRED" ||
      world.caseStatus === CaseStatus.REQUIRES_HUMAN_REVIEW ||
      world.caseStatus === CaseStatus.ESCALATED,
    hasEvidenceConflict: world.hasEvidenceConflict,
    failuresEncountered,
    failuresRecovered,
    traces,
    world,
    zeroPhiGuaranteed: true,
  };
}

export async function runSimulationBatch(
  options: SimulationBatchOptions
): Promise<SimulationBatchReport> {
  const startedAt = Date.now();
  const seed = options.seed ?? 42;
  const rng = createSeededRng(seed);
  const scenarioPool = options.scenarios?.length ? options.scenarios : SIMULATION_SCENARIOS;
  const sampleLimit = options.sampleLimit ?? 10;

  const outcomesByStatus: Record<SimulationTerminalOutcome, number> = {
    GOAL_ACHIEVED: 0,
    HUMAN_REQUIRED: 0,
    BLOCKED: 0,
    MEMBER_DECLINED: 0,
    CASE_CLOSED: 0,
    MAX_STEPS_REACHED: 0,
  };

  const scenariosCovered = Object.fromEntries(
    SIMULATION_SCENARIOS.map((s) => [s, 0])
  ) as Record<SimulationScenarioType, number>;

  let totalSteps = 0;
  let completedCount = 0;
  let escalatedCount = 0;
  let blockedCount = 0;
  let conflictDetectionCount = 0;
  let failureRecoveryCount = 0;
  const sampleCases: SimulatedCaseResult[] = [];

  for (let i = 1; i <= options.count; i += 1) {
    const scenario =
      i <= scenarioPool.length ? scenarioPool[i - 1]! : pick(rng, scenarioPool);

    const result = await runSimulatedCase({
      caseIndex: i,
      scenario,
      seed: seed + i,
      maxSteps: options.maxStepsPerCase ?? 8,
    });

    outcomesByStatus[result.terminalOutcome] += 1;
    scenariosCovered[scenario] += 1;
    totalSteps += result.stepsTaken;
    if (result.terminalOutcome === "GOAL_ACHIEVED" || result.completionProven) {
      completedCount += 1;
    }
    if (result.humanEscalated) escalatedCount += 1;
    if (result.terminalOutcome === "BLOCKED") blockedCount += 1;
    if (result.hasEvidenceConflict && result.humanEscalated) {
      conflictDetectionCount += 1;
    }
    failureRecoveryCount += result.failuresRecovered;

    if (sampleCases.length < sampleLimit) {
      sampleCases.push(result);
    }
  }

  const total = Math.max(options.count, 1);
  return {
    totalCases: options.count,
    seed,
    durationMs: Date.now() - startedAt,
    zeroPhiGuaranteed: true,
    outcomesByStatus,
    scenariosCovered,
    averageStepsPerCase: Number((totalSteps / total).toFixed(2)),
    completionRate: Number((completedCount / total).toFixed(4)),
    humanEscalationRate: Number((escalatedCount / total).toFixed(4)),
    policyBlockRate: Number((blockedCount / total).toFixed(4)),
    conflictDetectionCount,
    failureRecoveryCount,
    sampleCases,
  };
}
