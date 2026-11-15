import { z } from "zod";
import { UserRole } from "@prisma/client";

/**
 * ============================================================================
 * AGENT POLICY OPTIMIZATION PIPELINE CONTRACTS
 * ============================================================================
 * Candidate policy changes must strictly traverse the 8-stage pipeline:
 *
 *   1. proposal
 *   2. offline evaluation
 *   3. simulation
 *   4. safety evaluation
 *   5. human review
 *   6. versioning
 *   7. controlled deployment
 *   8. monitoring
 *
 * STRICT INVARIANT:
 * "Never allow the agent to rewrite its own production policy autonomously."
 * ============================================================================
 */

export type PolicyOptimizationStage =
  | "PROPOSAL"
  | "OFFLINE_EVALUATION"
  | "SIMULATION"
  | "SAFETY_EVALUATION"
  | "HUMAN_REVIEW"
  | "VERSIONING"
  | "CONTROLLED_DEPLOYMENT"
  | "MONITORING"
  | "REJECTED"
  | "ROLLED_BACK";

export type PolicyDeploymentPhase = "SHADOW" | "CANARY" | "FULL_PRODUCTION" | "DECOMMISSIONED";

export type PolicyCandidateScope =
  | "BARRIER_ROUTING"
  | "ESCALATION_THRESHOLDS"
  | "INTERVENTION_MAPPING"
  | "COMMUNICATION_POLICIES"
  | "CONSENT_ENFORCEMENT"
  | "COMPREHENSIVE";

export interface PolicyRuleDefinition {
  id: string;
  name: string;
  description: string;
  effect: "ALLOW" | "DENY" | "REQUIRE_APPROVAL" | "REQUIRE_HUMAN";
  conditionExpression: string;
  rationale: string;
}

export interface ParameterAdjustments {
  highRiskScoreThreshold?: number;
  autoExecutionConfidenceThreshold?: number;
  disparityAlertThresholdRatio?: number;
  maxConsecutiveOutreachAttempts?: number;
  unattendedCancellationGraceDays?: number;
  humanReviewRequiredForTelehealth?: boolean;
  [key: string]: unknown;
}

export interface PipelineStageEvent {
  stage: PolicyOptimizationStage;
  transitionedAt: string;
  actorId: string;
  actorRole: UserRole | string;
  passed: boolean;
  summary: string;
  details?: Record<string, unknown>;
}

export interface OfflineBenchmarkCase {
  id: string;
  title: string;
  scenarioType: "ROUTINE" | "HIGH_RISK" | "CONSENT_MISSING" | "PROVIDER_SHORTAGE" | "AMBIGUOUS_BARRIER" | "LANGUAGE_MISMATCH";
  inputContext: Record<string, unknown>;
  expectedDecision: "ALLOW" | "DENY" | "REQUIRE_APPROVAL" | "REQUIRE_HUMAN";
  expectedTool?: string;
  isSafetyCritical: boolean;
}

export interface OfflineEvaluationResult {
  benchmarkSuiteId: string;
  totalBenchmarkCases: number;
  concordantCases: number;
  decisionConcordancePct: number;
  toolSelectionAccuracyPct: number;
  falsePositiveEscalationRatePct: number;
  projectedCompletionLiftPct: number;
  criticalSafetyAccuracyPct: number;
  passed: boolean;
  evaluationDurationMs: number;
  failureDetails: Array<{ caseId: string; expected: string; actual: string; reason: string }>;
}

export interface PolicySimulationResult {
  simulationRunId: string;
  simulatedPopulationSize: number;
  projectedCompletionRatePct: number;
  baselineCompletionRatePct: number;
  completionRateDeltaPct: number;
  medianTimeToAppointmentDays: number;
  projectedNoShowRatePct: number;
  queueP95LatencyHours: number;
  careManagerLaborMinutesPerCase: number;
  deadlockDetected: boolean;
  capacityStressPassed: boolean;
  passed: boolean;
  runDurationMs: number;
}

export interface SafetyEvaluationResult {
  safetyChecklistId: string;
  clinicalSafetyPassed: boolean;
  unauthorizedClinicalAdviceDetected: boolean;
  crisisEscalationReliabilityPct: number;
  regulatoryConsentCompliancePct: number;
  phiMinimizationVerified: boolean;
  adversarialPromptResistanceScore: number; // 0 - 100
  equityDisparityRatio: number; // 4/5ths rule (>= 0.80)
  disparateImpactDetected: boolean;
  safetyBreachesCount: number;
  passed: boolean;
  safetyViolations: string[];
}

export interface HumanReviewRecord {
  reviewerUserId: string;
  reviewerEmail: string;
  reviewerRole: UserRole | string;
  reviewerName: string;
  decision: "APPROVE" | "REJECT" | "REQUEST_REVISIONS";
  clinicalJustification: string;
  reviewedAt: string;
  independentPeerReviewerId?: string;
  signedOff: boolean;
}

