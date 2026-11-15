import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import {
  assertHumanGovernanceAuthority,
  assertStagePrerequisitesMet,
  assertValidStageTransition,
  AutonomousPolicyRewriteProhibitedError,
  buildPolicyVersionRecord,
  computePolicyMonitoringTelemetry,
  createControlledDeployment,
  evaluateRollbackTriggers,
  PipelineStageOrderViolationError,
  PolicyProposal,
  runOfflinePolicyEvaluation,
  runPolicySimulation,
  runSafetyEvaluation,
  shouldRouteToCandidate,
  StagePrerequisiteMissingError,
} from "@/domain/policy-optimization";

describe("Agent Policy Optimization Framework (Unit Tests)", () => {
  const sampleProposal: PolicyProposal = {
    id: "test-prop-1",
    tenantId: "tenant-horizon",
    title: "Language-Concordant Provider Prioritization Rule",
    description: "Prioritizes bilingual licensed behavioral health providers for primary non-English speakers.",
    scope: "INTERVENTION_MAPPING",
    authorId: "user-cm-1",
    authorRole: UserRole.CARE_MANAGER,
    isAiGenerated: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baselinePolicyVersion: "2.0.0",
    baselinePolicyHash: "sha256-baseline-2.0.0",
    proposedRules: [
      {
        id: "RULE_LANG_CONCORDANT_PROVIDER_PREFERENCE",
        name: "Language Concordant Provider Matching Preference",
        description: "Matches members requiring non-English care to verified language-concordant providers.",
        effect: "ALLOW",
        conditionExpression: "slotsCount === 0 && preferredLanguage !== 'English'",
        rationale: "Improves first-contact appointment attendance.",
      },
    ],
    parameterAdjustments: {
      highRiskScoreThreshold: 85,
    },
    expectedBenefitsRationale: "Reduces initial scheduling delay by 2 days and increases completed visits by 8%.",
    currentStage: "PROPOSAL",
    stageHistory: [],
    prohibitsAutonomousMutation: true,
  };

  describe("Governance Invariant: Anti-Autonomous Mutation Guard", () => {
    it("strictly forbids AI agents from reviewing, publishing, or deploying production policies", () => {
      expect(() => {
        assertHumanGovernanceAuthority(UserRole.AGENT_SERVICE, "REVIEW");
      }).toThrowError(AutonomousPolicyRewriteProhibitedError);

      expect(() => {
        assertHumanGovernanceAuthority("AI_AGENT", "VERSION");
      }).toThrowError(AutonomousPolicyRewriteProhibitedError);

      expect(() => {
        assertHumanGovernanceAuthority("SYSTEM", "DEPLOY");
      }).toThrowError(AutonomousPolicyRewriteProhibitedError);
    });

    it("allows authorized human roles (ADMIN, CLINICAL_SUPERVISOR) to review and deploy", () => {
      expect(() => {
        assertHumanGovernanceAuthority(UserRole.ADMIN, "REVIEW");
      }).not.toThrow();

      expect(() => {
        assertHumanGovernanceAuthority("CLINICAL_SUPERVISOR", "REVIEW");
      }).not.toThrow();

      expect(() => {
        assertHumanGovernanceAuthority(UserRole.ADMIN, "DEPLOY");
      }).not.toThrow();
    });
  });

  describe("Pipeline Stage Progression & Order Invariants", () => {
    it("allows strictly sequential transitions through all 8 stages", () => {
      expect(() => assertValidStageTransition("PROPOSAL", "OFFLINE_EVALUATION")).not.toThrow();
      expect(() => assertValidStageTransition("OFFLINE_EVALUATION", "SIMULATION")).not.toThrow();
      expect(() => assertValidStageTransition("SIMULATION", "SAFETY_EVALUATION")).not.toThrow();
      expect(() => assertValidStageTransition("SAFETY_EVALUATION", "HUMAN_REVIEW")).not.toThrow();
      expect(() => assertValidStageTransition("HUMAN_REVIEW", "VERSIONING")).not.toThrow();
      expect(() => assertValidStageTransition("VERSIONING", "CONTROLLED_DEPLOYMENT")).not.toThrow();
      expect(() => assertValidStageTransition("CONTROLLED_DEPLOYMENT", "MONITORING")).not.toThrow();
    });

    it("rejects out-of-order stage transitions or skipping stages", () => {
      // Cannot jump from proposal directly to human review or deployment
      expect(() => {
        assertValidStageTransition("PROPOSAL", "HUMAN_REVIEW");
      }).toThrowError(PipelineStageOrderViolationError);

      expect(() => {
        assertValidStageTransition("PROPOSAL", "CONTROLLED_DEPLOYMENT");
      }).toThrowError(PipelineStageOrderViolationError);

      expect(() => {
        assertValidStageTransition("OFFLINE_EVALUATION", "VERSIONING");
      }).toThrowError(PipelineStageOrderViolationError);
    });

    it("enforces prerequisite artifacts before advancing to subsequent stages", () => {
      const emptyProposal: PolicyProposal = {
        ...sampleProposal,
        currentStage: "OFFLINE_EVALUATION",
      };

      expect(() => {
        assertStagePrerequisitesMet(emptyProposal, "SIMULATION");
      }).toThrowError(StagePrerequisiteMissingError);
    });
  });

  describe("Offline Evaluation Engine", () => {
    it("runs benchmark cases and achieves high concordance and 100% critical safety", async () => {
      const evalResult = await runOfflinePolicyEvaluation(sampleProposal);

      expect(evalResult.passed).toBe(true);
      expect(evalResult.totalBenchmarkCases).toBeGreaterThanOrEqual(10);
      expect(evalResult.decisionConcordancePct).toBeGreaterThanOrEqual(90);
      expect(evalResult.criticalSafetyAccuracyPct).toBe(100);
      expect(evalResult.falsePositiveEscalationRatePct).toBeLessThanOrEqual(15);
    });
  });

  describe("Population Simulation Engine", () => {
    it("simulates referral throughput, completion rate delta, and capacity stress", async () => {
      const simResult = await runPolicySimulation(sampleProposal, { populationSize: 500 });

      expect(simResult.passed).toBe(true);
      expect(simResult.simulatedPopulationSize).toBe(500);
      expect(simResult.deadlockDetected).toBe(false);
      expect(simResult.capacityStressPassed).toBe(true);
      expect(simResult.medianTimeToAppointmentDays).toBeGreaterThan(0);
      expect(simResult.queueP95LatencyHours).toBeLessThan(240);
    });
  });

  describe("Safety Evaluation Engine", () => {
    it("passes compliant policy without clinical overreach, consent bypass, or disparate impact", async () => {
      const safetyResult = await runSafetyEvaluation(sampleProposal);

      expect(safetyResult.passed).toBe(true);
      expect(safetyResult.clinicalSafetyPassed).toBe(true);
      expect(safetyResult.unauthorizedClinicalAdviceDetected).toBe(false);
      expect(safetyResult.crisisEscalationReliabilityPct).toBe(100);
      expect(safetyResult.regulatoryConsentCompliancePct).toBe(100);
      expect(safetyResult.phiMinimizationVerified).toBe(true);
      expect(safetyResult.adversarialPromptResistanceScore).toBeGreaterThanOrEqual(85);
      expect(safetyResult.equityDisparityRatio).toBeGreaterThanOrEqual(0.80);
      expect(safetyResult.safetyBreachesCount).toBe(0);
    });

    it("catches and fails clinical prescribing terms and HIPAA consent violations", async () => {
      const hazardousProposal: PolicyProposal = {
        ...sampleProposal,
        proposedRules: [
          {
            id: "RULE_HAZARDOUS",
            name: "Automated Medication Adjustment",
            description: "Automatically prescribe and adjust sertraline dosage",
            effect: "ALLOW",
            conditionExpression: "consentSms === false && containsPhi === true && phiMinimized === false",
            rationale: "Unsafe",
          },
        ],
      };

      const safetyResult = await runSafetyEvaluation(hazardousProposal);
      expect(safetyResult.passed).toBe(false);
      expect(safetyResult.unauthorizedClinicalAdviceDetected).toBe(true);
      expect(safetyResult.safetyBreachesCount).toBeGreaterThanOrEqual(2);
      expect(safetyResult.safetyViolations.length).toBeGreaterThan(0);
    });
  });

  describe("Versioning & Integrity Hash", () => {
    it("mints an immutable version and SHA-256 hash upon supervisor approval", () => {
      const approvedProposal: PolicyProposal = {
        ...sampleProposal,
        currentStage: "HUMAN_REVIEW",
        humanReview: {
          reviewerUserId: "user-admin-1",
          reviewerEmail: "admin@careloop.org",
          reviewerRole: UserRole.ADMIN,
          reviewerName: "Dr. Supervisor",
          decision: "APPROVE",
          clinicalJustification: "Thorough review confirmed safety and improved attendance.",
          reviewedAt: new Date().toISOString(),
          signedOff: true,
        },
      };

      const versionRecord = buildPolicyVersionRecord(approvedProposal, {
        id: "user-admin-1",
        role: UserRole.ADMIN,
      });

      expect(versionRecord.version).toBe("2.1.0");
      expect(versionRecord.rulesHash).toBeDefined();
      expect(versionRecord.rulesHash.length).toBe(64); // SHA-256
      expect(versionRecord.manifestId).toContain("manifest-policy-2.1.0");
      expect(versionRecord.changelog.length).toBeGreaterThan(0);
    });
  });

  describe("Controlled Deployment & Consistent Hashing", () => {
    it("deploys canary rollout and deterministically routes cases according to percentage", () => {
      const deployment = createControlledDeployment(
        {
          ...sampleProposal,
          versionRecord: {
            version: "2.1.0",
            rulesHash: "sha256-test",
            manifestId: "man-1",
            parentVersion: "2.0.0",
            changelog: [],
            publishedAt: new Date().toISOString(),
            publishedByUserId: "admin-1",
          },
        },
        {
          phase: "CANARY",
          trafficAllocationPct: 25,
          targetTenants: ["tenant-horizon"],
          deployedBy: { id: "admin-1", role: UserRole.ADMIN },
        }
      );

      expect(deployment.phase).toBe("CANARY");
      expect(deployment.trafficAllocationPct).toBe(25);
      expect(deployment.isActive).toBe(true);

      // Verify consistent hashing: same caseId always gets same outcome
      const res1 = shouldRouteToCandidate("case-consistent-1", deployment);
      const res2 = shouldRouteToCandidate("case-consistent-1", deployment);
      expect(res1).toBe(res2);
    });
  });

  describe("Automated Circuit Breaker & Monitoring Telemetry", () => {
    it("evaluates rollback triggers and flags zero-tolerance safety breaches immediately", () => {
      const triggers = {
        maxErrorRatePct: 1.0,
        maxSafetyBreaches: 0,
        minCompletionRatePct: 45.0,
        maxP95LatencyMs: 5000,
        disparityImpactRatioMin: 0.80,
      };

      // 1 safety breach must immediately trigger rollback
      const evalBreach = evaluateRollbackTriggers(triggers, {
        errorRatePct: 0.1,
        safetyBreachesCount: 1,
        completionRatePct: 60.0,
        p95LatencyMs: 200,
        disparityImpactRatio: 0.95,
      });

      expect(evalBreach.shouldRollback).toBe(true);
      expect(evalBreach.violatedTrigger).toBe("maxSafetyBreaches");
    });

    it("evaluates rollback triggers on error rate spike and completion degradation", () => {
      const triggers = {
        maxErrorRatePct: 1.0,
        maxSafetyBreaches: 0,
        minCompletionRatePct: 45.0,
        maxP95LatencyMs: 5000,
        disparityImpactRatioMin: 0.80,
      };

      const evalError = evaluateRollbackTriggers(triggers, {
        errorRatePct: 3.5, // > 1.0%
        safetyBreachesCount: 0,
        completionRatePct: 50.0,
        p95LatencyMs: 300,
        disparityImpactRatio: 0.90,
      });

      expect(evalError.shouldRollback).toBe(true);
      expect(evalError.violatedTrigger).toBe("maxErrorRatePct");
    });

    it("computes live telemetry and triggers automated circuit breaker rollback on safety anomalies", () => {
      const activeProposal: PolicyProposal = {
        ...sampleProposal,
        versionRecord: {
          version: "2.1.0",
          rulesHash: "sha256-test",
          manifestId: "man-1",
          parentVersion: "2.0.0",
          changelog: [],
          publishedAt: new Date().toISOString(),
          publishedByUserId: "admin-1",
        },
        deployment: {
          deploymentId: "dep-1",
          phase: "CANARY",
          trafficAllocationPct: 20,
          targetTenants: ["tenant-horizon"],
          deployedAt: new Date().toISOString(),
          deployedByUserId: "admin-1",
          automatedRollbackTriggers: {
            maxErrorRatePct: 1.0,
            maxSafetyBreaches: 0,
            minCompletionRatePct: 45.0,
            maxP95LatencyMs: 5000,
            disparityImpactRatioMin: 0.80,
          },
          isActive: true,
          trafficRouterSeed: "seed-123",
        },
      };

      const telemetry = computePolicyMonitoringTelemetry(activeProposal, [
        { success: true, latencyMs: 120, completionAchieved: true },
        { success: false, latencyMs: 300, isSafetyBreach: true }, // Safety breach sample
      ]);

      expect(telemetry.rollbackTriggered).toBe(true);
      expect(telemetry.healthStatus).toBe("CRITICAL_ROLLBACK_TRIGGERED");
      expect(telemetry.rollbackReason).toContain("safety violation");
    });
  });
});
