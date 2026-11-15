import { UserRole } from "@prisma/client";
import {
  AutomatedRollbackTriggers,
  buildPolicyVersionRecord,
  computePolicyMonitoringTelemetry,
  ControlledDeploymentRecord,
  createControlledDeployment,
  HumanReviewRecord,
  OfflineEvaluationResult,
  PipelineStageEvent,
  PolicyDeploymentPhase,
  PolicyOptimizationStage,
  PolicyProposal,
  PolicySimulationResult,
  runOfflinePolicyEvaluation,
  runPolicySimulation,
  runSafetyEvaluation,
  SafetyEvaluationResult,
  TelemetryIngestSample,
  assertHumanGovernanceAuthority,
  assertStagePrerequisitesMet,
  assertValidStageTransition,
} from "@/domain/policy-optimization";
import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { SessionUser } from "@/lib/auth/session";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { recordAuditEvent } from "./audit-service";

// In-memory persistent registry for policy optimization proposals across tenant lifecycles
const inMemoryOptimizationProposals = new Map<string, PolicyProposal>();

export class PolicyOptimizationService {
  /**
   * Stage 1: Proposal Submission
   */
  async createProposal(
    session: SessionUser,
    input: {
      title: string;
      description: string;
      scope: PolicyProposal["scope"];
      baselinePolicyVersion?: string;
      proposedRules: PolicyProposal["proposedRules"];
      parameterAdjustments?: PolicyProposal["parameterAdjustments"];
      expectedBenefitsRationale: string;
      isAiGenerated?: boolean;
    }
  ): Promise<PolicyProposal> {
    requirePermission(session, PERMISSIONS.CASES_READ);

    const proposalId = `POL-PROP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const baselineVersion = input.baselinePolicyVersion ?? "2.0.0";

    const initialStageEvent: PipelineStageEvent = {
      stage: "PROPOSAL",
      transitionedAt: new Date().toISOString(),
      actorId: session.userId,
      actorRole: session.role,
      passed: true,
      summary: `Proposal drafted: ${input.title}`,
    };

    const proposal: PolicyProposal = {
      id: proposalId,
      tenantId: session.tenantId,
      title: input.title,
      description: input.description,
      scope: input.scope,
      authorId: session.userId,
      authorRole: session.role,
      isAiGenerated: input.isAiGenerated ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      baselinePolicyVersion: baselineVersion,
      baselinePolicyHash: `sha256-baseline-${baselineVersion}`,
      proposedRules: input.proposedRules,
      parameterAdjustments: input.parameterAdjustments ?? {},
      expectedBenefitsRationale: input.expectedBenefitsRationale,
      currentStage: "PROPOSAL",
      stageHistory: [initialStageEvent],
      prohibitsAutonomousMutation: true,
    };

    inMemoryOptimizationProposals.set(proposal.id, proposal);

    await recordAuditEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "POLICY_OPTIMIZATION_PROPOSAL_CREATED",
      entityType: "PolicyProposal",
      entityId: proposal.id,
      summary: `Candidate policy proposal '${input.title}' submitted (scope: ${input.scope}).`,
      metadata: {
        proposalId: proposal.id,
        scope: input.scope,
        baselineVersion,
        isAiGenerated: input.isAiGenerated ?? false,
        prohibitsAutonomousMutation: true,
      },
    });

    return proposal;
  }

  /**
   * Stage 2: Offline Evaluation
   */
  async runOfflineEvaluation(session: SessionUser, proposalId: string): Promise<OfflineEvaluationResult> {
    requirePermission(session, PERMISSIONS.CASES_READ);
    const proposal = this.getProposalOrThrow(proposalId, session.tenantId);

    assertValidStageTransition(proposal.currentStage, "OFFLINE_EVALUATION");
    assertStagePrerequisitesMet(proposal, "OFFLINE_EVALUATION");

    const evalResult = await runOfflinePolicyEvaluation(proposal);

    proposal.offlineEvaluation = evalResult;
    proposal.currentStage = "OFFLINE_EVALUATION";
    proposal.updatedAt = new Date().toISOString();

    proposal.stageHistory.push({
      stage: "OFFLINE_EVALUATION",
      transitionedAt: new Date().toISOString(),
      actorId: session.userId,
      actorRole: session.role,
      passed: evalResult.passed,
      summary: `Offline evaluation ${evalResult.passed ? "PASSED" : "FAILED"} (${evalResult.decisionConcordancePct}% concordance, ${evalResult.criticalSafetyAccuracyPct}% safety accuracy).`,
      details: {
        concordancePct: evalResult.decisionConcordancePct,
        criticalSafetyAccuracyPct: evalResult.criticalSafetyAccuracyPct,
        passed: evalResult.passed,
      },
    });

    await recordAuditEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "OFFLINE_EVALUATION_COMPLETED",
      entityType: "PolicyProposal",
      entityId: proposal.id,
      summary: `Offline evaluation finished for proposal ${proposal.id} (Concordance: ${evalResult.decisionConcordancePct}%, Passed: ${evalResult.passed}).`,
      metadata: {
        proposalId: proposal.id,
        concordancePct: evalResult.decisionConcordancePct,
        passed: evalResult.passed,
      },
    });

    return evalResult;
  }

  /**
   * Stage 3: Population Simulation
   */
  async runSimulation(
    session: SessionUser,
    proposalId: string,
    populationSize: number = 1000
  ): Promise<PolicySimulationResult> {
    requirePermission(session, PERMISSIONS.CASES_READ);
    const proposal = this.getProposalOrThrow(proposalId, session.tenantId);

    assertValidStageTransition(proposal.currentStage, "SIMULATION");
    assertStagePrerequisitesMet(proposal, "SIMULATION");

    const simResult = await runPolicySimulation(proposal, { populationSize });

    proposal.simulation = simResult;
    proposal.currentStage = "SIMULATION";
    proposal.updatedAt = new Date().toISOString();

    proposal.stageHistory.push({
      stage: "SIMULATION",
      transitionedAt: new Date().toISOString(),
      actorId: session.userId,
      actorRole: session.role,
      passed: simResult.passed,
      summary: `Simulation ${simResult.passed ? "PASSED" : "FAILED"} (Projected completion: ${simResult.projectedCompletionRatePct}%, Delta: ${simResult.completionRateDeltaPct}%).`,
      details: {
        projectedCompletionRatePct: simResult.projectedCompletionRatePct,
        completionRateDeltaPct: simResult.completionRateDeltaPct,
        deadlockDetected: simResult.deadlockDetected,
        capacityStressPassed: simResult.capacityStressPassed,
      },
    });

    await recordAuditEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "POLICY_SIMULATION_COMPLETED",
      entityType: "PolicyProposal",
      entityId: proposal.id,
      summary: `Simulation completed for proposal ${proposal.id} on N=${simResult.simulatedPopulationSize} members. Delta: ${simResult.completionRateDeltaPct}%.`,
      metadata: {
        proposalId: proposal.id,
        projectedCompletionRatePct: simResult.projectedCompletionRatePct,
        passed: simResult.passed,
      },
    });

    return simResult;
  }

  /**
   * Stage 4: Safety Evaluation
   */
  async runSafetyEvaluation(session: SessionUser, proposalId: string): Promise<SafetyEvaluationResult> {
    requirePermission(session, PERMISSIONS.CASES_READ);
    const proposal = this.getProposalOrThrow(proposalId, session.tenantId);

    assertValidStageTransition(proposal.currentStage, "SAFETY_EVALUATION");
    assertStagePrerequisitesMet(proposal, "SAFETY_EVALUATION");

    const safetyResult = await runSafetyEvaluation(proposal);

    proposal.safetyEvaluation = safetyResult;
    proposal.currentStage = "SAFETY_EVALUATION";
    proposal.updatedAt = new Date().toISOString();

    proposal.stageHistory.push({
      stage: "SAFETY_EVALUATION",
      transitionedAt: new Date().toISOString(),
      actorId: session.userId,
      actorRole: session.role,
      passed: safetyResult.passed,
      summary: `Safety evaluation ${safetyResult.passed ? "PASSED" : "FAILED"} with ${safetyResult.safetyBreachesCount} breaches.`,
      details: {
        clinicalSafetyPassed: safetyResult.clinicalSafetyPassed,
        regulatoryConsentCompliancePct: safetyResult.regulatoryConsentCompliancePct,
        equityDisparityRatio: safetyResult.equityDisparityRatio,
        safetyBreachesCount: safetyResult.safetyBreachesCount,
      },
    });

    await recordAuditEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "SAFETY_EVALUATION_COMPLETED",
      entityType: "PolicyProposal",
      entityId: proposal.id,
      summary: `Safety evaluation completed for proposal ${proposal.id} (Passed: ${safetyResult.passed}, Breaches: ${safetyResult.safetyBreachesCount}).`,
      metadata: {
        proposalId: proposal.id,
        passed: safetyResult.passed,
        safetyBreachesCount: safetyResult.safetyBreachesCount,
      },
    });

    return safetyResult;
  }

  /**
   * Stage 5: Human Review Sign-Off
   * STRICT INVARIANT: Agents CANNOT sign off. Requires ADMIN or CLINICAL_SUPERVISOR.
   */
  async submitHumanReview(
    session: SessionUser,
    proposalId: string,
    review: {
      decision: "APPROVE" | "REJECT" | "REQUEST_REVISIONS";
      clinicalJustification: string;
      independentPeerReviewerId?: string;
    }
  ): Promise<HumanReviewRecord> {
    // Invariant assertion: rejects automated agents or unprivileged users
    assertHumanGovernanceAuthority(session.role, "REVIEW");

    const proposal = this.getProposalOrThrow(proposalId, session.tenantId);

    assertValidStageTransition(proposal.currentStage, "HUMAN_REVIEW");
    assertStagePrerequisitesMet(proposal, "HUMAN_REVIEW");

    const reviewRecord: HumanReviewRecord = {
      reviewerUserId: session.userId,
      reviewerEmail: session.email,
      reviewerRole: session.role,
      reviewerName: session.name || session.email,
      decision: review.decision,
      clinicalJustification: review.clinicalJustification,
      reviewedAt: new Date().toISOString(),
      independentPeerReviewerId: review.independentPeerReviewerId,
      signedOff: review.decision === "APPROVE",
    };

    proposal.humanReview = reviewRecord;
    proposal.currentStage = review.decision === "APPROVE" ? "HUMAN_REVIEW" : "REJECTED";
    proposal.updatedAt = new Date().toISOString();

    proposal.stageHistory.push({
      stage: proposal.currentStage,
      transitionedAt: new Date().toISOString(),
      actorId: session.userId,
      actorRole: session.role,
      passed: review.decision === "APPROVE",
      summary: `Human supervisor review finalized: ${review.decision}. Justification: ${review.clinicalJustification}`,
      details: {
        decision: review.decision,
        reviewerRole: session.role,
      },
    });

    await recordAuditEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: review.decision === "APPROVE" ? "POLICY_HUMAN_REVIEW_APPROVED" : "POLICY_HUMAN_REVIEW_REJECTED",
      entityType: "PolicyProposal",
      entityId: proposal.id,
      summary: `Human clinical review ${review.decision} by ${session.email} (${session.role}): ${review.clinicalJustification}`,
      metadata: {
        proposalId: proposal.id,
        decision: review.decision,
        reviewerRole: session.role,
        clinicalJustification: review.clinicalJustification,
      },
    });

    return reviewRecord;
  }

  /**
   * Stage 6: Semantic Versioning & Manifest Publication
   */
  async publishPolicyVersion(session: SessionUser, proposalId: string): Promise<PolicyProposal> {
    assertHumanGovernanceAuthority(session.role, "VERSION");
    const proposal = this.getProposalOrThrow(proposalId, session.tenantId);

    assertValidStageTransition(proposal.currentStage, "VERSIONING");
    assertStagePrerequisitesMet(proposal, "VERSIONING");

    const versionRecord = buildPolicyVersionRecord(proposal, {
      id: session.userId,
      role: session.role,
      name: session.name || session.email,
    });

    proposal.versionRecord = versionRecord;
    proposal.currentStage = "VERSIONING";
    proposal.updatedAt = new Date().toISOString();

    proposal.stageHistory.push({
      stage: "VERSIONING",
      transitionedAt: new Date().toISOString(),
      actorId: session.userId,
      actorRole: session.role,
      passed: true,
      summary: `Version ${versionRecord.version} minted (Manifest: ${versionRecord.manifestId}, Hash: ${versionRecord.rulesHash.slice(0, 10)}).`,
      details: {
        version: versionRecord.version,
        manifestId: versionRecord.manifestId,
        rulesHash: versionRecord.rulesHash,
      },
    });

    await recordAuditEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "POLICY_VERSION_PUBLISHED",
      entityType: "PolicyProposal",
      entityId: proposal.id,
      summary: `Policy version ${versionRecord.version} minted with SHA-256 integrity hash.`,
      metadata: {
        proposalId: proposal.id,
        version: versionRecord.version,
        rulesHash: versionRecord.rulesHash,
        manifestId: versionRecord.manifestId,
      },
    });

    return proposal;
  }

  /**
   * Stage 7: Controlled Deployment (Shadow -> Canary -> Full Production)
   */
  async deployControlledRollout(
    session: SessionUser,
    proposalId: string,
    params: {
      phase: PolicyDeploymentPhase;
      trafficAllocationPct: number;
      targetTenants?: string[];
      targetCohorts?: string[];
      triggers?: Partial<AutomatedRollbackTriggers>;
    }
  ): Promise<ControlledDeploymentRecord> {
    assertHumanGovernanceAuthority(session.role, "DEPLOY");
    const proposal = this.getProposalOrThrow(proposalId, session.tenantId);

    assertValidStageTransition(proposal.currentStage, "CONTROLLED_DEPLOYMENT");
    assertStagePrerequisitesMet(proposal, "CONTROLLED_DEPLOYMENT");

    const deployment = createControlledDeployment(proposal, {
      phase: params.phase,
      trafficAllocationPct: params.trafficAllocationPct,
      targetTenants: params.targetTenants ?? [session.tenantId],
      targetCohorts: params.targetCohorts,
      deployedBy: { id: session.userId, role: session.role },
      triggers: params.triggers,
    });

    proposal.deployment = deployment;
    proposal.currentStage = "CONTROLLED_DEPLOYMENT";
    proposal.updatedAt = new Date().toISOString();

    proposal.stageHistory.push({
      stage: "CONTROLLED_DEPLOYMENT",
      transitionedAt: new Date().toISOString(),
      actorId: session.userId,
      actorRole: session.role,
      passed: true,
      summary: `Deployed in phase '${deployment.phase}' with ${deployment.trafficAllocationPct}% traffic allocation.`,
      details: {
        phase: deployment.phase,
        trafficAllocationPct: deployment.trafficAllocationPct,
        targetTenants: deployment.targetTenants,
      },
    });

    await recordAuditEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "POLICY_CONTROLLED_DEPLOYMENT_STARTED",
      entityType: "PolicyProposal",
      entityId: proposal.id,
      summary: `Policy deployment initiated: phase=${deployment.phase}, trafficPct=${deployment.trafficAllocationPct}%.`,
      metadata: {
        proposalId: proposal.id,
        phase: deployment.phase,
        trafficAllocationPct: deployment.trafficAllocationPct,
      },
    });

    return deployment;
  }

  /**
   * Stage 8: Live Monitoring Telemetry & Automated Circuit Breaker Rollback
   */
  async ingestTelemetryAndMonitor(
    session: SessionUser,
    proposalId: string,
    samples: TelemetryIngestSample[]
  ): Promise<PolicyProposal> {
    requirePermission(session, PERMISSIONS.CASES_READ);
    const proposal = this.getProposalOrThrow(proposalId, session.tenantId);

    assertValidStageTransition(proposal.currentStage, "MONITORING");
    assertStagePrerequisitesMet(proposal, "MONITORING");

    const telemetry = computePolicyMonitoringTelemetry(proposal, samples);
    proposal.monitoring = telemetry;
    proposal.updatedAt = new Date().toISOString();

    if (telemetry.rollbackTriggered) {
      // Automated Circuit Breaker Triggered
      if (proposal.deployment) {
        proposal.deployment.isActive = false;
        proposal.deployment.phase = "DECOMMISSIONED";
      }
      proposal.currentStage = "ROLLED_BACK";

      proposal.stageHistory.push({
        stage: "ROLLED_BACK",
        transitionedAt: new Date().toISOString(),
        actorId: "CIRCUIT_BREAKER_AUTOMATION",
        actorRole: "SYSTEM_CIRCUIT_BREAKER",
        passed: false,
        summary: `AUTOMATED CIRCUIT BREAKER ROLLBACK: ${telemetry.rollbackReason}`,
        details: {
          rollbackReason: telemetry.rollbackReason,
          telemetry,
        },
      });

      await recordAuditEvent({
        tenantId: session.tenantId,
        actorId: "SYSTEM_CIRCUIT_BREAKER",
        actorRole: "SYSTEM",
        action: "POLICY_AUTOMATED_ROLLBACK_TRIGGERED",
        entityType: "PolicyProposal",
        entityId: proposal.id,
        summary: `Automated circuit breaker rolled back policy deployment: ${telemetry.rollbackReason}`,
        metadata: {
          proposalId: proposal.id,
          reason: telemetry.rollbackReason,
          telemetry,
        },
      });
    } else {
      proposal.currentStage = "MONITORING";
      proposal.stageHistory.push({
        stage: "MONITORING",
        transitionedAt: new Date().toISOString(),
        actorId: session.userId,
        actorRole: session.role,
        passed: true,
        summary: `Monitoring telemetry polled: Health=${telemetry.healthStatus}, N=${telemetry.sampleEvaluationsCount}, Completion=${telemetry.observedCompletionRatePct}%.`,
      });
    }

    return proposal;
  }

  /**
   * Manual Emergency Rollback by Authorized Human Supervisor
   */
  async triggerManualRollback(
    session: SessionUser,
    proposalId: string,
    reason: string
  ): Promise<PolicyProposal> {
    assertHumanGovernanceAuthority(session.role, "ROLLBACK");
    const proposal = this.getProposalOrThrow(proposalId, session.tenantId);

    if (proposal.deployment) {
      proposal.deployment.isActive = false;
      proposal.deployment.phase = "DECOMMISSIONED";
    }
    proposal.currentStage = "ROLLED_BACK";
    proposal.updatedAt = new Date().toISOString();

    proposal.stageHistory.push({
      stage: "ROLLED_BACK",
      transitionedAt: new Date().toISOString(),
      actorId: session.userId,
      actorRole: session.role,
      passed: false,
      summary: `Manual rollback triggered by ${session.email} (${session.role}): ${reason}`,
      details: { reason },
    });

    await recordAuditEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "POLICY_MANUAL_ROLLBACK_EXECUTED",
      entityType: "PolicyProposal",
      entityId: proposal.id,
      summary: `Manual emergency rollback executed by ${session.email}: ${reason}`,
      metadata: {
        proposalId: proposal.id,
        reason,
        role: session.role,
      },
    });

    return proposal;
  }

  getProposalOrThrow(proposalId: string, tenantId: string): PolicyProposal {
    const proposal = inMemoryOptimizationProposals.get(proposalId);
    if (!proposal || proposal.tenantId !== tenantId) {
      throw new NotFoundError("PolicyProposal", proposalId);
    }
    return proposal;
  }

  listProposals(tenantId: string): PolicyProposal[] {
    return Array.from(inMemoryOptimizationProposals.values()).filter(
      (p) => p.tenantId === tenantId
    );
  }
}

export const policyOptimizationService = new PolicyOptimizationService();
