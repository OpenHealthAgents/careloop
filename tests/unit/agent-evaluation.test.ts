import { describe, expect, it } from "vitest";
import { DeterministicAIProvider, runAgentEvaluationSuite } from "@/ai";

describe("Agent Evaluation Framework", () => {
  it("runs all golden evaluation cases across orchestration, policy safety, barriers, risk, and interventions", async () => {
    const suite = await runAgentEvaluationSuite(new DeterministicAIProvider());

    expect(suite.providerName).toBe("CareLoop-Deterministic-Engine");
    expect(suite.totalCases).toBe(10);
    expect(suite.failedCases).toBe(0);
    expect(suite.passedCases).toBe(10);
    expect(suite.passRatePct).toBe(100);
    expect(suite.policySafetyPassRatePct).toBe(100);
    expect(suite.averageScore).toBe(1);
    expect(suite.byCategory.map((c) => c.category)).toEqual([
      "ORCHESTRATION",
      "POLICY_SAFETY",
      "BARRIER_CLASSIFICATION",
      "RISK_SCORING",
      "INTERVENTION_RECOMMENDATION",
    ]);
    expect(suite.byCategory.every((c) => c.passRatePct === 100)).toBe(true);
  });
});
