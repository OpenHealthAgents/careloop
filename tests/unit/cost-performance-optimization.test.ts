import { describe, expect, it } from "vitest";
import {
  batchExecute,
  computeCostAndPerformanceMetrics,
  computeJitteredBackoff,
  detectAmbiguousReasoningNeed,
  evaluateDeterministicBarrierShortcut,
  executeWithRetryAndTimeout,
  isDeterministicEligible,
  isRetryableError,
  OperationTimeoutError,
  routeModelTier,
  SafeAICache,
} from "@/lib/optimization";
import { ValidationError } from "@/lib/errors";

describe("Cost and Performance Optimization Engine", () => {
  // 1. MEASUREMENT: LLM calls, tokens, tool calls, latency, human time, cost per completed referral
  it("computes comprehensive cost & performance metrics per case and per completed referral", () => {
    const now = new Date();
    const metrics = computeCostAndPerformanceMetrics({
      totalCases: 10,
      verifiedCompletedCases: 8,
      agentRuns: [
        {
          latencyMs: 1200,
          promptTokens: 4000,
          completionTokens: 800,
          totalTokens: 4800,
          model: "gpt-4o-mini",
          status: "COMPLETED",
        },
        {
          latencyMs: 3500,
          promptTokens: 8000,
          completionTokens: 1200,
          totalTokens: 9200,
          model: "gpt-4o", // larger model for ambiguous case
          status: "COMPLETED",
        },
      ],
      decisionTraces: [
        { id: "trace-1", model: "gpt-4o-mini", humanApprovalRequired: false },
        { id: "trace-2", model: "gpt-4o", humanApprovalRequired: true },
      ],
      toolSpans: [
        { latencyMs: 150, status: "SUCCEEDED", retryCount: 0 },
        { latencyMs: 220, status: "SUCCEEDED", retryCount: 1 },
        { latencyMs: 80, status: "SUCCEEDED", retryCount: 0 },
      ],
      approvals: [
        {
          requestedAt: new Date(now.getTime() - 30 * 60 * 1000), // 30m ago
          approvedAt: now,
          status: "APPROVED",
        },
      ],
      careManagerHourlyWageDollars: 45.0, // $0.75/min
    });

    // 1. LLM calls per case
    expect(metrics.llm_calls_per_case.total_llm_calls).toBe(2);
    expect(metrics.llm_calls_per_case.average_llm_calls_per_case).toBe(0.2);

    // 2. Tokens per case
    expect(metrics.tokens_per_case.total_tokens).toBe(14000);
    expect(metrics.tokens_per_case.total_tokens_per_case).toBe(1400);
    expect(metrics.tokens_per_case.prompt_tokens_per_case).toBe(1200);
    expect(metrics.tokens_per_case.completion_tokens_per_case).toBe(200);

    // 3. Tool calls per case
    expect(metrics.tool_calls_per_case.total_tool_calls).toBe(3);
    expect(metrics.tool_calls_per_case.average_tool_calls_per_case).toBe(0.3);

    // 4. Latency
    expect(metrics.latency.avg_latency_ms).toBeGreaterThan(0);
    expect(metrics.latency.p50_latency_ms).toBeGreaterThan(0);
    expect(metrics.latency.p95_latency_ms).toBeGreaterThanOrEqual(metrics.latency.p50_latency_ms);
    expect(metrics.latency.agent_avg_latency_ms).toBe(2350);
    expect(metrics.latency.tool_avg_latency_ms).toBe(150);

    // 5. Human time
    expect(metrics.human_time.total_approvals).toBe(1);
    expect(metrics.human_time.avg_approval_turnaround_minutes).toBe(30);
    expect(metrics.human_time.estimated_active_human_minutes_per_case).toBe(3.5); // (1*5 + 10*3)/10

    // 6. Cost per completed referral
    expect(metrics.cost_per_completed_referral.verified_completed_referrals).toBe(8);
    expect(metrics.cost_per_completed_referral.total_cost_dollars).toBeGreaterThan(0);
    expect(metrics.cost_per_completed_referral.cost_per_completed_referral_dollars).toBeGreaterThan(0);
    expect(metrics.cost_per_completed_referral.cost_per_case_dollars).toBeGreaterThan(0);

    // 7. Optimization savings
    expect(metrics.optimization_savings.tokens_saved_by_deterministic_shortcuts).toBe(15000);
    expect(metrics.optimization_savings.dollars_saved_by_small_models).toBeGreaterThanOrEqual(0);
  });

  // 2. CACHING WHERE SAFE
  it("enforces safe AI caching: eliminates redundant calls and tracks token/cost savings", () => {
    const cache = new SafeAICache({ defaultTtlMs: 500 });
    const tenantId = "tenant-opt-1";
    const op = "CLASSIFY_BARRIER";
    const payload = { referralId: "ref-1", need: "Counseling" };

    const key = cache.computeKey(tenantId, op, payload);

    // Initial miss
    expect(cache.get(key)).toBeNull();
    let stats = cache.getStats();
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(0);

    // Store in cache
    const mockOutput = { category: "ACCESS", subBarrier: "NO_NETWORK_PROVIDERS" };
    cache.set(key, mockOutput, op, 1500);

    // Second call is a cache hit (0 tokens, < 2ms)
    const cached = cache.get<typeof mockOutput>(key);
    expect(cached).toEqual(mockOutput);

    stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.hitRate).toBe(0.5);
    expect(stats.tokensSaved).toBe(1500);
    expect(stats.estimatedCostSavingsDollars).toBeGreaterThan(0);

    // Invalidation
    cache.invalidate(key);
    expect(cache.get(key)).toBeNull();
  });

  // 3. DETERMINISTIC SHORTCUTS: "Do not use an LLM when deterministic code is sufficient"
  it("uses deterministic shortcuts for unambiguous cases, avoiding unnecessary LLM calls", () => {
    // A: Transit barrier explicitly in notes -> Deterministic shortcut taken
    const transitInput: any = {
      referralId: "ref-t1",
      operationalNotes: "Member cannot get to clinic due to bus line changes and lack of reliable transit.",
      verifiedAvailableSlotsCount: 5,
      matchingProvidersCount: 3,
      member: { transportationAccess: "UNKNOWN", priorNoShowCount: 0 },
    };
    const transitEval = evaluateDeterministicBarrierShortcut(transitInput);
    expect(transitEval.canUseDeterministicShortcut).toBe(true);
    expect(transitEval.recommendedModelTier).toBe("DETERMINISTIC");
    expect(transitEval.reason).toContain("NO_RELIABLE_TRANSIT");

    // B: Zero open slots available -> Deterministic network capacity shortcut
    const capacityInput: any = {
      referralId: "ref-c1",
      operationalNotes: "Routine referral",
      verifiedAvailableSlotsCount: 0,
      matchingProvidersCount: 0,
      member: { transportationAccess: "PERSONAL_VEHICLE", priorNoShowCount: 0 },
    };
    const capacityEval = evaluateDeterministicBarrierShortcut(capacityInput);
    expect(capacityEval.canUseDeterministicShortcut).toBe(true);
    expect(capacityEval.recommendedModelTier).toBe("DETERMINISTIC");
    expect(capacityEval.reason).toContain("Network capacity");

    // C: High prior no-show counts -> Deterministic engagement gap shortcut
    const noShowInput: any = {
      referralId: "ref-ns",
      operationalNotes: "Routine follow-up",
      verifiedAvailableSlotsCount: 3,
      matchingProvidersCount: 2,
      member: { transportationAccess: "PERSONAL_VEHICLE", priorNoShowCount: 3 },
    };
    const noShowEval = evaluateDeterministicBarrierShortcut(noShowInput);
    expect(noShowEval.canUseDeterministicShortcut).toBe(true);
    expect(noShowEval.recommendedModelTier).toBe("DETERMINISTIC");

    // D: Mathematical risk scoring and provider ranking are ALWAYS deterministic eligible
    expect(isDeterministicEligible("CALCULATE_RISK", {})).toBe(true);
    expect(isDeterministicEligible("MATCH_PROVIDER", {})).toBe(true);
    expect(isDeterministicEligible("RECOMMEND_INTERVENTION", {})).toBe(true);
  });

  // 4. SMALLER MODELS FOR SIMPLE TASKS vs LARGER MODELS ONLY FOR AMBIGUOUS REASONING
  it("routes simple tasks to small models, reserving larger models strictly for ambiguous reasoning", () => {
    // 1. Simple task (drafting communication) -> Small model (gpt-4o-mini)
    const commRouting = routeModelTier("GENERATE_COMMUNICATION");
    expect(commRouting.tier).toBe("SMALL_MODEL");
    expect(commRouting.selectedModel).toBe("gpt-4o-mini");
    expect(commRouting.isAmbiguous).toBe(false);

    // 2. Simple operational summary -> Small model (gpt-4o-mini)
    const summaryRouting = routeModelTier("SUMMARIZE_CASE");
    expect(summaryRouting.tier).toBe("SMALL_MODEL");
    expect(summaryRouting.selectedModel).toBe("gpt-4o-mini");

    // 3. Ambiguous reasoning detected (conflicting evidence signals) -> Large model (gpt-4o)
    const ambiguousConflicting = routeModelTier("CLASSIFY_BARRIER", {
      conflictingEvidenceCount: 2,
    });
    expect(ambiguousConflicting.tier).toBe("LARGE_MODEL");
    expect(ambiguousConflicting.selectedModel).toBe("gpt-4o");
    expect(ambiguousConflicting.isAmbiguous).toBe(true);
    expect(ambiguousConflicting.reason).toContain("semantic disambiguation");

    // 4. Ambiguous specialty description -> Large model
    const ambiguousSpecialty = routeModelTier("CLASSIFY_BARRIER", {
      hasAmbiguousSpecialty: true,
    });
    expect(ambiguousSpecialty.tier).toBe("LARGE_MODEL");

    // 5. Low confidence (< 0.70) in initial screening -> Escalate to Large model
    expect(detectAmbiguousReasoningNeed("CLASSIFY_BARRIER", { confidenceScoreThreshold: 0.65 })).toBe(true);
    expect(detectAmbiguousReasoningNeed("CLASSIFY_BARRIER", { confidenceScoreThreshold: 0.85 })).toBe(false);
  });

  // 5. BATCHING
  it("processes bulk items in controlled concurrent batches", async () => {
    const items = [10, 20, 30, 40, 50, 60, 70];
    const processed = await batchExecute(
      items,
      async (item) => {
        return item * 2;
      },
      { concurrency: 3 }
    );

    expect(processed.total).toBe(7);
    expect(processed.succeeded).toBe(7);
    expect(processed.failed).toBe(0);
    expect(processed.results.map((r) => r.data)).toEqual([20, 40, 60, 80, 100, 120, 140]);
  });

  // 6. RETRY POLICIES WITH JITTER & TIMEOUTS
  it("enforces exponential backoff with jitter and timeout enforcement", async () => {
    // Jittered backoff is strictly positive and bounded
    for (let i = 0; i < 5; i++) {
      const delay = computeJitteredBackoff(i, 100, 2000);
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(2000);
    }

    // Identifies retryable vs non-retryable errors
    expect(isRetryableError(new Error("Rate limit exceeded 429"))).toBe(true);
    expect(isRetryableError(new Error("HTTP 503 Service Unavailable"))).toBe(true);
    expect(isRetryableError(new ValidationError("Invalid input format"))).toBe(false);

    // Timeout aborts hanging operation
    await expect(
      executeWithRetryAndTimeout(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return "ok";
        },
        { timeoutMs: 50, maxAttempts: 1, operationName: "test_slow_call" }
      )
    ).rejects.toThrow(OperationTimeoutError);

    // Retries on transient failure then succeeds
    let attempts = 0;
    const result = await executeWithRetryAndTimeout(
      async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error("HTTP 503 transient error");
        }
        return "success_after_retry";
      },
      { baseDelayMs: 10, maxAttempts: 3 }
    );
    expect(result).toBe("success_after_retry");
    expect(attempts).toBe(2);
  });
});
