import { CaseStatus } from "@prisma/client";
import {
  buildCaseGoal,
  canTransitionCaseStatus,
  getAllowedNextCaseStatuses,
} from "@/domain/cases/state-machine";
import {
  assertModelCannotBypassHumanApproval,
  validateUntrustedModelOutput,
} from "@/lib/security/ai-safety-defense";
import { enforceOrchestratorDecisionPolicy } from "./policy-guard";
import { CaseOrchestratorDecision, CaseOrchestratorDecisionSchema } from "./schemas";

export interface CaseOrchestratorInput {
  case_id: string;
  goal?: string;
  member_context: {
    preferredLanguage: string;
    urbanicity: string;
    digitalAccessLevel: string;
    transportationAccess: string;
    consentOutreach: boolean;
    consentSms: boolean;
    priorNoShowCount: number;
  };
  referral_context: {
    behavioralHealthNeed: string;
    specialty: string;
    urgency: string;
    geography: string;
    networkRequired: string;
    eligibilityVerified: string;
    matchedProviderId: string | null;
    verifiedAvailableSlotsCount: number;
  };
  current_state: CaseStatus;
  known_barriers: Array<{
    category: string;
    subBarrier: string;
    epistemicStatus: string;
    confirmedByHuman: boolean;
    resolved: boolean;
    evidenceSignals: string[];
  }>;
  available_evidence: {
    hasRiskAssessment: boolean;
    hasCompletedAppointment: boolean;
    hasScheduledAppointment: boolean;
    hasConfirmedAppointment: boolean;
    hasNoShowAppointment: boolean;
    hasVerifiedVisit: boolean;
    signals: string[];
  };
  previous_actions: Array<{
    type: string;
    status: string;
    outcome?: string | null;
  }>;
  policy_context: {
    riskTier: string;
    priorityScore: number;
    consentOutreach: boolean;
    consentSms: boolean;
    humanReviewRequired: boolean;
  };
  human_tasks: {
    pendingBarrierConfirmations: number;
    pendingInterventionApprovals: number;
    openEscalations: number;
    awaitingCompletionVerification: boolean;
  };
}

function proposeNextStateIfValid(
  fromState: CaseStatus,
  targetState: CaseStatus
): CaseStatus | null {
  return canTransitionCaseStatus(fromState, targetState) ? targetState : null;
}

function buildDecision(
  raw: CaseOrchestratorDecision,
  policyCtx: {
    riskTier?: string;
    consentOutreach?: boolean;
    hasVerifiedCompletion?: boolean;
    verifiedAvailableSlotsCount?: number;
  }
): CaseOrchestratorDecision {
  const parsed = CaseOrchestratorDecisionSchema.parse(raw);
  return enforceOrchestratorDecisionPolicy(parsed, policyCtx);
}

/**
 * Parses and validates raw JSON returned by an external model or planner.
 * Rejects arbitrary prose (must be valid JSON conforming to CaseOrchestratorDecisionSchema)
 * and enforces deterministic safety policy guards before returning.
 */
export function parseExternalOrchestratorDecision(
  rawText: string,
  policyCtx?: {
    riskTier?: string;
    consentOutreach?: boolean;
    hasVerifiedCompletion?: boolean;
    verifiedAvailableSlotsCount?: number;
  }
): CaseOrchestratorDecision {
  const proposal = validateUntrustedModelOutput(
    rawText,
    CaseOrchestratorDecisionSchema,
    "ORCHESTRATOR_DECISION"
  );

  assertModelCannotBypassHumanApproval(proposal.data, {
    riskTier: policyCtx?.riskTier,
  });

  return enforceOrchestratorDecisionPolicy(proposal.data, policyCtx);
}

