import { CaseStatus } from "@prisma/client";
import { InvalidStateTransitionError } from "@/lib/errors";

export const CASE_STATUS_ORDER: CaseStatus[] = [
  CaseStatus.NEW,
  CaseStatus.TRIAGED,
  CaseStatus.BARRIER_IDENTIFIED,
  CaseStatus.INTERVENTION_RECOMMENDED,
  CaseStatus.INTERVENTION_IN_PROGRESS,
  CaseStatus.APPOINTMENT_SCHEDULED,
  CaseStatus.APPOINTMENT_CONFIRMED,
  CaseStatus.APPOINTMENT_COMPLETED,
  CaseStatus.VERIFIED,
  CaseStatus.CLOSED,
];

export const CASE_SIDE_STATES: CaseStatus[] = [
  CaseStatus.ESCALATED,
  CaseStatus.BLOCKED,
  CaseStatus.REQUIRES_HUMAN_REVIEW,
  CaseStatus.LOST_TO_FOLLOW_UP,
];

/**
 * Explicit state transition graph for CareLoop cases.
 * Side states (ESCALATED, BLOCKED, REQUIRES_HUMAN_REVIEW, LOST_TO_FOLLOW_UP)
 * can be entered from active states and recovered back into the main workflow.
 */
export const ALLOWED_CASE_TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> = {
  NEW: [
    CaseStatus.TRIAGED,
    CaseStatus.REQUIRES_HUMAN_REVIEW,
    CaseStatus.ESCALATED,
    CaseStatus.BLOCKED,
  ],
  TRIAGED: [
    CaseStatus.BARRIER_IDENTIFIED,
    CaseStatus.INTERVENTION_RECOMMENDED,
    CaseStatus.REQUIRES_HUMAN_REVIEW,
    CaseStatus.ESCALATED,
    CaseStatus.BLOCKED,
  ],
  BARRIER_IDENTIFIED: [
    CaseStatus.INTERVENTION_RECOMMENDED,
    CaseStatus.INTERVENTION_IN_PROGRESS,
    CaseStatus.APPOINTMENT_SCHEDULED,
    CaseStatus.REQUIRES_HUMAN_REVIEW,
    CaseStatus.ESCALATED,
    CaseStatus.BLOCKED,
  ],
  INTERVENTION_RECOMMENDED: [
    CaseStatus.INTERVENTION_IN_PROGRESS,
    CaseStatus.APPOINTMENT_SCHEDULED,
    CaseStatus.REQUIRES_HUMAN_REVIEW,
    CaseStatus.ESCALATED,
    CaseStatus.BLOCKED,
    CaseStatus.LOST_TO_FOLLOW_UP,
  ],
  INTERVENTION_IN_PROGRESS: [
    CaseStatus.APPOINTMENT_SCHEDULED,
    CaseStatus.BARRIER_IDENTIFIED,
    CaseStatus.INTERVENTION_RECOMMENDED,
    CaseStatus.REQUIRES_HUMAN_REVIEW,
    CaseStatus.ESCALATED,
    CaseStatus.BLOCKED,
    CaseStatus.LOST_TO_FOLLOW_UP,
  ],
  APPOINTMENT_SCHEDULED: [
    CaseStatus.APPOINTMENT_CONFIRMED,
    CaseStatus.APPOINTMENT_COMPLETED,
    CaseStatus.INTERVENTION_IN_PROGRESS,
    CaseStatus.REQUIRES_HUMAN_REVIEW,
    CaseStatus.ESCALATED,
    CaseStatus.BLOCKED,
    CaseStatus.LOST_TO_FOLLOW_UP,
  ],
  APPOINTMENT_CONFIRMED: [
    CaseStatus.APPOINTMENT_COMPLETED,
    CaseStatus.APPOINTMENT_SCHEDULED,
    CaseStatus.INTERVENTION_IN_PROGRESS,
    CaseStatus.REQUIRES_HUMAN_REVIEW,
    CaseStatus.ESCALATED,
    CaseStatus.LOST_TO_FOLLOW_UP,
  ],
  APPOINTMENT_COMPLETED: [
    CaseStatus.VERIFIED,
    CaseStatus.REQUIRES_HUMAN_REVIEW,
    CaseStatus.ESCALATED,
  ],
  VERIFIED: [
    CaseStatus.CLOSED,
    CaseStatus.REQUIRES_HUMAN_REVIEW,
  ],
  CLOSED: [],
  ESCALATED: [
    CaseStatus.REQUIRES_HUMAN_REVIEW,
    CaseStatus.BARRIER_IDENTIFIED,
    CaseStatus.INTERVENTION_RECOMMENDED,
    CaseStatus.INTERVENTION_IN_PROGRESS,
    CaseStatus.APPOINTMENT_SCHEDULED,
    CaseStatus.BLOCKED,
    CaseStatus.LOST_TO_FOLLOW_UP,
    CaseStatus.CLOSED,
  ],
  BLOCKED: [
    CaseStatus.TRIAGED,
    CaseStatus.BARRIER_IDENTIFIED,
    CaseStatus.INTERVENTION_RECOMMENDED,
    CaseStatus.INTERVENTION_IN_PROGRESS,
    CaseStatus.REQUIRES_HUMAN_REVIEW,
    CaseStatus.ESCALATED,
    CaseStatus.LOST_TO_FOLLOW_UP,
    CaseStatus.CLOSED,
  ],
  REQUIRES_HUMAN_REVIEW: [
    CaseStatus.TRIAGED,
    CaseStatus.BARRIER_IDENTIFIED,
    CaseStatus.INTERVENTION_RECOMMENDED,
    CaseStatus.INTERVENTION_IN_PROGRESS,
    CaseStatus.APPOINTMENT_SCHEDULED,
    CaseStatus.APPOINTMENT_CONFIRMED,
    CaseStatus.VERIFIED,
    CaseStatus.ESCALATED,
    CaseStatus.BLOCKED,
    CaseStatus.LOST_TO_FOLLOW_UP,
    CaseStatus.CLOSED,
  ],
  LOST_TO_FOLLOW_UP: [
    CaseStatus.INTERVENTION_IN_PROGRESS,
    CaseStatus.REQUIRES_HUMAN_REVIEW,
    CaseStatus.CLOSED,
  ],
};