export interface PolicyVersionRecord {
  version: string; // e.g. "2.2.0"
  rulesHash: string; // SHA-256
  manifestId: string;
  parentVersion: string;
  changelog: string[];
  publishedAt: string;
  publishedByUserId: string;
}

export interface AutomatedRollbackTriggers {
  maxErrorRatePct: number; // e.g. 1.0%
  maxSafetyBreaches: number; // strictly 0
  minCompletionRatePct: number; // e.g. 45.0%
  maxP95LatencyMs: number; // e.g. 5000ms
  disparityImpactRatioMin: number; // e.g. 0.80
}

export interface ControlledDeploymentRecord {
  deploymentId: string;
  phase: PolicyDeploymentPhase;
  trafficAllocationPct: number; // 0 for shadow, 5-99 for canary, 100 for full
  targetTenants: string[];
  targetCohorts?: string[];
  deployedAt: string;
  deployedByUserId: string;
  automatedRollbackTriggers: AutomatedRollbackTriggers;
  isActive: boolean;
  trafficRouterSeed: string;
}

export interface PolicyMonitoringTelemetry {
  telemetryId: string;
  activeVersion: string;
  sampleEvaluationsCount: number;
  observedCompletionRatePct: number;
  observedErrorRatePct: number;
  observedSafetyBreachesCount: number;
  observedP95LatencyMs: number;
  observedDisparityRatio: number;
  driftDetected: boolean;
  healthStatus: "HEALTHY" | "DEGRADED" | "CRITICAL_ROLLBACK_TRIGGERED";
  lastTelemetryPollAt: string;
  rollbackTriggered: boolean;
  rollbackReason?: string;
}

export interface PolicyProposal {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  scope: PolicyCandidateScope;
  authorId: string;
  authorRole: UserRole | string;
  isAiGenerated: boolean;
  createdAt: string;
  updatedAt: string;

  // Baseline
  baselinePolicyVersion: string;
  baselinePolicyHash: string;

  // Proposed Changes
  proposedRules: PolicyRuleDefinition[];
  parameterAdjustments: ParameterAdjustments;
  expectedBenefitsRationale: string;

  // Pipeline State
  currentStage: PolicyOptimizationStage;
  stageHistory: PipelineStageEvent[];

  // Stage Artifacts
  offlineEvaluation?: OfflineEvaluationResult;
  simulation?: PolicySimulationResult;
  safetyEvaluation?: SafetyEvaluationResult;
  humanReview?: HumanReviewRecord;
  versionRecord?: PolicyVersionRecord;
  deployment?: ControlledDeploymentRecord;
  monitoring?: PolicyMonitoringTelemetry;

  // Invariant Guard Flag
  prohibitsAutonomousMutation: true;
}

export const CreatePolicyProposalSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(10),
  scope: z.enum([
    "BARRIER_ROUTING",
    "ESCALATION_THRESHOLDS",
    "INTERVENTION_MAPPING",
    "COMMUNICATION_POLICIES",
    "CONSENT_ENFORCEMENT",
    "COMPREHENSIVE",
  ]),
  baselinePolicyVersion: z.string().min(1).default("2.0.0"),
  proposedRules: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      description: z.string().min(1),
      effect: z.enum(["ALLOW", "DENY", "REQUIRE_APPROVAL", "REQUIRE_HUMAN"]),
      conditionExpression: z.string().min(1),
      rationale: z.string().min(1),
    })
  ).min(1),
  parameterAdjustments: z.record(z.unknown()).default({}),
  expectedBenefitsRationale: z.string().min(10),
  isAiGenerated: z.boolean().default(false),
});

export const HumanReviewSubmissionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "REQUEST_REVISIONS"]),
  clinicalJustification: z.string().min(15),
  independentPeerReviewerId: z.string().optional(),
});

export const ControlledDeploymentRequestSchema = z.object({
  phase: z.enum(["SHADOW", "CANARY", "FULL_PRODUCTION"]),
  trafficAllocationPct: z.number().min(0).max(100),
  targetTenants: z.array(z.string()).default([]),
  targetCohorts: z.array(z.string()).optional(),
  automatedRollbackTriggers: z
    .object({
      maxErrorRatePct: z.number().min(0).default(1.0),
      maxSafetyBreaches: z.number().min(0).default(0),
      minCompletionRatePct: z.number().min(0).default(45.0),
      maxP95LatencyMs: z.number().min(0).default(5000),
      disparityImpactRatioMin: z.number().min(0).default(0.80),
    })
    .default({
      maxErrorRatePct: 1.0,
      maxSafetyBreaches: 0,
      minCompletionRatePct: 45.0,
      maxP95LatencyMs: 5000,
      disparityImpactRatioMin: 0.80,
    }),
});