export interface CaseOrchestratorCaseContext {
  id: string;
  goal?: string | null;
  status: CaseStatus;
  riskLevel?: string | null;
  priorityScore?: number | null;
  humanReviewRequired?: boolean;
  matchedProviderId?: string | null;
  firstCompletedVisitAt?: Date | string | null;
  member: {
    preferredLanguage: string;
    urbanicity: string;
    digitalAccessLevel: string;
    transportationAccess: string;
    consentOutreach: boolean;
    consentSms: boolean;
    priorNoShowCount: number;
  };
  referral: {
    behavioralHealthNeed: string;
    specialty: string;
    urgency: string;
    geography: string;
    networkRequired: string;
    eligibilityVerified: string;
  };
  barriers?: Array<{
    category: string;
    subBarrier: string;
    epistemicStatus: string;
    confirmedByHuman: boolean;
    resolved: boolean;
    evidenceSignals?: unknown;
  }>;
  riskAssessments?: Array<{ riskLevel: string; score: number }>;
  interventions?: Array<{
    type: string;
    status: string;
    outcomes?: Array<{ outcomeStatus: string }>;
  }>;
  appointments?: Array<{ status: string }>;
  verifications?: Array<{ verified: boolean; verificationStatus?: string }>;
}

/**
 * CareLoop Case Orchestrator
 * Evaluates current state, human gates, barriers, evidence, and consent/risk policies
 * to determine the single safest structured next executable action.
 */