export function canTransitionCaseStatus(fromStatus: CaseStatus, toStatus: CaseStatus): boolean {
  if (fromStatus === toStatus) return false;
  return ALLOWED_CASE_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

export function assertCaseTransition(fromStatus: CaseStatus, toStatus: CaseStatus): void {
  if (!canTransitionCaseStatus(fromStatus, toStatus)) {
    throw new InvalidStateTransitionError(
      fromStatus,
      toStatus,
      `Allowed next states: ${ALLOWED_CASE_TRANSITIONS[fromStatus].join(", ") || "none (terminal)"}`
    );
  }
}

export function validateAgentProposedTransition(
  currentStatus: CaseStatus,
  proposedNextStatus: CaseStatus | null | undefined
): { valid: true; nextStatus: CaseStatus | null; reason: string } {
  if (!proposedNextStatus || proposedNextStatus === currentStatus) {
    return {
      valid: true,
      nextStatus: null,
      reason: `Case stays in ${currentStatus}; no state change proposed.`,
    };
  }
  assertCaseTransition(currentStatus, proposedNextStatus);
  return {
    valid: true,
    nextStatus: proposedNextStatus,
    reason: `Validated state transition ${currentStatus} -> ${proposedNextStatus}.`,
  };
}

export function getAllowedNextCaseStatuses(status: CaseStatus): readonly CaseStatus[] {
  return ALLOWED_CASE_TRANSITIONS[status] ?? [];
}

export const CASE_STATUS_METADATA: Record<
  CaseStatus,
  { label: string; tone: "neutral" | "info" | "warning" | "danger" | "success" }
> = {
  NEW: { label: "New", tone: "neutral" },
  TRIAGED: { label: "Triaged", tone: "info" },
  BARRIER_IDENTIFIED: { label: "Barrier Identified", tone: "warning" },
  INTERVENTION_RECOMMENDED: { label: "Intervention Recommended", tone: "info" },
  INTERVENTION_IN_PROGRESS: { label: "Intervention In Progress", tone: "info" },
  APPOINTMENT_SCHEDULED: { label: "Appointment Scheduled", tone: "info" },
  APPOINTMENT_CONFIRMED: { label: "Appointment Confirmed", tone: "success" },
  APPOINTMENT_COMPLETED: { label: "Appointment Completed", tone: "success" },
  VERIFIED: { label: "Verified", tone: "success" },
  CLOSED: { label: "Closed", tone: "neutral" },
  ESCALATED: { label: "Escalated", tone: "danger" },
  BLOCKED: { label: "Blocked", tone: "danger" },
  REQUIRES_HUMAN_REVIEW: { label: "Requires Human Review", tone: "warning" },
  LOST_TO_FOLLOW_UP: { label: "Lost to Follow-Up", tone: "danger" },
};

export const DEFAULT_CASE_GOAL =
  "Complete the member's behavioral-health referral through a verified first visit.";

export function buildCaseGoal(params?: { specialty?: string | null }): string {
  const spec = params?.specialty?.trim();
  if (!spec || spec.toLowerCase() === "behavioral health") {
    return DEFAULT_CASE_GOAL;
  }
  return `Complete the member's ${spec} referral through a verified first visit.`;
}

export type CaseState = CaseStatus | "PROVIDER_SEARCH" | "PROVIDER_SELECTED" | "COMPLETED";

export interface Transition {
  from: CaseState;
  to: CaseState;
  evidenceVerified?: boolean;
  prerequisitesMet?: boolean;
  reason?: string;
}

export interface TransitionRule {
  from: CaseState;
  to: CaseState;
  requiresVerifiedEvidence?: boolean;
  requiresPrerequisites?: boolean;
  description: string;
}

export interface TransitionValidationResult {
  valid: boolean;
  from: CaseState;
  to: CaseState;
  reason: string;
  matchedRule?: TransitionRule;
}

export interface TransitionValidator {
  validate(transition: Transition): TransitionValidationResult;
  assertValid(transition: Transition): TransitionRule;
}

const PRISMA_STATUS_SET = new Set<string>(Object.values(CaseStatus));

export const CASE_TRANSITION_RULES: TransitionRule[] = [
  ...Object.entries(ALLOWED_CASE_TRANSITIONS).flatMap(([from, targets]) =>
    targets.map((to) => ({
      from: from as CaseState,
      to: to as CaseState,
      requiresVerifiedEvidence: to === CaseStatus.VERIFIED || to === CaseStatus.CLOSED,
      description: `Standard workflow transition ${from} -> ${to}`,
    }))
  ),
  {
    from: "PROVIDER_SEARCH",
    to: "PROVIDER_SELECTED",
    description: "Provider search matched an eligible in-network provider.",
  },
  {
    from: "PROVIDER_SELECTED",
    to: CaseStatus.APPOINTMENT_SCHEDULED,
    requiresPrerequisites: true,
    description: "Selected provider with verified slot schedules appointment.",
  },
  {
    from: CaseStatus.APPOINTMENT_CONFIRMED,
    to: "COMPLETED",
    requiresVerifiedEvidence: true,
    description: "Confirmed appointment completed with attendance evidence.",
  },
  {
    from: "COMPLETED",
    to: CaseStatus.VERIFIED,
    requiresVerifiedEvidence: true,
    description: "Completed visit verified by multi-signal confirmation.",
  },
];

export class DeterministicTransitionValidator implements TransitionValidator {
  validate(transition: Transition): TransitionValidationResult {
    if (transition.from === transition.to) {
      return {
        valid: false,
        from: transition.from,
        to: transition.to,
        reason: `Self-transition ${transition.from} -> ${transition.to} is not permitted.`,
      };
    }

    // Special guard: jumping directly from NEW to COMPLETED / VERIFIED / CLOSED
    // is rejected unless explicit verified evidence AND transition prerequisites exist.
    if (
      transition.from === CaseStatus.NEW &&
      (transition.to === "COMPLETED" ||
        transition.to === CaseStatus.APPOINTMENT_COMPLETED ||
        transition.to === CaseStatus.VERIFIED ||
        transition.to === CaseStatus.CLOSED)
    ) {
      if (transition.evidenceVerified === true && transition.prerequisitesMet === true) {
        const overrideRule: TransitionRule = {
          from: transition.from,
          to: transition.to,
          requiresVerifiedEvidence: true,
          requiresPrerequisites: true,
          description: "Explicitly verified evidence & prerequisites satisfied for fast-track completion.",
        };
        return {
          valid: true,
          from: transition.from,
          to: transition.to,
          reason: overrideRule.description,
          matchedRule: overrideRule,
        };
      }
      return {
        valid: false,
        from: transition.from,
        to: transition.to,
        reason: `Transition ${transition.from} -> ${transition.to} rejected: explicit verified evidence and transition prerequisites are required.`,
      };
    }

    const matchedRule = CASE_TRANSITION_RULES.find(
      (rule) => rule.from === transition.from && rule.to === transition.to
    );

    if (!matchedRule) {
      const allowed = PRISMA_STATUS_SET.has(transition.from)
        ? ALLOWED_CASE_TRANSITIONS[transition.from as CaseStatus].join(", ") || "none (terminal)"
        : CASE_TRANSITION_RULES.filter((r) => r.from === transition.from)
            .map((r) => r.to)
            .join(", ") || "none (terminal)";
      return {
        valid: false,
        from: transition.from,
        to: transition.to,
        reason: `Invalid transition ${transition.from} -> ${transition.to}. Allowed next states: ${allowed}`,
      };
    }

    if (
      matchedRule.requiresVerifiedEvidence &&
      transition.evidenceVerified === false
    ) {
      return {
        valid: false,
        from: transition.from,
        to: transition.to,
        reason: `Transition ${transition.from} -> ${transition.to} requires verified evidence.`,
      };
    }

    if (
      matchedRule.requiresPrerequisites &&
      transition.prerequisitesMet === false
    ) {
      return {
        valid: false,
        from: transition.from,
        to: transition.to,
        reason: `Transition ${transition.from} -> ${transition.to} requires transition prerequisites.`,
      };
    }

    return {
      valid: true,
      from: transition.from,
      to: transition.to,
      reason: matchedRule.description,
      matchedRule,
    };
  }

  assertValid(transition: Transition): TransitionRule {
    const result = this.validate(transition);
    if (!result.valid || !result.matchedRule) {
      throw new InvalidStateTransitionError(
        result.from,
        result.to,
        result.reason
      );
    }
    return result.matchedRule;
  }
}

export class CaseStateDomainService {
  constructor(
    private readonly validator: TransitionValidator = new DeterministicTransitionValidator()
  ) {}

  validateTransition(transition: Transition): TransitionValidationResult {
    return this.validator.validate(transition);
  }

  executeTransition(transition: Transition): {
    from: CaseState;
    to: CaseState;
    rule: TransitionRule;
    transitionedAt: string;
  } {
    const rule = this.validator.assertValid(transition);
    return {
      from: transition.from,
      to: transition.to,
      rule,
      transitionedAt: new Date().toISOString(),
    };
  }
}

export const deterministicTransitionValidator = new DeterministicTransitionValidator();
export const caseStateDomainService = new CaseStateDomainService(deterministicTransitionValidator);
