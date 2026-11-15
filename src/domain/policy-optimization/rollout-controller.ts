import { createHash } from "crypto";
import {
  AutomatedRollbackTriggers,
  ControlledDeploymentRecord,
  PolicyDeploymentPhase,
  PolicyProposal,
} from "./contracts";
import { assertHumanGovernanceAuthority } from "./invariants";

/**
 * Initializes or updates a controlled deployment record for an approved and versioned policy.
 */
export function createControlledDeployment(
  proposal: PolicyProposal,
  params: {
    phase: PolicyDeploymentPhase;
    trafficAllocationPct: number;
    targetTenants: string[];
    targetCohorts?: string[];
    deployedBy: { id: string; role: string };
    triggers?: Partial<AutomatedRollbackTriggers>;
  }
): ControlledDeploymentRecord {
  // Invariant: deployment must be performed by authorized human role
  assertHumanGovernanceAuthority(params.deployedBy.role, "DEPLOY");

  if (!proposal.versionRecord) {
    throw new Error("Cannot initiate deployment: Policy must be versioned first.");
  }

  // Validate traffic allocation bounds
  let trafficPct = params.trafficAllocationPct;
  if (params.phase === "SHADOW") {
    trafficPct = 0; // Shadow mode has 0 active execution impact
  } else if (params.phase === "FULL_PRODUCTION") {
    trafficPct = 100;
  } else if (trafficPct <= 0 || trafficPct >= 100) {
    trafficPct = 10; // Default 10% canary
  }

  const defaultTriggers: AutomatedRollbackTriggers = {
    maxErrorRatePct: 1.0,
    maxSafetyBreaches: 0,
    minCompletionRatePct: 45.0,
    maxP95LatencyMs: 5000,
    disparityImpactRatioMin: 0.80,
    ...params.triggers,
  };

  return {
    deploymentId: `DEP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    phase: params.phase,
    trafficAllocationPct: trafficPct,
    targetTenants: params.targetTenants.length > 0 ? params.targetTenants : [proposal.tenantId],
    targetCohorts: params.targetCohorts,
    deployedAt: new Date().toISOString(),
    deployedByUserId: params.deployedBy.id,
    automatedRollbackTriggers: defaultTriggers,
    isActive: true,
    trafficRouterSeed: `seed-${proposal.versionRecord.version}-${proposal.id}`,
  };
}

/**
 * Deterministically routes a given caseId / memberId to the candidate policy
 * according to the allocated canary percentage.
 */
export function shouldRouteToCandidate(
  caseId: string,
  deployment: ControlledDeploymentRecord
): boolean {
  if (!deployment.isActive) return false;
  if (deployment.phase === "SHADOW") return false; // Shadow mode never routes primary traffic
  if (deployment.phase === "FULL_PRODUCTION" || deployment.trafficAllocationPct >= 100) return true;
  if (deployment.trafficAllocationPct <= 0) return false;

  // Consistent hashing of seed + caseId -> bucket 0-99
  const hash = createHash("sha256")
    .update(`${deployment.trafficRouterSeed}:${caseId}`)
    .digest("hex");
  const bucket = parseInt(hash.slice(0, 4), 16) % 100;

  return bucket < deployment.trafficAllocationPct;
}

export interface RollbackTriggerEvaluation {
  shouldRollback: boolean;
  violatedTrigger?: string;
  observedValue?: number;
  thresholdValue?: number;
  reason?: string;
}

/**
 * Evaluates whether observed telemetry violates the automated rollback thresholds.
 */
export function evaluateRollbackTriggers(
  triggers: AutomatedRollbackTriggers,
  telemetry: {
    errorRatePct: number;
    safetyBreachesCount: number;
    completionRatePct: number;
    p95LatencyMs: number;
    disparityImpactRatio: number;
  }
): RollbackTriggerEvaluation {
  // Safety breaches is strictly zero tolerance
  if (telemetry.safetyBreachesCount > triggers.maxSafetyBreaches) {
    return {
      shouldRollback: true,
      violatedTrigger: "maxSafetyBreaches",
      observedValue: telemetry.safetyBreachesCount,
      thresholdValue: triggers.maxSafetyBreaches,
      reason: `Zero-tolerance safety violation detected: observed ${telemetry.safetyBreachesCount} safety breaches (threshold = ${triggers.maxSafetyBreaches}).`,
    };
  }

  // Error rate check
  if (telemetry.errorRatePct > triggers.maxErrorRatePct) {
    return {
      shouldRollback: true,
      violatedTrigger: "maxErrorRatePct",
      observedValue: telemetry.errorRatePct,
      thresholdValue: triggers.maxErrorRatePct,
      reason: `Error rate spiked to ${telemetry.errorRatePct}% exceeding maximum allowed threshold of ${triggers.maxErrorRatePct}%.`,
    };
  }

  // Completion rate degradation check
  if (telemetry.completionRatePct < triggers.minCompletionRatePct) {
    return {
      shouldRollback: true,
      violatedTrigger: "minCompletionRatePct",
      observedValue: telemetry.completionRatePct,
      thresholdValue: triggers.minCompletionRatePct,
      reason: `Completion rate degraded to ${telemetry.completionRatePct}% falling below minimum floor of ${triggers.minCompletionRatePct}%.`,
    };
  }

  // Latency spike check
  if (telemetry.p95LatencyMs > triggers.maxP95LatencyMs) {
    return {
      shouldRollback: true,
      violatedTrigger: "maxP95LatencyMs",
      observedValue: telemetry.p95LatencyMs,
      thresholdValue: triggers.maxP95LatencyMs,
      reason: `P95 execution latency spiked to ${telemetry.p95LatencyMs}ms exceeding SLA threshold of ${triggers.maxP95LatencyMs}ms.`,
    };
  }

  // Equity disparity ratio check (4/5ths rule)
  if (telemetry.disparityImpactRatio < triggers.disparityImpactRatioMin) {
    return {
      shouldRollback: true,
      violatedTrigger: "disparityImpactRatioMin",
      observedValue: telemetry.disparityImpactRatio,
      thresholdValue: triggers.disparityImpactRatioMin,
      reason: `Health equity disparity ratio dropped to ${telemetry.disparityImpactRatio} violating minimum parity floor of ${triggers.disparityImpactRatioMin}.`,
    };
  }

  return { shouldRollback: false };
}
