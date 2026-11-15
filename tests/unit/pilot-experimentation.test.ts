import { describe, expect, it } from "vitest";
import {
  assertExperimentSafetyGuardrails,
  assignMultiArmExperiment,
  calculateArmExperimentalMetrics,
  EXPERIMENT_ARM_DEFINITIONS,
  ExperimentSafetyViolationError,
  generateMultiArmComparativeReport,
  MultiArmCaseRecord,
} from "@/domain/pilot/experimentation-engine";
import { StratificationFactors } from "@/domain/pilot/pilot-protocol";
import { simulateMultiArmCohort } from "@/domain/pilot/experiment-simulator";

describe("Agentic Pilot Experimentation & Multi-Arm Comparison (Unit Tests)", () => {
  describe("Member Safety & Policy Guardrails", () => {
    it("halts experiment immediately and throws when acute psychiatric crisis indicators are present", () => {
      expect(() => {
        assertExperimentSafetyGuardrails("INTERVENTION_A", {
          memberId: "MEM-CRISIS-1",
          hasAcuteCrisisIndicators: true,
          consentOutreach: true,
          consentSms: true,
          proposedAction: "send_member_communication",
          providerContracted: true,
          providerVerifiedAvailability: true,
        });
      }).toThrowError(ExperimentSafetyViolationError);
    });

    it("rejects non-clinical scope violations such as diagnosis or prescription advice", () => {
      expect(() => {
        assertExperimentSafetyGuardrails("INTERVENTION_A", {
          memberId: "MEM-SAFE-1",
          hasAcuteCrisisIndicators: false,
          consentOutreach: true,
          consentSms: true,
          proposedAction: "send_member_communication",
          textPayloads: ["We diagnose your severe anxiety and prescribe 20mg fluoxetine."],
          providerContracted: true,
          providerVerifiedAvailability: true,
        });
      }).toThrow();
    });

    it("enforces member consent boundary and blocks outreach if consent is missing", () => {
      expect(() => {
        assertExperimentSafetyGuardrails("INTERVENTION_A", {
          memberId: "MEM-NOCONSENT-1",
          hasAcuteCrisisIndicators: false,
          consentOutreach: false,
          consentSms: false,
          proposedAction: "send_member_communication",
          providerContracted: true,
          providerVerifiedAvailability: true,
        });
      }).toThrowError(ExperimentSafetyViolationError);
    });

    it("enforces network integrity and blocks booking with uncontracted providers", () => {
      expect(() => {
        assertExperimentSafetyGuardrails("INTERVENTION_B", {
          memberId: "MEM-NETWORK-1",
          hasAcuteCrisisIndicators: false,
          consentOutreach: true,
          consentSms: true,
          proposedAction: "schedule_appointment",
          providerContracted: false,
          providerVerifiedAvailability: true,
        });
      }).toThrowError(ExperimentSafetyViolationError);
    });

    it("enforces autonomous financial voucher limit ($50 threshold)", () => {
      expect(() => {
        assertExperimentSafetyGuardrails("INTERVENTION_A", {
          memberId: "MEM-VOUCHER-1",
          hasAcuteCrisisIndicators: false,
          consentOutreach: true,
          consentSms: true,
          proposedAction: "schedule_appointment",
          providerContracted: true,
          providerVerifiedAvailability: true,
          voucherAmountUSD: 75.0, // Exceeds $50
        });
      }).toThrowError(ExperimentSafetyViolationError);
    });

    it("passes cleanly when all policy and safety invariants are satisfied", () => {
      const res = assertExperimentSafetyGuardrails("INTERVENTION_A", {
        memberId: "MEM-VALID-1",
        hasAcuteCrisisIndicators: false,
        consentOutreach: true,
        consentSms: true,
        proposedAction: "search_providers",
        textPayloads: ["Hola Elena, tenemos una cita disponible con la Dra. Morales este jueves."],
        providerContracted: true,
        providerVerifiedAvailability: true,
        voucherAmountUSD: 25.0,
      });

      expect(res.safe).toBe(true);
      expect(res.haltedForSafety).toBe(false);

      // Also verifies Human-Assisted arm with human approval passes for sensitive communication
      const humanRes = assertExperimentSafetyGuardrails("HUMAN_ASSISTED", {
        memberId: "MEM-VALID-2",
        hasAcuteCrisisIndicators: false,
        consentOutreach: true,
        consentSms: true,
        proposedAction: "send_member_communication",
        humanApproved: true,
        textPayloads: ["Personalized warm outreach draft"],
        providerContracted: true,
        providerVerifiedAvailability: true,
      });
      expect(humanRes.safe).toBe(true);
    });
  });

  describe("Deterministic Stratified Multi-Arm Allocation", () => {
    it("allocates members across all 4 arms with balanced distribution", () => {
      const strata: StratificationFactors = {
        coverageType: "MEDICAID",
        preferredLanguage: "Spanish",
        urbanicity: "URBAN",
        raceEthnicity: "Hispanic/Latino",
      };

      const counts = {
        INTERVENTION_A: 0,
        INTERVENTION_B: 0,
        HUMAN_ASSISTED: 0,
        USUAL_CARE: 0,
      };

      for (let i = 0; i < 4000; i += 1) {
        const arm = assignMultiArmExperiment(`MEM-STRATA-${i}`, strata, 2026);
        counts[arm] += 1;
      }

      // Each arm should receive approximately 25% (20% to 30% bound)
      for (const count of Object.values(counts)) {
        const proportion = count / 4000;
        expect(proportion).toBeGreaterThan(0.20);
        expect(proportion).toBeLessThan(0.30);
      }
    });
  });

  describe("Multi-Arm Tracking & Comparison (All 6 Required Dimensions)", () => {
    it("evaluates a 4-arm cohort across completion, time, cost, member response, human effort, and equity", () => {
      const records = simulateMultiArmCohort({ totalPopulation: 4000, durationMonths: 6, seed: 101 });
      expect(records.length).toBe(4000);

      const report = generateMultiArmComparativeReport(records, 6);

      // Verify all 4 arms exist
      expect(report.arms.INTERVENTION_A).toBeDefined();
      expect(report.arms.INTERVENTION_B).toBeDefined();
      expect(report.arms.HUMAN_ASSISTED).toBeDefined();
      expect(report.arms.USUAL_CARE).toBeDefined();

      const a = report.arms.INTERVENTION_A;
      const b = report.arms.INTERVENTION_B;
      const h = report.arms.HUMAN_ASSISTED;
      const u = report.arms.USUAL_CARE;

      // 1. Completion Dimension
      expect(a.completion.completionRatePct).toBeGreaterThan(u.completion.completionRatePct);
      expect(b.completion.completionRatePct).toBeGreaterThan(u.completion.completionRatePct);
      expect(h.completion.completionRatePct).toBeGreaterThan(u.completion.completionRatePct);
      expect(a.completion.absoluteLiftVsControlPctPoints).toBeGreaterThan(20);
      expect(a.completion.isStatisticallySignificant).toBe(true);

      // 2. Time Dimension
      expect(a.time.daysSavedVsControl).toBeGreaterThan(15);
      expect(b.time.daysSavedVsControl).toBeGreaterThan(15);
      expect(b.time.medianTimeToCompletionDays).toBeLessThan(u.time.medianTimeToCompletionDays!);

      // 3. Cost Dimension
      expect(a.cost.costPerCompletedReferralUSD).toBeLessThan(h.cost.costPerCompletedReferralUSD);
      expect(a.cost.netRoiRatio).toBeGreaterThan(5);

      // 4. Member Response Dimension
      expect(b.memberResponse.responseRatePct).toBeGreaterThan(u.memberResponse.responseRatePct);
      expect(a.memberResponse.avgTouchpointsToResponse).toBeLessThan(3.0);

      // 5. Human Effort Dimension
      expect(a.humanEffort.careManagerMinutesPerCase).toBeLessThan(h.humanEffort.careManagerMinutesPerCase);
      expect(h.humanEffort.careManagerMinutesPerCase).toBeGreaterThan(15);

      // 6. Equity Outcome Dimension
      expect(a.equityOutcome.medicaidDisparityReductionVsControlPct).toBeGreaterThan(40);
      expect(b.equityOutcome.languageDisparityReductionVsControlPct).toBeGreaterThan(40);

      // Safety Invariants
      expect(report.policyAndSafetyAudit.allExperimentsPolicyCompliant).toBe(true);
      expect(report.policyAndSafetyAudit.allMembersSafe).toBe(true);
      expect(report.policyAndSafetyAudit.safetyIncidentsEscalatedImmediately).toBeGreaterThanOrEqual(0);
    });
  });
});
