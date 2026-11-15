import { describe, expect, it } from "vitest";
import { CaseStatus } from "@prisma/client";
import {
  AIPolicyViolationError,
  CareLoopCaseOrchestrator,
  CaseOrchestratorDecisionSchema,
  CaseOrchestratorInput,
  enforceOrchestratorDecisionPolicy,
  parseExternalOrchestratorDecision,
} from "@/ai";
import { InvalidStateTransitionError, ValidationError } from "@/lib/errors";

function makeBaseInput(overrides: Partial<CaseOrchestratorInput> = {}): CaseOrchestratorInput {
  return {
    case_id: "case-orch-1",
    member_context: {
      preferredLanguage: "English",
      urbanicity: "URBAN",
      digitalAccessLevel: "HIGH",
      transportationAccess: "RELIABLE",
      consentOutreach: true,
      consentSms: true,
      priorNoShowCount: 0,
    },
    referral_context: {
      behavioralHealthNeed: "Outpatient Behavioral Health",
      specialty: "Outpatient Behavioral Health",
      urgency: "ROUTINE",
      geography: "Central Metro",
      networkRequired: "Horizon Medicaid",
      eligibilityVerified: "VERIFIED",
      matchedProviderId: "prov-1",
      verifiedAvailableSlotsCount: 2,
    },
    current_state: CaseStatus.INTERVENTION_IN_PROGRESS,
    known_barriers: [
      {
        category: "ACCESS",
        subBarrier: "unavailable appointments",
        epistemicStatus: "FACT",
        confirmedByHuman: true,
        resolved: false,
        evidenceSignals: ["Verified initial clinic slots=0"],
      },
    ],
    available_evidence: {
      hasRiskAssessment: true,
      hasCompletedAppointment: false,
      hasScheduledAppointment: false,
      hasConfirmedAppointment: false,
      hasNoShowAppointment: false,
      hasVerifiedVisit: false,
      signals: ["Verified initial clinic slots=0"],
    },
    previous_actions: [{ type: "ALTERNATIVE_PROVIDER_SEARCH", status: "COMPLETED", outcome: "RESOLVED" }],
    policy_context: {
      riskTier: "MEDIUM",
      priorityScore: 55,
      consentOutreach: true,
      consentSms: true,
      humanReviewRequired: false,
    },
    human_tasks: {
      pendingBarrierConfirmations: 0,
      pendingInterventionApprovals: 0,
      openEscalations: 0,
      awaitingCompletionVerification: false,
    },
    ...overrides,
  };
}