export const CareLoopCaseOrchestrator = {
  buildInput(
    careCase: CaseOrchestratorCaseContext,
    options?: { verifiedAvailableSlotsCount?: number }
  ): CaseOrchestratorInput {
    const barriers = careCase.barriers ?? [];
    const interventions = careCase.interventions ?? [];
    const appointments = careCase.appointments ?? [];
    const verifications = careCase.verifications ?? [];

    const hasVerifiedVisit =
      Boolean(careCase.firstCompletedVisitAt) ||
      verifications.some((v) => v.verified && (v.verificationStatus ?? "VERIFIED") === "VERIFIED");

    const evidenceList: string[] = [];
    for (const b of barriers) {
      if (Array.isArray(b.evidenceSignals)) {
        for (const sig of b.evidenceSignals) {
          if (typeof sig === "string" && !evidenceList.includes(sig)) {
            evidenceList.push(sig);
          }
        }
      }
    }

    const pendingApprovals = interventions.filter((i) => i.status === "RECOMMENDED").length;
    const pendingBarrierConfirmations = barriers.filter(
      (b) => b.epistemicStatus !== "FACT" && !b.confirmedByHuman && !b.resolved
    ).length;

    const latestRisk = careCase.riskAssessments?.[0];
    const riskTier = String(careCase.riskLevel ?? latestRisk?.riskLevel ?? "MEDIUM");
    const priorityScore = careCase.priorityScore ?? latestRisk?.score ?? 50;

    return {
      case_id: careCase.id,
      goal: careCase.goal?.trim() || buildCaseGoal({ specialty: careCase.referral.specialty }),
      member_context: {
        preferredLanguage: careCase.member.preferredLanguage,
        urbanicity: careCase.member.urbanicity,
        digitalAccessLevel: careCase.member.digitalAccessLevel,
        transportationAccess: careCase.member.transportationAccess,
        consentOutreach: careCase.member.consentOutreach,
        consentSms: careCase.member.consentSms,
        priorNoShowCount: careCase.member.priorNoShowCount,
      },
      referral_context: {
        behavioralHealthNeed: careCase.referral.behavioralHealthNeed,
        specialty: careCase.referral.specialty,
        urgency: careCase.referral.urgency,
        geography: careCase.referral.geography,
        networkRequired: careCase.referral.networkRequired,
        eligibilityVerified: careCase.referral.eligibilityVerified,
        matchedProviderId: careCase.matchedProviderId ?? null,
        verifiedAvailableSlotsCount: options?.verifiedAvailableSlotsCount ?? 0,
      },
      current_state: careCase.status,
      known_barriers: barriers.map((b) => ({
        category: b.category,
        subBarrier: b.subBarrier,
        epistemicStatus: b.epistemicStatus,
        confirmedByHuman: b.confirmedByHuman,
        resolved: b.resolved,
        evidenceSignals: Array.isArray(b.evidenceSignals)
          ? b.evidenceSignals.filter((s): s is string => typeof s === "string")
          : [],
      })),
      available_evidence: {
        hasRiskAssessment: (careCase.riskAssessments?.length ?? 0) > 0 || priorityScore > 0,
        hasCompletedAppointment: appointments.some((a) => a.status === "COMPLETED"),
        hasScheduledAppointment: appointments.some((a) => a.status === "SCHEDULED"),
        hasConfirmedAppointment: appointments.some((a) => a.status === "CONFIRMED"),
        hasNoShowAppointment: appointments.some((a) => a.status === "NO_SHOW"),
        hasVerifiedVisit,
        signals: evidenceList,
      },
      previous_actions: interventions.map((i) => ({
        type: i.type,
        status: i.status,
        outcome: i.outcomes?.[0]?.outcomeStatus ?? null,
      })),
      policy_context: {
        riskTier,
        priorityScore,
        consentOutreach: careCase.member.consentOutreach,
        consentSms: careCase.member.consentSms,
        humanReviewRequired: Boolean(careCase.humanReviewRequired),
      },
      human_tasks: {
        pendingBarrierConfirmations,
        pendingInterventionApprovals: pendingApprovals,
        openEscalations: careCase.status === "ESCALATED" ? 1 : 0,
        awaitingCompletionVerification:
          appointments.some((a) => a.status === "COMPLETED") && !hasVerifiedVisit,
      },
    };
  },

  decideNextStep(input: CaseOrchestratorInput): CaseOrchestratorDecision {
    const resolvedGoal =
      input.goal?.trim() || buildCaseGoal({ specialty: input.referral_context.specialty });
    const policyCtx = {
      riskTier: input.policy_context.riskTier,
      consentOutreach: input.policy_context.consentOutreach,
      hasVerifiedCompletion: input.available_evidence.hasVerifiedVisit,
      verifiedAvailableSlotsCount: input.referral_context.verifiedAvailableSlotsCount,
    };

    const allowedNext = getAllowedNextCaseStatuses(input.current_state);
    const baseEvidence =
      input.available_evidence.signals.length > 0
        ? input.available_evidence.signals.slice(0, 4)
        : [`current_state=${input.current_state}`, `risk_tier=${input.policy_context.riskTier}`];

    if (input.current_state === "CLOSED") {
      return buildDecision(
        {
          goal: resolvedGoal,
          current_state: input.current_state,
          proposed_next_state: null,
          recommended_action: "Case closed; preserve verified completion audit trail and continued engagement signals.",
          tool: "verify_completion",
          reason: "Workflow reached terminal CLOSED state; no further automated transitions permitted.",
          evidence: [
            ...baseEvidence,
            `verified_visit=${String(input.available_evidence.hasVerifiedVisit)}`,
          ],
          confidence: 0.99,
          requires_human: true,
          policy_check_required: true,
          expected_outcome: "Closed case remains reconciled in executive and equity outcome ledgers.",
          fallback_action: "Reopen only via formal new referral intake if renewed care navigation is needed.",
        },
        policyCtx
      );
    }

    if (
      input.current_state === "ESCALATED" ||
      input.current_state === "BLOCKED" ||
      input.current_state === "LOST_TO_FOLLOW_UP"
    ) {
      return buildDecision(
        {
          goal: resolvedGoal,
          current_state: input.current_state,
          proposed_next_state: proposeNextStateIfValid(input.current_state, "REQUIRES_HUMAN_REVIEW"),
          recommended_action:
            "Complete senior Care Manager exception review to unblock barrier or document verified disposition.",
          tool: "escalate_to_human",
          reason: `Case is in exception state ${input.current_state} requiring human judgment and recovery transition (${allowedNext.join(", ")}).`,
          evidence: baseEvidence,
          confidence: 0.94,
          requires_human: true,
          policy_check_required: true,
          expected_outcome: "Explicit human resolution unblocks scheduling or closes case with documented reason.",
          fallback_action: "Document member unreachable status and retain referral in unresolved escalation queue.",
        },
        policyCtx
      );
    }

    if (input.available_evidence.hasVerifiedVisit && input.current_state === "VERIFIED") {
      return buildDecision(
        {
          goal: resolvedGoal,
          current_state: input.current_state,
          proposed_next_state: proposeNextStateIfValid(input.current_state, "CLOSED"),
          recommended_action: "Finalize verified case closure and record first-visit completion outcome.",
          tool: "close_verified_case",
          reason: "First behavioral-health visit is formally verified; case is eligible to transition VERIFIED -> CLOSED.",
          evidence: [...baseEvidence, "first_completed_visit_verified=true"],
          confidence: 0.96,
          requires_human: true,
          policy_check_required: true,
          expected_outcome: "Case closes cleanly and counts toward verified referral completion rate.",
          fallback_action: "Keep case in VERIFIED status if member requests continued check-in prior to closure.",
        },
        policyCtx
      );
    }

    if (input.human_tasks.awaitingCompletionVerification) {
      return buildDecision(
        {
          goal: resolvedGoal,
          current_state: input.current_state,
          proposed_next_state: proposeNextStateIfValid(input.current_state, "VERIFIED"),
          recommended_action:
            "Record multi-signal visit completion verification (provider, member, or claim confirmation).",
          tool: "verify_completion",
          reason: "Appointment reached COMPLETED, which does not prove completed care until verification evidence is recorded.",
          evidence: [...baseEvidence, "appointment_completed_awaiting_verification"],
          confidence: 0.92,
          requires_human: true,
          policy_check_required: true,
          expected_outcome: "Case transitions to VERIFIED with verified visit timestamp and confidence signal.",
          fallback_action: "Follow up with clinic scheduler for attendance confirmation if verification signal is missing.",
        },
        policyCtx
      );
    }

    if (input.current_state === "NEW" || (!input.available_evidence.hasRiskAssessment && input.known_barriers.length === 0)) {
      return buildDecision(
        {
          goal: resolvedGoal,
          current_state: input.current_state,
          proposed_next_state: proposeNextStateIfValid(input.current_state, "TRIAGED"),
          recommended_action: "Run structured AI risk, barrier inference, and intervention staging for triage.",
          tool: "run_ai_assessment",
          reason: "Case lacks structured operational risk and barrier signals needed to plan safe coordination.",
          evidence: baseEvidence,
          confidence: 0.91,
          requires_human: input.policy_context.riskTier === "HIGH",
          policy_check_required: true,
          expected_outcome: "Prioritized risk tier, evidenced barrier (or Barrier unknown), and staged recommendation.",
          fallback_action: "Route directly to Care Manager human triage if referral intake signals remain sparse.",
        },
        policyCtx
      );
    }

    if (input.human_tasks.pendingInterventionApprovals > 0) {
      return buildDecision(
        {
          goal: resolvedGoal,
          current_state: input.current_state,
          proposed_next_state: proposeNextStateIfValid(input.current_state, "INTERVENTION_IN_PROGRESS"),
          recommended_action: `Review and approve or modify ${input.human_tasks.pendingInterventionApprovals} recommended intervention(s).`,
          tool: "human_intervention_approval",
          reason: "Pending recommendations require human accountability before external execution.",
          evidence: [...baseEvidence, `pending_approvals=${input.human_tasks.pendingInterventionApprovals}`],
          confidence: 0.93,
          requires_human: true,
          policy_check_required: true,
          expected_outcome: "Approved intervention authorizes safe scheduling or outreach execution.",
          fallback_action: "Reject stale proposal and trigger fresh Care Manager outreach if member context changed.",
        },
        policyCtx
      );
    }

    const unknownBarrier = input.known_barriers.some((b) => b.category === "UNKNOWN" && !b.resolved);
    if (input.human_tasks.pendingBarrierConfirmations > 0 || unknownBarrier) {
      const topBarrier = input.known_barriers[0];
      return buildDecision(
        {
          goal: resolvedGoal,
          current_state: input.current_state,
          proposed_next_state: proposeNextStateIfValid(input.current_state, "REQUIRES_HUMAN_REVIEW"),
          recommended_action: unknownBarrier
            ? "Perform direct human outreach to clarify unknown referral barrier without guessing."
            : `Verify inferred barrier (${topBarrier?.subBarrier ?? "primary barrier"}) with member evidence to confirm FACT status.`,
          tool: "human_barrier_review",
          reason: unknownBarrier
            ? "Available intake signals are insufficient; CareLoop never fabricates barriers."
            : "Current barrier carries epistemic status INFERENCE and awaits Care Manager verification.",
          evidence: baseEvidence,
          confidence: unknownBarrier ? 0.55 : 0.78,
          requires_human: true,
          policy_check_required: true,
          expected_outcome: "Confirmed FACT barrier unlocks targeted intervention and provider matching.",
          fallback_action: "Escalate case to senior Care Manager if member remains unreachable after outreach.",
        },
        policyCtx
      );
    }

    if (input.available_evidence.hasNoShowAppointment && !input.available_evidence.hasScheduledAppointment) {
      return buildDecision(
        {
          goal: resolvedGoal,
          current_state: input.current_state,
          proposed_next_state: proposeNextStateIfValid(input.current_state, "ESCALATED"),
          recommended_action:
            "Initiate supportive no-show re-engagement and offer telehealth or verified alternate time slot.",
          tool: input.policy_context.riskTier === "HIGH" || !input.policy_context.consentOutreach
            ? "escalate_to_human"
            : "request_scheduling",
          reason: "Prior appointment ended in NO_SHOW; non-punitive recovery coordination is needed to restore care access.",
          evidence: [...baseEvidence, `prior_no_show_count=${input.member_context.priorNoShowCount}`],
          confidence: 0.84,
          requires_human: true,
          policy_check_required: true,
          expected_outcome: "Member re-engages with an accessible slot matched to schedule/transit constraints.",
          fallback_action: "Escalate for live phone navigation if digital rescheduling goes unanswered.",
        },
        policyCtx
      );
    }

    if (input.available_evidence.hasConfirmedAppointment) {
      return buildDecision(
        {
          goal: resolvedGoal,
          current_state: input.current_state,
          proposed_next_state: proposeNextStateIfValid(input.current_state, "APPOINTMENT_COMPLETED"),
          recommended_action: "Prepare attendance confirmation check after scheduled visit time.",
          tool: "verify_completion",
          reason: "Appointment is CONFIRMED; next step toward care completion is verifying attended visit evidence.",
          evidence: [...baseEvidence, "appointment_status=CONFIRMED"],
          confidence: 0.9,
          requires_human: true,
          policy_check_required: true,
          expected_outcome: "Attended appointment transitions to COMPLETED and VERIFIED.",
          fallback_action: "Trigger missed-appointment re-engagement workflow immediately if visit is missed.",
        },
        policyCtx
      );
    }

    if (input.available_evidence.hasScheduledAppointment) {
      const canRemind = input.policy_context.consentOutreach && input.policy_context.riskTier !== "HIGH";
      return buildDecision(
        {
          goal: resolvedGoal,
          current_state: input.current_state,
          proposed_next_state: proposeNextStateIfValid(input.current_state, "APPOINTMENT_CONFIRMED"),
          recommended_action: canRemind
            ? "Send supportive appointment reminder and capture confirmation prior to visit date."
            : "Verify appointment readiness and confirm attendance logistics with Care Manager oversight.",
          tool: canRemind ? "send_reminder" : "verify_appointment",
          reason: "Appointment is SCHEDULED but unconfirmed; pre-visit confirmation reduces no-show probability.",
          evidence: [...baseEvidence, "appointment_status=SCHEDULED"],
          confidence: 0.86,
          requires_human: !canRemind,
          policy_check_required: true,
          expected_outcome: "Appointment status moves from SCHEDULED to CONFIRMED.",
          fallback_action: "Coordinate alternative slot or telehealth backup if member reports attendance friction.",
        },
        policyCtx
      );
    }

    if (!input.referral_context.matchedProviderId) {
      return buildDecision(
        {
          goal: resolvedGoal,
          current_state: input.current_state,
          proposed_next_state: proposeNextStateIfValid(input.current_state, "INTERVENTION_IN_PROGRESS"),
          recommended_action: `Search in-network ${input.referral_context.specialty} providers compatible with ${input.member_context.preferredLanguage} in ${input.referral_context.geography}.`,
          tool: "search_providers",
          reason: "No provider is matched yet; provider matching prioritizes verified near-term slots and language concordance.",
          evidence: [
            ...baseEvidence,
            `preferred_language=${input.member_context.preferredLanguage}`,
            `network=${input.referral_context.networkRequired}`,
          ],
          confidence: 0.88,
          requires_human: input.policy_context.riskTier === "HIGH",
          policy_check_required: true,
          expected_outcome: "In-network compatible provider matched with explicit verified vs directory availability status.",
          fallback_action: "Expand search to regional telehealth providers if local verified slots are unavailable.",
        },
        policyCtx
      );
    }

    if (input.referral_context.verifiedAvailableSlotsCount > 0) {
      return buildDecision(
        {
          goal: resolvedGoal,
          current_state: input.current_state,
          proposed_next_state: proposeNextStateIfValid(input.current_state, "APPOINTMENT_SCHEDULED"),
          recommended_action: "Schedule behavioral-health visit into a verified open provider slot.",
          tool: "schedule_appointment",
          reason: `${input.referral_context.verifiedAvailableSlotsCount} verified available slot(s) exist for matched network selection.`,
          evidence: [
            ...baseEvidence,
            `matched_provider=${input.referral_context.matchedProviderId}`,
            `verified_slots=${input.referral_context.verifiedAvailableSlotsCount}`,
          ],
          confidence: 0.89,
          requires_human: input.policy_context.riskTier === "HIGH",
          policy_check_required: true,
          expected_outcome: "Case transitions cleanly to APPOINTMENT_SCHEDULED backed by verified slot provenance.",
          fallback_action: "Use navigator assisted scheduling if member needs time/transit accommodation.",
        },
        policyCtx
      );
    }

    return buildDecision(
      {
        goal: resolvedGoal,
        current_state: input.current_state,
        proposed_next_state: proposeNextStateIfValid(input.current_state, "REQUIRES_HUMAN_REVIEW"),
        recommended_action: "Verify live clinic availability or initiate assisted scheduling before booking.",
        tool: "check_provider_availability",
        reason: "Matched provider lacks verified open appointment slots in system; CareLoop never treats directory listing as confirmed availability.",
        evidence: [...baseEvidence, `matched_provider=${input.referral_context.matchedProviderId}`, "verified_slots=0"],
        confidence: 0.82,
        requires_human: true,
        policy_check_required: true,
        expected_outcome: "Clinic confirms open intake slot or Care Manager selects alternate verified provider.",
        fallback_action: "Re-run provider search for alternate verified in-network telehealth capacity.",
      },
      policyCtx
    );
  },

  decideFromCase(
    careCase: CaseOrchestratorCaseContext,
    options?: { verifiedAvailableSlotsCount?: number }
  ): CaseOrchestratorDecision {
    const input = CareLoopCaseOrchestrator.buildInput(careCase, options);
    return CareLoopCaseOrchestrator.decideNextStep(input);
  },
};
