import { describe, expect, it } from "vitest";
import {
  runFounderDemo,
  getScene1Population,
  getScene2Prioritization,
  getScene3AgentExecution,
  getScene4HumanIntervention,
  getScene5Completion,
  getScene6Equity,
  getScene7Learning,
} from "@/simulation/founder-demo";

describe("Founder Demo Mode - Scripted 7-Scene Showcase", () => {
  describe("Scene 1: Population Intake & Ingestion", () => {
    it("simulates batch referral ingestion with normalization and duplicate catching", () => {
      const scene = getScene1Population(500);

      expect(scene.sceneNumber).toBe(1);
      expect(scene.id).toBe("population");
      expect(scene.founderNarration).toContain("500 real-world behavioral health referrals");
      expect(scene.liveData.totalIngested).toBe(500);
      expect(scene.liveData.acceptedAndNormalized).toBeGreaterThan(480);
      expect(scene.liveData.quarantinedMalformedOrDuplicates).toBeLessThan(20);
      expect(scene.liveData.throughputPerSecond).toBeGreaterThan(1000);
      expect(scene.liveData.specialtyBreakdown).toHaveProperty("Adult Psychiatry");
      expect(scene.liveData.payerMix).toHaveProperty("Medicaid Managed Care");
    });
  });

  describe("Scene 2: Prioritization & Risk Stratification", () => {
    it("stratifies population into prioritized tiers using multi-factor scoring", () => {
      const scene = getScene2Prioritization();

      expect(scene.sceneNumber).toBe(2);
      expect(scene.id).toBe("prioritization");
      expect(scene.founderNarration).toContain("deterministic triage engine scores every case from 0 to 100");
      expect(scene.liveData.triageMethodology).toContain("Multi-Factor Mathematical Priority Engine");
      expect(scene.liveData.tierBreakdown).toHaveLength(3);

      const [tier1, tier2, tier3] = scene.liveData.tierBreakdown;
      expect(tier1.tier).toContain("Tier 1");
      expect(tier1.count).toBe(42);
      expect(tier2.tier).toContain("Tier 2");
      expect(tier3.tier).toContain("Tier 3");

      expect(scene.liveData.samplePrioritizedCases).toHaveLength(2);
      expect(scene.liveData.samplePrioritizedCases[0].score).toBeGreaterThan(80);
    });
  });

  describe("Scene 3: Transparent Agent Execution", () => {
    it("displays complete case anatomy: Goal, State, Barrier, Evidence, Next Action, Tool, Policy, Execution, Result", () => {
      const scene = getScene3AgentExecution();

      expect(scene.sceneNumber).toBe(3);
      expect(scene.id).toBe("agent_execution");

      const caseData = scene.liveData;
      expect(caseData.caseId).toBe("CASE-8821");
      expect(caseData.member.name).toBe("Mateo Vance");

      // 1. Goal
      expect(caseData.goal).toBe("First completed in-network behavioral health outpatient visit within 14 days");

      // 2. State
      expect(caseData.state).toBe("BARRIER_IDENTIFIED");

      // 3. Barrier
      expect(caseData.barrier.category).toBe("CHILDCARE_DEFICIT");
      expect(caseData.barrier.confidence).toBeGreaterThan(0.9);

      // 4. Evidence
      expect(caseData.evidence).toHaveLength(3);
      expect(caseData.evidence[0].source).toBe("PCP_REFERRAL_CLINICAL_NOTE");
      expect(caseData.evidence[1].source).toBe("SDOH_STRUCTURED_SCREENER");

      // 5. Next Action
      expect(caseData.nextAction).toContain("weekend morning telehealth");

      // 6. Tool
      expect(caseData.tool.name).toBe("search_providers");
      expect(caseData.tool.deterministic).toBe(true);

      // 7. Policy
      expect(caseData.policy.verdict).toBe("ALLOW");
      expect(caseData.policy.ruleId).toBe("POLICY_TELEHEALTH_AND_IN_NETWORK_MATCH");

      // 8. Execution
      expect(caseData.execution.latencyMs).toBeLessThan(100);
      expect(caseData.execution.costUSD).toBe(0);

      // 9. Result
      expect(caseData.result.newState).toBe("APPOINTMENT_SCHEDULED");
      expect(caseData.result.slotReserved).toContain("Dr. Elena Warren, PsyD");
      expect(caseData.result.confirmationDispatched).toBe(true);
      expect(caseData.result.auditHash).toMatch(/^0x[a-f0-9]{16}$/);
    });
  });

  describe("Scene 4: Human Intervention Gate", () => {
    it("demonstrates policy pause, clinical review queue, and safe authenticated resumption", () => {
      const scene = getScene4HumanIntervention();

      expect(scene.sceneNumber).toBe(4);
      expect(scene.id).toBe("human_intervention");

      const caseData = scene.liveData;
      expect(caseData.caseId).toBe("CASE-9042");
      expect(caseData.member.clinicalAcuity).toBe("HIGH");
      expect(caseData.stateBefore).toBe("REQUIRES_HUMAN_REVIEW");

      // Policy boundary
      expect(caseData.encounteredPolicy.verdict).toBe("REQUIRE_HUMAN_APPROVAL");
      expect(caseData.encounteredPolicy.ruleId).toBe("POLICY_CLINICAL_CRISIS_AND_FINANCIAL_EXCEPTION");

      // Care Manager workbench review
      expect(caseData.careManagerWorkbench.assignedClinician).toContain("Sarah Jenkins");
      expect(caseData.careManagerWorkbench.reviewQueueUrgency).toBe("HIGH_PRIORITY");

      // Human action taken
      expect(caseData.humanActionTaken.decision).toBe("APPROVED");
      expect(caseData.humanActionTaken.reviewerRole).toBe("CARE_MANAGER");
      expect(caseData.humanActionTaken.approvedFundingLimitUSD).toBe(180);

      // Resumption
      expect(caseData.resumption.newState).toBe("INTERVENTION_IN_PROGRESS");
      expect(caseData.resumption.resumedAgent).toBe("SchedulingAgent");
    });
  });

  describe("Scene 5: Verified Completion", () => {
    it("proves actual care delivery via dual-source corroboration (clinic check-in + claim)", () => {
      const scene = getScene5Completion();

      expect(scene.sceneNumber).toBe(5);
      expect(scene.id).toBe("completion");

      const caseData = scene.liveData;
      expect(caseData.caseId).toBe("CASE-8821");

      const verification = caseData.careLoopMultiSourceVerification;
      expect(verification.signalA_ClinicCheckIn.source).toBe("EHR_ELECTRONIC_ATTENDANCE");
      expect(verification.signalA_ClinicCheckIn.status).toBe("ATTENDED_50_MIN_SESSION");

      expect(verification.signalB_AdjudicatedClaim.source).toBe("EDI_837P_CLAIM");
      expect(verification.signalB_AdjudicatedClaim.adjudicationStatus).toBe("PAID");

      expect(verification.verificationVerdict).toBe("VERIFIED_COMPLETION");
      expect(verification.deterministicStateTransition.before).toBe("APPOINTMENT_COMPLETED");
      expect(verification.deterministicStateTransition.after).toBe("VERIFIED");
      expect(verification.cryptographicAuditHash).toMatch(/^0x[a-f0-9]{16}$/);
    });
  });

  describe("Scene 6: Health Equity & Disparity Remediation", () => {
    it("contrasts unadjusted baseline disparities against post-intervention parity", () => {
      const scene = getScene6Equity();

      expect(scene.sceneNumber).toBe(6);
      expect(scene.id).toBe("equity");

      const equity = scene.liveData;
      expect(equity.unadjustedBaseline.disparityGapPercent).toBe(37.8);
      expect(equity.barrierPrevalenceByCohort.length).toBeGreaterThanOrEqual(4);

      // CareLoop closes disparity gap to 1.4%
      expect(equity.careLoopRemediationImpact.disparityGapClosedToPercent).toBe(1.4);
      expect(equity.careLoopRemediationImpact.postInterventionMedicaidCompletion).toBe(63.8);
      expect(equity.careLoopRemediationImpact.postInterventionCommercialCompletion).toBe(65.2);
    });
  });

  describe("Scene 7: Closed-Loop Learning", () => {
    it("demonstrates randomized trial and automatic policy update for proven interventions", () => {
      const scene = getScene7Learning();

      expect(scene.sceneNumber).toBe(7);
      expect(scene.id).toBe("learning");

      const learning = scene.liveData;
      expect(learning.targetBarrier).toBe("TRANSPORTATION_DEFICIT");
      expect(learning.variants).toHaveLength(2);

      const [variantA, variantB] = learning.variants;
      expect(variantA.completionRatePercent).toBe(29.1);
      expect(variantB.completionRatePercent).toBe(74.6);

      expect(learning.statisticalOutcome.relativeLiftPercent).toBeGreaterThan(100);
      expect(learning.statisticalOutcome.statisticallySignificant).toBe(true);
      expect(learning.feedbackLoopAction).toContain("promoted Variant B to default intervention policy");
    });
  });

  describe("Master Founder Demo Orchestrator", () => {
    it("runs complete 7-scene script with summary KPIs and executive presentation contracts", () => {
      const fullDemo = runFounderDemo({ batchSize: 500 });

      expect(fullDemo.overview.title).toContain("Founder Demonstration Script");
      expect(fullDemo.scenes).toHaveLength(7);
      expect(fullDemo.summaryKpis.totalReferralsIngested).toBe(500);
      expect(fullDemo.summaryKpis.autonomousResolutionPercent).toBeGreaterThan(80);
      expect(fullDemo.summaryKpis.verifiedCompletionRatePercent).toBe(64.6);
      expect(fullDemo.summaryKpis.grossMarginPercent).toBeGreaterThan(80);
    });
  });
});