describe("CareLoop Case Orchestrator & Structured Decision Policy", () => {
  it("never accepts arbitrary prose and requires strict CaseOrchestratorDecisionSchema JSON", () => {
    expect(() =>
      parseExternalOrchestratorDecision("We should call the member soon and verify their appointment.")
    ).toThrowError(ValidationError);

    expect(() =>
      parseExternalOrchestratorDecision(JSON.stringify({ recommended_action: "Call member" }))
    ).toThrowError(ValidationError);

    const validJson = JSON.stringify({
      goal: "Complete first behavioral-health visit",
      current_state: "TRIAGED",
      recommended_action: "Review inferred barrier with member",
      tool: "human_barrier_review",
      reason: "Barrier requires human confirmation to reach FACT status.",
      evidence: ["Directory wait 32 days"],
      confidence: 0.78,
      requires_human: true,
      policy_check_required: true,
      expected_outcome: "Confirmed barrier enables matching",
      fallback_action: "Escalate if member unreachable",
    });

    const parsed = parseExternalOrchestratorDecision(validJson, { riskTier: "MEDIUM" });
    expect(parsed.tool).toBe("human_barrier_review");
    expect(parsed.requires_human).toBe(true);
  });

  it("builds complete orchestrator input from case context and emits schema-valid decisions across workflow stages", () => {
    const built = CareLoopCaseOrchestrator.buildInput(
      {
        id: "case-built-1",
        status: CaseStatus.NEW,
        riskLevel: "HIGH",
        priorityScore: 91,
        humanReviewRequired: true,
        matchedProviderId: null,
        firstCompletedVisitAt: null,
        member: {
          preferredLanguage: "Spanish",
          urbanicity: "RURAL",
          digitalAccessLevel: "LOW",
          transportationAccess: "NONE",
          consentOutreach: true,
          consentSms: false,
          priorNoShowCount: 1,
        },
        referral: {
          behavioralHealthNeed: "Trauma Counseling",
          specialty: "Trauma Therapy",
          urgency: "URGENT",
          geography: "West Valley",
          networkRequired: "Horizon Medicaid",
          eligibilityVerified: "VERIFIED",
        },
        barriers: [],
        riskAssessments: [],
        interventions: [],
        appointments: [],
        verifications: [],
      },
      { verifiedAvailableSlotsCount: 0 }
    );

    expect(built.case_id).toBe("case-built-1");
    expect(built.goal).toBe("Complete the member's Trauma Therapy referral through a verified first visit.");
    expect(built.policy_context.riskTier).toBe("HIGH");

    const newDecision = CareLoopCaseOrchestrator.decideNextStep(built);
    expect(CaseOrchestratorDecisionSchema.safeParse(newDecision).success).toBe(true);
    expect(newDecision.goal).toBe(
      "Complete the member's Trauma Therapy referral through a verified first visit."
    );
    expect(newDecision.tool).toBe("run_ai_assessment");
    expect(newDecision.policy_check_required).toBe(true);

    const pendingApprovalDecision = CareLoopCaseOrchestrator.decideNextStep(
      makeBaseInput({
        current_state: CaseStatus.INTERVENTION_RECOMMENDED,
        human_tasks: {
          pendingBarrierConfirmations: 0,
          pendingInterventionApprovals: 1,
          openEscalations: 0,
          awaitingCompletionVerification: false,
        },
      })
    );
    expect(pendingApprovalDecision.tool).toBe("human_intervention_approval");
    expect(pendingApprovalDecision.requires_human).toBe(true);

    const noVerifiedSlotDecision = CareLoopCaseOrchestrator.decideNextStep(
      makeBaseInput({
        referral_context: {
          ...makeBaseInput().referral_context,
          verifiedAvailableSlotsCount: 0,
        },
      })
    );
    expect(noVerifiedSlotDecision.tool).toBe("check_provider_availability");
    expect(noVerifiedSlotDecision.requires_human).toBe(true);

    const completionAwaitDecision = CareLoopCaseOrchestrator.decideNextStep(
      makeBaseInput({
        current_state: CaseStatus.APPOINTMENT_COMPLETED,
        available_evidence: {
          ...makeBaseInput().available_evidence,
          hasCompletedAppointment: true,
          hasVerifiedVisit: false,
        },
        human_tasks: {
          pendingBarrierConfirmations: 0,
          pendingInterventionApprovals: 0,
          openEscalations: 0,
          awaitingCompletionVerification: true,
        },
      })
    );
    expect(completionAwaitDecision.tool).toBe("verify_completion");
    expect(completionAwaitDecision.requires_human).toBe(true);

    const verifiedCloseDecision = CareLoopCaseOrchestrator.decideNextStep(
      makeBaseInput({
        current_state: CaseStatus.VERIFIED,
        available_evidence: {
          ...makeBaseInput().available_evidence,
          hasCompletedAppointment: true,
          hasVerifiedVisit: true,
        },
      })
    );
    expect(verifiedCloseDecision.tool).toBe("close_verified_case");
    expect(verifiedCloseDecision.requires_human).toBe(true);
  });

  it("enforces safety policy invariants rejecting clinical advice, missing consent, high-risk auto-execution, and unverified booking/closure", () => {
    const baseDecision = CareLoopCaseOrchestrator.decideNextStep(makeBaseInput());

    expect(() =>
      enforceOrchestratorDecisionPolicy({
        ...baseDecision,
        policy_check_required: false,
      })
    ).toThrowError(AIPolicyViolationError);

    expect(() =>
      enforceOrchestratorDecisionPolicy({
        ...baseDecision,
        recommended_action: "Prescribe antidepressant dosage titration prior to visit",
      })
    ).toThrowError(AIPolicyViolationError);

    expect(() =>
      enforceOrchestratorDecisionPolicy(
        {
          ...baseDecision,
          tool: "schedule_appointment",
          requires_human: false,
        },
        { riskTier: "HIGH", verifiedAvailableSlotsCount: 2 }
      )
    ).toThrowError(AIPolicyViolationError);

    expect(() =>
      enforceOrchestratorDecisionPolicy(
        {
          ...baseDecision,
          tool: "send_reminder",
          requires_human: false,
        },
        { riskTier: "LOW", consentOutreach: false }
      )
    ).toThrowError(AIPolicyViolationError);

    expect(() =>
      enforceOrchestratorDecisionPolicy(
        {
          ...baseDecision,
          tool: "schedule_appointment",
          requires_human: true,
        },
        { riskTier: "MEDIUM", verifiedAvailableSlotsCount: 0 }
      )
    ).toThrowError(AIPolicyViolationError);

    expect(() =>
      enforceOrchestratorDecisionPolicy(
        {
          ...baseDecision,
          tool: "close_verified_case",
          requires_human: true,
        },
        { hasVerifiedCompletion: false }
      )
    ).toThrowError(AIPolicyViolationError);

    expect(() =>
      enforceOrchestratorDecisionPolicy(
        {
          ...baseDecision,
          current_state: CaseStatus.NEW,
          proposed_next_state: CaseStatus.CLOSED,
        },
        { riskTier: "MEDIUM" }
      )
    ).toThrowError(InvalidStateTransitionError);

    expect(() =>
      enforceOrchestratorDecisionPolicy(
        {
          ...baseDecision,
          current_state: CaseStatus.CLOSED,
          proposed_next_state: CaseStatus.NEW,
        },
        { riskTier: "MEDIUM" }
      )
    ).toThrowError(InvalidStateTransitionError);
  });
});
