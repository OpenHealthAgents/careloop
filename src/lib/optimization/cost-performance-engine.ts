import { safeAICache } from "./safe-ai-cache";
import { MODEL_PRICING } from "./tiered-model-router";

export interface ComputeCostPerformanceInput {
  totalCases: number;
  verifiedCompletedCases: number;
  agentRuns: Array<{
    latencyMs: number | null;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    model: string;
    status: string;
  }>;
  decisionTraces: Array<{
    id: string;
    model?: string;
    humanApprovalRequired?: boolean;
  }>;
  toolSpans: Array<{
    latencyMs: number;
    status: string;
    retryCount: number;
  }>;
  approvals: Array<{
    requestedAt: Date;
    approvedAt: Date | null;
    status: string;
  }>;
  careManagerHourlyWageDollars?: number;
}

export interface CostAndPerformanceMetrics {
  llm_calls_per_case: {
    total_llm_calls: number;
    total_cases: number;
    average_llm_calls_per_case: number;
  };
  tokens_per_case: {
    total_prompt_tokens: number;
    total_completion_tokens: number;
    total_tokens: number;
    prompt_tokens_per_case: number;
    completion_tokens_per_case: number;
    total_tokens_per_case: number;
  };
  tool_calls_per_case: {
    total_tool_calls: number;
    average_tool_calls_per_case: number;
  };
  latency: {
    avg_latency_ms: number;
    p50_latency_ms: number;
    p95_latency_ms: number;
    agent_avg_latency_ms: number;
    tool_avg_latency_ms: number;
  };
  human_time: {
    total_approvals: number;
    total_wait_hours: number;
    avg_approval_turnaround_minutes: number;
    estimated_active_human_minutes_per_case: number;
    human_in_the_loop_pct: number;
  };
  cost_per_completed_referral: {
    verified_completed_referrals: number;
    total_model_token_cost_dollars: number;
    total_human_labor_cost_dollars: number;
    total_tool_infra_cost_dollars: number;
    total_cost_dollars: number;
    cost_per_completed_referral_dollars: number;
    cost_per_case_dollars: number;
  };
  optimization_savings: {
    tokens_saved_by_deterministic_shortcuts: number;
    tokens_saved_by_caching: number;
    dollars_saved_by_small_models: number;
    total_estimated_savings_dollars: number;
    cache_hit_rate: number;
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * Computes all cost and performance metrics across cases, LLM calls, tools, latency, and human time.
 */
export function computeCostAndPerformanceMetrics(
  input: ComputeCostPerformanceInput
): CostAndPerformanceMetrics {
  const casesDenominator = Math.max(1, input.totalCases);
  const completedDenominator = Math.max(1, input.verifiedCompletedCases);
  const wagePerMinute = (input.careManagerHourlyWageDollars ?? 45.0) / 60.0;

  // 1. LLM calls per case
  const totalLlmCalls = input.decisionTraces.length;
  const averageLlmCallsPerCase = Number((totalLlmCalls / casesDenominator).toFixed(2));

  // 2. Tokens per case
  const totalPromptTokens = input.agentRuns.reduce((sum, r) => sum + r.promptTokens, 0);
  const totalCompletionTokens = input.agentRuns.reduce((sum, r) => sum + r.completionTokens, 0);
  const totalTokens = totalPromptTokens + totalCompletionTokens;

  const promptTokensPerCase = Math.round(totalPromptTokens / casesDenominator);
  const completionTokensPerCase = Math.round(totalCompletionTokens / casesDenominator);
  const totalTokensPerCase = Math.round(totalTokens / casesDenominator);

  // 3. Tool calls per case
  const totalToolCalls = input.toolSpans.length;
  const averageToolCallsPerCase = Number((totalToolCalls / casesDenominator).toFixed(2));

  // 4. Latency
  const agentLatencies = input.agentRuns
    .map((r) => r.latencyMs)
    .filter((v): v is number => typeof v === "number");
  const toolLatencies = input.toolSpans.map((s) => s.latencyMs);
  const allLatencies = [...agentLatencies, ...toolLatencies];

  const agentAvgLatencyMs = average(agentLatencies);
  const toolAvgLatencyMs = average(toolLatencies);
  const avgLatencyMs = average(allLatencies);
  const p50LatencyMs = percentile(allLatencies, 50);
  const p95LatencyMs = percentile(allLatencies, 95);

  // 5. Human time
  const approvalTurnaroundMinutes = input.approvals
    .filter((a) => a.approvedAt !== null)
    .map((a) => Math.max(0, (a.approvedAt!.getTime() - a.requestedAt.getTime()) / (1000 * 60)));

  const totalWaitMinutes = approvalTurnaroundMinutes.reduce((sum, m) => sum + m, 0);
  const totalWaitHours = Number((totalWaitMinutes / 60).toFixed(2));
  const avgApprovalTurnaroundMinutes =
    approvalTurnaroundMinutes.length > 0 ? average(approvalTurnaroundMinutes) : 0;

  // Active care manager review time (estimated 5 active minutes per human approval + 3 min per case)
  const estimatedActiveHumanMinutesPerCase = Number(
    (
      (input.approvals.length * 5 + input.totalCases * 3) /
      casesDenominator
    ).toFixed(1)
  );

  const humanInTheLoopPct = Number(
    (
      (input.decisionTraces.filter((t) => t.humanApprovalRequired).length /
        Math.max(1, input.decisionTraces.length)) *
      100
    ).toFixed(1)
  );

  // 6. Cost per completed referral
  // Token cost calculated by model tier
  let totalModelTokenCost = 0;
  for (const run of input.agentRuns) {
    const isLarge = run.model.includes("gpt-4o") && !run.model.includes("mini");
    const promptRate = isLarge
      ? MODEL_PRICING.LARGE_MODEL.promptPerMillionDollars
      : MODEL_PRICING.SMALL_MODEL.promptPerMillionDollars;
    const completionRate = isLarge
      ? MODEL_PRICING.LARGE_MODEL.completionPerMillionDollars
      : MODEL_PRICING.SMALL_MODEL.completionPerMillionDollars;

    totalModelTokenCost +=
      (run.promptTokens / 1_000_000) * promptRate +
      (run.completionTokens / 1_000_000) * completionRate;
  }

  const totalActiveHumanMinutes = input.approvals.length * 5 + input.totalCases * 3;
  const totalHumanLaborCost = Number((totalActiveHumanMinutes * wagePerMinute).toFixed(2));
  const totalToolInfraCost = Number((totalToolCalls * 0.0005).toFixed(4));
  const totalCost = Number((totalModelTokenCost + totalHumanLaborCost + totalToolInfraCost).toFixed(2));

  const costPerCompletedReferralDollars = Number((totalCost / completedDenominator).toFixed(2));
  const costPerCaseDollars = Number((totalCost / casesDenominator).toFixed(2));

  // 7. Savings breakdown
  const cacheStats = safeAICache.getStats();
  // Assume deterministic shortcuts save 1,500 tokens per referral triage
  const tokensSavedByDeterministicShortcuts = input.totalCases * 1500;
  // If large model was used for everything vs small model
  const largeModelCostEquiv =
    (totalPromptTokens / 1_000_000) * MODEL_PRICING.LARGE_MODEL.promptPerMillionDollars +
    (totalCompletionTokens / 1_000_000) * MODEL_PRICING.LARGE_MODEL.completionPerMillionDollars;
  const dollarsSavedBySmallModels = Number(Math.max(0, largeModelCostEquiv - totalModelTokenCost).toFixed(2));

  const totalEstimatedSavingsDollars = Number(
    (
      dollarsSavedBySmallModels +
      cacheStats.estimatedCostSavingsDollars +
      (tokensSavedByDeterministicShortcuts / 1_000_000) * 1.5
    ).toFixed(2)
  );

  return {
    llm_calls_per_case: {
      total_llm_calls: totalLlmCalls,
      total_cases: input.totalCases,
      average_llm_calls_per_case: averageLlmCallsPerCase,
    },
    tokens_per_case: {
      total_prompt_tokens: totalPromptTokens,
      total_completion_tokens: totalCompletionTokens,
      total_tokens: totalTokens,
      prompt_tokens_per_case: promptTokensPerCase,
      completion_tokens_per_case: completionTokensPerCase,
      total_tokens_per_case: totalTokensPerCase,
    },
    tool_calls_per_case: {
      total_tool_calls: totalToolCalls,
      average_tool_calls_per_case: averageToolCallsPerCase,
    },
    latency: {
      avg_latency_ms: avgLatencyMs,
      p50_latency_ms: p50LatencyMs,
      p95_latency_ms: p95LatencyMs,
      agent_avg_latency_ms: agentAvgLatencyMs,
      tool_avg_latency_ms: toolAvgLatencyMs,
    },
    human_time: {
      total_approvals: input.approvals.length,
      total_wait_hours: totalWaitHours,
      avg_approval_turnaround_minutes: avgApprovalTurnaroundMinutes,
      estimated_active_human_minutes_per_case: estimatedActiveHumanMinutesPerCase,
      human_in_the_loop_pct: humanInTheLoopPct,
    },
    cost_per_completed_referral: {
      verified_completed_referrals: input.verifiedCompletedCases,
      total_model_token_cost_dollars: Number(totalModelTokenCost.toFixed(4)),
      total_human_labor_cost_dollars: totalHumanLaborCost,
      total_tool_infra_cost_dollars: totalToolInfraCost,
      total_cost_dollars: totalCost,
      cost_per_completed_referral_dollars: costPerCompletedReferralDollars,
      cost_per_case_dollars: costPerCaseDollars,
    },
    optimization_savings: {
      tokens_saved_by_deterministic_shortcuts: tokensSavedByDeterministicShortcuts,
      tokens_saved_by_caching: cacheStats.tokensSaved,
      dollars_saved_by_small_models: dollarsSavedBySmallModels,
      total_estimated_savings_dollars: totalEstimatedSavingsDollars,
      cache_hit_rate: cacheStats.hitRate,
    },
  };
}
