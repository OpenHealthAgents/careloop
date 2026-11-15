import { describe, expect, it } from "vitest";
import { CaseStatus } from "@prisma/client";
import {
  assertCaseTransition,
  canTransitionCaseStatus,
  CASE_SIDE_STATES,
  CASE_STATUS_ORDER,
  CASE_TRANSITION_RULES,
  caseStateDomainService,
  deterministicTransitionValidator,
  getAllowedNextCaseStatuses,
  validateAgentProposedTransition,
} from "@/domain/cases/state-machine";
import { InvalidStateTransitionError } from "@/lib/errors";

describe("CareCase Workflow State Machine", () => {
  it("defines all 10 primary states and 4 additional side states", () => {
    expect(CASE_STATUS_ORDER).toEqual([
      "NEW",
      "TRIAGED",
      "BARRIER_IDENTIFIED",
      "INTERVENTION_RECOMMENDED",
      "INTERVENTION_IN_PROGRESS",
      "APPOINTMENT_SCHEDULED",
      "APPOINTMENT_CONFIRMED",
      "APPOINTMENT_COMPLETED",
      "VERIFIED",
      "CLOSED",
    ]);
    expect(CASE_SIDE_STATES).toEqual([
      "ESCALATED",
      "BLOCKED",
      "REQUIRES_HUMAN_REVIEW",
      "LOST_TO_FOLLOW_UP",
    ]);
  });

  it("allows standard happy-path progression from NEW to CLOSED", () => {
    const chain: CaseStatus[] = [
      "NEW",
      "TRIAGED",
      "BARRIER_IDENTIFIED",
      "INTERVENTION_RECOMMENDED",
      "INTERVENTION_IN_PROGRESS",
      "APPOINTMENT_SCHEDULED",
      "APPOINTMENT_CONFIRMED",
      "APPOINTMENT_COMPLETED",
      "VERIFIED",
      "CLOSED",
    ];
    for (let i = 0; i < chain.length - 1; i++) {
      expect(canTransitionCaseStatus(chain[i], chain[i + 1])).toBe(true);
      expect(() => assertCaseTransition(chain[i], chain[i + 1])).not.toThrow();
    }
  });

  it("supports escalation and recovery back into workflow", () => {
    expect(canTransitionCaseStatus("INTERVENTION_IN_PROGRESS", "ESCALATED")).toBe(true);
    expect(canTransitionCaseStatus("ESCALATED", "INTERVENTION_IN_PROGRESS")).toBe(true);
    expect(canTransitionCaseStatus("APPOINTMENT_CONFIRMED", "LOST_TO_FOLLOW_UP")).toBe(true);
    expect(canTransitionCaseStatus("BLOCKED", "BARRIER_IDENTIFIED")).toBe(true);
  });

  it("rejects invalid transitions and terminal mutations", () => {
    expect(canTransitionCaseStatus("NEW", "VERIFIED")).toBe(false);
    expect(() => assertCaseTransition("NEW", "CLOSED")).toThrow(InvalidStateTransitionError);
    expect(getAllowedNextCaseStatuses("CLOSED")).toEqual([]);
    expect(() => assertCaseTransition("CLOSED", "NEW")).toThrow(InvalidStateTransitionError);

    expect(validateAgentProposedTransition("NEW", "TRIAGED")).toEqual({
      valid: true,
      nextStatus: "TRIAGED",
      reason: "Validated state transition NEW -> TRIAGED.",
    });
    expect(validateAgentProposedTransition("TRIAGED", null).nextStatus).toBeNull();
    expect(() => validateAgentProposedTransition("NEW", "CLOSED")).toThrow(
      InvalidStateTransitionError
    );
  });

  it("validates TransitionRules via TransitionValidator and CaseStateDomainService", () => {
    expect(CASE_TRANSITION_RULES.length).toBeGreaterThan(20);

    // Valid: PROVIDER_SEARCH -> PROVIDER_SELECTED
    const providerMatch = deterministicTransitionValidator.validate({
      from: "PROVIDER_SEARCH",
      to: "PROVIDER_SELECTED",
    });
    expect(providerMatch.valid).toBe(true);

    const executed = caseStateDomainService.executeTransition({
      from: "PROVIDER_SEARCH",
      to: "PROVIDER_SELECTED",
    });
    expect(executed.from).toBe("PROVIDER_SEARCH");
    expect(executed.to).toBe("PROVIDER_SELECTED");

    // Rejected: NEW -> COMPLETED without explicit verified evidence & prerequisites
    const invalidFastTrack = deterministicTransitionValidator.validate({
      from: CaseStatus.NEW,
      to: "COMPLETED",
    });
    expect(invalidFastTrack.valid).toBe(false);
    expect(() =>
      caseStateDomainService.executeTransition({
        from: CaseStatus.NEW,
        to: "COMPLETED",
      })
    ).toThrow(InvalidStateTransitionError);

    // Allowed only when explicit verified evidence AND prerequisites exist
    const validFastTrack = caseStateDomainService.executeTransition({
      from: CaseStatus.NEW,
      to: "COMPLETED",
      evidenceVerified: true,
      prerequisitesMet: true,
    });
    expect(validFastTrack.to).toBe("COMPLETED");

    // Evidence guard on VERIFIED -> CLOSED when evidenceVerified is explicitly false
    expect(() =>
      caseStateDomainService.executeTransition({
        from: CaseStatus.VERIFIED,
        to: CaseStatus.CLOSED,
        evidenceVerified: false,
      })
    ).toThrow(InvalidStateTransitionError);

    // Terminal CLOSED rejects transitions
    expect(() =>
      caseStateDomainService.executeTransition({
        from: CaseStatus.CLOSED,
        to: CaseStatus.TRIAGED,
      })
    ).toThrow(InvalidStateTransitionError);
  });
});
