import { describe, expect, it } from "vitest";
import { CaseStatus } from "@prisma/client";
import {
  runSimulatedCase,
  runSimulationBatch,
  SIMULATION_SCENARIOS,
} from "@/simulation/healthcare-simulator";

describe("Agent Simulation Environment (Zero-PHI Synthetic Healthcare World)", () => {
  it("executes all 11 required healthcare simulation scenarios accurately without real PHI", async () => {
    const providerAvailable = await runSimulatedCase({
      caseIndex: 1,
      scenario: "provider_available",
      seed: 101,
    });
    expect(providerAvailable.zeroPhiGuaranteed).toBe(true);
    expect(providerAvailable.world.containsRealPhi).toBe(false);
    expect(providerAvailable.world.member.containsRealPhi).toBe(false);
    expect(providerAvailable.terminalOutcome).toBe("GOAL_ACHIEVED");
    expect(providerAvailable.finalState).toBe(CaseStatus.CLOSED);

    const providerUnavailable = await runSimulatedCase({
      caseIndex: 2,
      scenario: "provider_unavailable",
      seed: 102,
    });
    expect(providerUnavailable.humanEscalated).toBe(true);
    expect(providerUnavailable.completionProven).toBe(false);
    expect(providerUnavailable.world.failures.some((f) => f.stage === "PROVIDER_SEARCH")).toBe(true);

    const memberResponds = await runSimulatedCase({
      caseIndex: 3,
      scenario: "member_responds",
      seed: 103,
    });
    expect(memberResponds.terminalOutcome).toBe("GOAL_ACHIEVED");

    const memberDoesNotRespond = await runSimulatedCase({
      caseIndex: 4,
      scenario: "member_does_not_respond",
      seed: 104,
    });
    expect(memberDoesNotRespond.completionProven).toBe(false);
    expect(memberDoesNotRespond.finalState).not.toBe(CaseStatus.CLOSED);

    const memberRequestsDifferent = await runSimulatedCase({
      caseIndex: 5,
      scenario: "member_requests_different_provider",
      seed: 105,
    });
    expect(memberRequestsDifferent.world.rejectedProviderIds.length).toBeGreaterThanOrEqual(1);
    expect(
      memberRequestsDifferent.world.communications.some(
        (c) => c.responseType === "REQUESTS_DIFFERENT_PROVIDER"
      )
    ).toBe(true);

    const schedulingFails = await runSimulatedCase({
      caseIndex: 6,
      scenario: "scheduling_fails",
      seed: 106,
    });
    expect(schedulingFails.world.failures.some((f) => f.stage === "SCHEDULING")).toBe(true);
    expect(schedulingFails.humanEscalated).toBe(true);

    const appointmentCancelled = await runSimulatedCase({
      caseIndex: 7,
      scenario: "appointment_cancelled",
      seed: 107,
    });
    expect(appointmentCancelled.world.appointments.some((a) => a.status === "CANCELLED")).toBe(true);
    expect(appointmentCancelled.world.barriers.length).toBeGreaterThanOrEqual(1);

    const appointmentCompleted = await runSimulatedCase({
      caseIndex: 8,
      scenario: "appointment_completed",
      seed: 108,
    });
    expect(appointmentCompleted.completionProven).toBe(true);
    expect(appointmentCompleted.terminalOutcome).toBe("GOAL_ACHIEVED");
    expect(appointmentCompleted.finalState).toBe(CaseStatus.CLOSED);

    const claimArrives = await runSimulatedCase({
      caseIndex: 9,
      scenario: "claim_arrives",
      seed: 109,
    });
    expect(claimArrives.world.claims.some((c) => c.status === "PAID")).toBe(true);
    expect(claimArrives.completionProven).toBe(true);
    expect(claimArrives.terminalOutcome).toBe("GOAL_ACHIEVED");
    expect(claimArrives.finalState).toBe(CaseStatus.CLOSED);

    const evidenceConflicts = await runSimulatedCase({
      caseIndex: 10,
      scenario: "evidence_conflicts",
      seed: 110,
    });
    expect(evidenceConflicts.hasEvidenceConflict).toBe(true);
    expect(evidenceConflicts.completionProven).toBe(false);
    expect(evidenceConflicts.humanEscalated).toBe(true);
    expect(evidenceConflicts.finalState).not.toBe(CaseStatus.CLOSED);

    const humanApprovalRequired = await runSimulatedCase({
      caseIndex: 11,
      scenario: "human_approval_required",
      seed: 111,
    });
    expect(humanApprovalRequired.terminalOutcome).toBe("HUMAN_REQUIRED");
    expect(humanApprovalRequired.humanEscalated).toBe(true);
  });

  it("runs 1,500 synthetic cases deterministically without touching real PHI", async () => {
    const batch = await runSimulationBatch({
      count: 1500,
      seed: 2026,
      maxStepsPerCase: 8,
      sampleLimit: 5,
    });

    expect(batch.totalCases).toBe(1500);
    expect(batch.zeroPhiGuaranteed).toBe(true);
    expect(batch.sampleCases).toHaveLength(5);
    expect(batch.averageStepsPerCase).toBeGreaterThan(0);
    expect(batch.averageStepsPerCase).toBeLessThanOrEqual(8);
    expect(batch.completionRate).toBeGreaterThan(0);
    expect(batch.humanEscalationRate).toBeGreaterThan(0);
    expect(batch.conflictDetectionCount).toBeGreaterThan(0);

    for (const scenario of SIMULATION_SCENARIOS) {
      expect(batch.scenariosCovered[scenario]).toBeGreaterThan(0);
    }

    // Reproducibility check with same seed
    const batchReplay = await runSimulationBatch({
      count: 1500,
      seed: 2026,
      maxStepsPerCase: 8,
      sampleLimit: 5,
    });
    expect(batchReplay.outcomesByStatus).toEqual(batch.outcomesByStatus);
    expect(batchReplay.scenariosCovered).toEqual(batch.scenariosCovered);
  });
});
