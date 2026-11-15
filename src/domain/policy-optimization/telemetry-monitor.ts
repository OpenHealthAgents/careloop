import { PolicyMonitoringTelemetry, PolicyProposal } from "./contracts";
import { evaluateRollbackTriggers } from "./rollout-controller";

export interface TelemetryIngestSample {
  success: boolean;
  isSafetyBreach?: boolean;
  completionAchieved?: boolean;
  latencyMs: number;
  protectedCohort?: boolean;
  decisionShiftedFromBaseline?: boolean;
}

/**
 * Computes health status and monitors for drift or circuit-breaker rollback conditions.
 */
export function computePolicyMonitoringTelemetry(
  proposal: PolicyProposal,
  samples: TelemetryIngestSample[]
): PolicyMonitoringTelemetry {
  const deployment = proposal.deployment;
  const version = proposal.versionRecord?.version ?? "UNKNOWN";

  if (!deployment || !deployment.isActive) {
    return {
      telemetryId: `TEL-${Date.now()}`,
      activeVersion: version,
      sampleEvaluationsCount: 0,
      observedCompletionRatePct: 0,
      observedErrorRatePct: 0,
      observedSafetyBreachesCount: 0,
      observedP95LatencyMs: 0,
      observedDisparityRatio: 1.0,
      driftDetected: false,
      healthStatus: "HEALTHY",
      lastTelemetryPollAt: new Date().toISOString(),
      rollbackTriggered: false,
    };
  }

  const n = samples.length;
  if (n === 0) {
    return {
      telemetryId: `TEL-${Date.now()}`,
      activeVersion: version,
      sampleEvaluationsCount: 0,
      observedCompletionRatePct: 50.0,
      observedErrorRatePct: 0,
      observedSafetyBreachesCount: 0,
      observedP95LatencyMs: 120,
      observedDisparityRatio: 1.0,
      driftDetected: false,
      healthStatus: "HEALTHY",
      lastTelemetryPollAt: new Date().toISOString(),
      rollbackTriggered: false,
    };
  }

  const errors = samples.filter((s) => !s.success).length;
  const safetyBreaches = samples.filter((s) => s.isSafetyBreach).length;
  const completions = samples.filter((s) => s.completionAchieved).length;
  const shiftedDecisions = samples.filter((s) => s.decisionShiftedFromBaseline).length;

  const latencies = samples.map((s) => s.latencyMs).sort((a, b) => a - b);
  const p95Idx = Math.floor(n * 0.95);
  const observedP95LatencyMs = latencies[p95Idx] ?? 150;

  const observedErrorRatePct = Number(((errors / n) * 100).toFixed(2));
  const observedCompletionRatePct = Number(((completions / n) * 100).toFixed(1));

  // Compute equity disparity
  const protectedSamples = samples.filter((s) => s.protectedCohort);
  const refSamples = samples.filter((s) => !s.protectedCohort);

  const protComp = protectedSamples.filter((s) => s.completionAchieved).length;
  const refComp = refSamples.filter((s) => s.completionAchieved).length;

  const protRate = protectedSamples.length > 0 ? protComp / protectedSamples.length : 0.55;
  const refRate = refSamples.length > 0 ? refComp / refSamples.length : 0.60;
  const observedDisparityRatio = Number((protRate / Math.max(refRate, 0.01)).toFixed(3));

  // Drift detected if decision shift exceeds 25% of traffic
  const driftRatePct = (shiftedDecisions / n) * 100;
  const driftDetected = driftRatePct > 25.0;

  // Evaluate against automated rollback triggers
  const evalResult = evaluateRollbackTriggers(deployment.automatedRollbackTriggers, {
    errorRatePct: observedErrorRatePct,
    safetyBreachesCount: safetyBreaches,
    completionRatePct: observedCompletionRatePct,
    p95LatencyMs: observedP95LatencyMs,
    disparityImpactRatio: observedDisparityRatio,
  });

  const rollbackTriggered = evalResult.shouldRollback;
  const healthStatus = rollbackTriggered
    ? "CRITICAL_ROLLBACK_TRIGGERED"
    : observedErrorRatePct > 0.5 || driftDetected
    ? "DEGRADED"
    : "HEALTHY";

  return {
    telemetryId: `TEL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    activeVersion: version,
    sampleEvaluationsCount: n,
    observedCompletionRatePct,
    observedErrorRatePct,
    observedSafetyBreachesCount: safetyBreaches,
    observedP95LatencyMs,
    observedDisparityRatio,
    driftDetected,
    healthStatus,
    lastTelemetryPollAt: new Date().toISOString(),
    rollbackTriggered,
    rollbackReason: evalResult.reason,
  };
}
