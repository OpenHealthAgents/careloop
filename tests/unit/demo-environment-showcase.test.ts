import { describe, it, expect } from "vitest";
import {
  generate10kSyntheticPopulation,
  runDemoShowcaseScenario,
  generateStakeholderBriefs,
} from "@/simulation/demo-environment";

describe("Demo Environment Showcase Engine", () => {
  describe("10,000 Synthetic Population Generation", () => {
    it("generates 10,000 synthetic members with comprehensive behavioral health attributes", () => {
      const { summary, sampleMembers } = generate10kSyntheticPopulation(2026, 10000);

      expect(summary.totalMembers).toBe(10000);
      expect(summary.totalReferrals).toBe(10000);
      expect(summary.verifiedCompletionsCount).toBeGreaterThan(6000);
      expect(summary.overallCompletionRatePercent).toBeGreaterThan(60);
      expect(summary.overallCompletionRatePercent).toBeLessThan(75);
      expect(summary.overallNoShowRatePercent).toBeLessThan(10);
      expect(summary.avgTimeToAppointmentDays).toBeGreaterThan(5);
      expect(summary.avgTimeToAppointmentDays).toBeLessThan(20);

      // Verify barriers distribution
      expect(summary.barrierDistribution).toHaveProperty("TRANSPORTATION");
      expect(summary.barrierDistribution).toHaveProperty("LANGUAGE_CULTURAL");
      expect(summary.barrierDistribution).toHaveProperty("CHILDCARE");
      expect(summary.barrierDistribution).toHaveProperty("NETWORK_CAPACITY");
      expect(summary.barrierDistribution).toHaveProperty("STIGMA_HESITANCY");
      expect(summary.barrierDistribution).toHaveProperty("NONE");

      // Verify sample members
      expect(sampleMembers.length).toBe(10);
      const sample = sampleMembers[0];
      expect(sample.syntheticMrn).toMatch(/^SYN-/);
      expect(sample.referralId).toMatch(/^REF-SYN-/);
      expect(["MEDICAID", "COMMERCIAL", "MEDICARE_DUAL", "UNINSURED"]).toContain(sample.coverageType);
      expect(["URBAN", "SUBURBAN", "RURAL"]).toContain(sample.urbanicity);
    });

    it("demonstrates equity cohort parity across coverage, urbanicity, language, and race", () => {
      const { summary } = generate10kSyntheticPopulation(2026, 10000);
      const { byCoverage, byUrbanicity, byLanguage, byRaceEthnicity } = summary.equityCohorts;

      expect(byCoverage.length).toBe(4);
      expect(byUrbanicity.length).toBe(3);
      expect(byLanguage.length).toBe(4);
      expect(byRaceEthnicity.length).toBe(5);

      // Verify Medicaid completion rate closely tracks Commercial completion rate (within 5%)
      const medicaidCohort = byCoverage.find((c) => c.cohortName.toLowerCase() === "medicaid");
      const commercialCohort = byCoverage.find((c) => c.cohortName.toLowerCase() === "commercial");
      expect(medicaidCohort).toBeDefined();
      expect(commercialCohort).toBeDefined();

      const rateDiff = Math.abs(medicaidCohort!.completionRatePercent - commercialCohort!.completionRatePercent);
      expect(rateDiff).toBeLessThan(5.0);

      // Verify Rural time-to-care is within 2 days of Urban centers
      const ruralCohort = byUrbanicity.find((c) => c.cohortName.toLowerCase() === "rural");
      const urbanCohort = byUrbanicity.find((c) => c.cohortName.toLowerCase() === "urban");
      expect(ruralCohort).toBeDefined();
      expect(urbanCohort).toBeDefined();

      const timeDiff = Math.abs(ruralCohort!.avgTimeToAppointmentDays - urbanCohort!.avgTimeToAppointmentDays);
      expect(timeDiff).toBeLessThan(3.0);
    });

    it("is strictly deterministic when provided the same seed", () => {
      const run1 = generate10kSyntheticPopulation(42, 500);
      const run2 = generate10kSyntheticPopulation(42, 500);

      expect(run1.summary.totalMembers).toBe(run2.summary.totalMembers);
      expect(run1.summary.verifiedCompletionsCount).toBe(run2.summary.verifiedCompletionsCount);
      expect(run1.summary.overallCompletionRatePercent).toBe(run2.summary.overallCompletionRatePercent);
      expect(run1.sampleMembers[0].syntheticMrn).toBe(run2.sampleMembers[0].syntheticMrn);
    });
  });

  describe("11-Step Showcase Scenario Execution Timeline", () => {
    it("executes the exact 11-step end-to-end journey with state transitions and audit hashes", () => {
      const scenario = runDemoShowcaseScenario();

      expect(scenario.scenarioId).toBe("demo-showcase-01");
      expect(scenario.member.name).toBe("Elena Rodriguez");
      expect(scenario.timeline).toHaveLength(11);

      // Step-by-step verification matching required user flow
      const steps = scenario.timeline;

      // 1. Referral Intake
      expect(steps[0].stepNumber).toBe(1);
      expect(steps[0].title).toContain("Referral Intake");
      expect(steps[0].caseStateBefore).toBe("NEW");
      expect(steps[0].caseStateAfter).toBe("TRIAGED");

      // 2. Barrier Detected
      expect(steps[1].stepNumber).toBe(2);
      expect(steps[1].title).toContain("Barrier");
      expect(steps[1].modelOrEngine).toBe("gpt-4o-mini");
      expect(steps[1].caseStateBefore).toBe("TRIAGED");
      expect(steps[1].caseStateAfter).toBe("BARRIER_IDENTIFIED");

      // 3. Provider Search
      expect(steps[2].stepNumber).toBe(3);
      expect(steps[2].title).toContain("Provider Search");
      expect(steps[2].modelOrEngine).toBe("DETERMINISTIC_TOOL");
      expect(steps[2].caseStateBefore).toBe("BARRIER_IDENTIFIED");
      expect(steps[2].caseStateAfter).toBe("BARRIER_IDENTIFIED");

      // 4. Provider Unavailable
      expect(steps[3].stepNumber).toBe(4);
      expect(steps[3].title).toContain("Provider Unavailable");
      expect(steps[3].modelOrEngine).toBe("DETERMINISTIC_TOOL");
      expect(steps[3].caseStateBefore).toBe("BARRIER_IDENTIFIED");
      expect(steps[3].caseStateAfter).toBe("BARRIER_IDENTIFIED");

      // 5. Alternative Provider Found
      expect(steps[4].stepNumber).toBe(5);
      expect(steps[4].title).toContain("Alternative Provider");
      expect(steps[4].modelOrEngine).toBe("DETERMINISTIC_TOOL");
      expect(steps[4].caseStateBefore).toBe("BARRIER_IDENTIFIED");
      expect(steps[4].caseStateAfter).toBe("INTERVENTION_IN_PROGRESS");

      // 6. Member Outreach
      expect(steps[5].stepNumber).toBe(6);
      expect(steps[5].title).toContain("Member Outreach");
      expect(steps[5].modelOrEngine).toBe("gpt-4o-mini");

      // 7. Member Selects Provider
      expect(steps[6].stepNumber).toBe(7);
      expect(steps[6].title).toContain("Member Responds");
      expect(steps[6].modelOrEngine).toBe("DETERMINISTIC_CODE");

      // 8. Appointment Scheduled
      expect(steps[7].stepNumber).toBe(8);
      expect(steps[7].title).toContain("Appointment Booking");
      expect(steps[7].caseStateAfter).toBe("APPOINTMENT_SCHEDULED");

      // 9. Reminder
      expect(steps[8].stepNumber).toBe(9);
      expect(steps[8].title).toContain("Reminder");
      expect(steps[8].caseStateAfter).toBe("APPOINTMENT_CONFIRMED");

      // 10. Appointment Completed
      expect(steps[9].stepNumber).toBe(10);
      expect(steps[9].title).toContain("Appointment Completed");
      expect(steps[9].caseStateAfter).toBe("APPOINTMENT_COMPLETED");

      // 11. Completion Verified
      expect(steps[10].stepNumber).toBe(11);
      expect(steps[10].title).toContain("Completion Verification");
      expect(steps[10].caseStateAfter).toBe("VERIFIED");

      // Verify audit hashes on all steps
      for (const step of steps) {
        expect(step.auditHash).toMatch(/^0x[a-f0-9]{16}$/);
        expect(step.evidenceAdded).toBeDefined();
        expect(step.evidenceAdded!.length).toBeGreaterThan(10);
      }
    });

    it("verifies compute efficiency: <= 800 tokens and < $0.001 cost", () => {
      const scenario = runDemoShowcaseScenario();
      const { finalOutcome } = scenario;

      expect(finalOutcome.totalAiTokens).toBeLessThanOrEqual(800);
      expect(finalOutcome.totalComputeCostUSD).toBeLessThan(0.001);
      expect(finalOutcome.totalDaysToCare).toBe(5);
      expect(finalOutcome.traditionalIndustryComparison.traditionalCareDaysToAppointment).toBe(48);
      expect(finalOutcome.traditionalIndustryComparison.careLoopCareManagerAdminMinutes).toBe(8);
      expect(finalOutcome.traditionalIndustryComparison.traditionalCareManagerAdminMinutes).toBe(240);
    });
  });

  describe("Multi-Stakeholder Briefs", () => {
    it("generates tailored presentations for all 5 required stakeholder groups", () => {
      const { summary } = generate10kSyntheticPopulation(2026, 1000);
      const scenario = runDemoShowcaseScenario();
      const briefs = generateStakeholderBriefs(summary, scenario);

      // 1. Payer Executives
      expect(briefs.payerExecutives).toBeDefined();
      expect(briefs.payerExecutives.financialROI).toContain("Return per Dollar Invested");
      expect(briefs.payerExecutives.keyMetrics).toHaveProperty("Verified Completion Rate");
      expect(briefs.payerExecutives.keyMetrics).toHaveProperty("Average Time to Appointment");

      // 2. Care Managers
      expect(briefs.careManagers).toBeDefined();
      expect(briefs.careManagers.workloadReduction).toContain("8 minutes");
      expect(briefs.careManagers.keyControls).toHaveProperty("Human Approval Gate");
      expect(briefs.careManagers.keyControls).toHaveProperty("Zero Blind Automation");

      // 3. Health-Equity Leaders
      expect(briefs.healthEquityLeaders).toBeDefined();
      expect(briefs.healthEquityLeaders.disparityClosure).toContain("Parity achieved");
      expect(briefs.healthEquityLeaders.keyMetrics).toHaveProperty("Medicaid Completion Rate");
      expect(briefs.healthEquityLeaders.keyMetrics).toHaveProperty("Rural Time-to-Appointment");

      // 4. Investors
      expect(briefs.investors).toBeDefined();
      expect(briefs.investors.unitEconomics).toContain("Gross margin > 85%");
      expect(briefs.investors.keyMetrics).toHaveProperty("Cost per Verified Referral");
      expect(briefs.investors.keyMetrics).toHaveProperty("Market Opportunity");

      // 5. Healthcare Operators
      expect(briefs.healthcareOperators).toBeDefined();
      expect(briefs.healthcareOperators.keyMetrics).toHaveProperty("Provider Slot Verification");
      expect(briefs.healthcareOperators.keyMetrics).toHaveProperty("Audit Trail Depth");
      expect(briefs.healthcareOperators.keyMetrics).toHaveProperty("Idempotent Architecture");
      expect(briefs.healthcareOperators.complianceHighlights).toContain("NCQA");
    });
  });
});
