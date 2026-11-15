import { describe, expect, it } from "vitest";
import {
  AGENT_EVAL_DATASET,
  compareEvaluationRuns,
  evaluateAgentTraceSuite,
  EvalScenarioKind,
} from "@/evaluation/agent-eval-framework";

describe("Trace-Based Agent Evaluation Framework", () => {
  const REQUIRED_SCENARIOS: EvalScenarioKind[] = [
    "happy_path",
    "missing_information",
    "ambiguous_barriers",
    "provider_unavailable",
    "scheduling_failure",
    "member_unreachable",
    "member_declines",
    "appointment_cancelled",
    "appointment_no_show",
    "human_approval",
    "policy_denial",
    "tool_failure",
    "duplicate_events",
    "stale_data",
    "conflicting_evidence",
  ];

  it("covers all 15 required scenarios and evaluates all 9 trace dimensions", async () => {
    const kinds = AGENT_EVAL_DATASET.map((s) => s.scenarioKind);
    for (const req of REQUIRED_SCENARIOS) {
      expect(kinds).toContain(req);
    }

    const suite = await evaluateAgentTraceSuite();
    expect(suite.totalCases).toBe(15);
    expect(suite.failedCases).toBe(0);
    expect(suite.passRatePct).toBe(100);
    expect(suite.toolUseQuality.toolSelectionAccuracyPct).toBe(100);
    expect(suite.toolUseQuality.policyComplianceRatePct).toBe(100);
    expect(suite.taskSuccess.completionAccuracyPct).toBe(100);
    expect(suite.taskSuccess.barrierAccuracyPct).toBe(100);
    expect(suite.taskSuccess.humanEscalationAccuracyPct).toBe(100);
    expect(suite.taskSuccess.evidenceGroundingPct).toBe(100);
    expect(suite.taskSuccess.stateCorrectnessPct).toBe(100);
    expect(suite.failureAnalysis).toEqual([]);
  });

  it("supports regression comparison and failure analysis when a scenario regresses", async () => {
    const baseline = await evaluateAgentTraceSuite();
    const regressed = structuredClone(baseline);
    regressed.results[0].passed = false;
    regressed.results[0].score = 0.778;
    regressed.results[0].dimensions.toolSelection = false;
    regressed.results[0].failureReasons = ["Simulated tool selection regression"];
    regressed.passedCases = 14;
    regressed.failedCases = 1;
    regressed.passRatePct = 93.3;
    regressed.averageScore = 0.985;
    regressed.dimensionPassRates.toolSelection = 93.3;

    const comparison = compareEvaluationRuns(baseline, regressed);
    expect(comparison.regressionDetected).toBe(true);
    expect(comparison.passRateDeltaPctPts).toBeLessThan(0);
    expect(comparison.newlyFailedScenarios).toContain(baseline.results[0].id);
    expect(comparison.dimensionDeltas.toolSelection).toBeLessThan(0);
  });
});
