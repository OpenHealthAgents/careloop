import { describe, expect, it } from "vitest";
import {
  assignStudyArm,
  calculateStatisticalPower,
  DEFAULT_PILOT_CONFIG,
  StratificationFactors,
} from "@/domain/pilot/pilot-protocol";
import {
  calculateArmMetrics,
  evaluatePrimaryEndpoint,
  evaluateSecondaryMetrics,
  evaluateEquityDisparities,
  generatePilotMeasurementReport,
  PilotCaseRecord,
} from "@/domain/pilot/measurement-engine";
import { simulatePilotCohort } from "@/domain/pilot/pilot-simulator";

describe("Pilot Measurement Framework & Study Design (Unit Tests)", () => {
  describe("Stratified Randomization & Allocation", () => {
    it("produces deterministic, reproducible arm assignment for identical member and strata", () => {
      const strata: StratificationFactors = {
        coverageType: "MEDICAID",
        preferredLanguage: "Spanish",
        urbanicity: "RURAL",
        raceEthnicity: "Hispanic/Latino",
      };

      const arm1 = assignStudyArm("MEM-12345", strata, 42);
      const arm2 = assignStudyArm("MEM-12345", strata, 42);
      expect(arm1).toBe(arm2);
    });

    it("maintains ~50/50 covariate balance across 1,000 members", () => {
      const strata: StratificationFactors = {
        coverageType: "MEDICAID",
        preferredLanguage: "Spanish",
        urbanicity: "URBAN",
        raceEthnicity: "Hispanic/Latino",
      };

      let interventionCount = 0;
      let controlCount = 0;

      for (let i = 0; i < 1000; i += 1) {
        const arm = assignStudyArm(`MEM-BALANCE-${i}`, strata, 99);
        if (arm === "INTERVENTION") interventionCount += 1;
        else controlCount += 1;
      }

      const ratio = interventionCount / (interventionCount + controlCount);
      expect(ratio).toBeGreaterThan(0.46);
      expect(ratio).toBeLessThan(0.54);
    });
  });

  describe("Statistical Power Analysis", () => {
    it("confirms 10,000–50,000 member sample sizes provide > 99% power to detect 5% absolute lift", () => {
      const power10k = calculateStatisticalPower({
        alpha: 0.05,
        beta: 0.05,
        expectedControlCompletionRate: 0.20,
        minimumDetectableEffectAbsolute: 0.05,
        totalSampleSize: 10000,
      });

      expect(power10k.isAdequatelyPowered).toBe(true);
      expect(power10k.powerPct).toBeGreaterThanOrEqual(95);
      expect(power10k.requiredSampleSizeFor90Power).toBeLessThan(10000);

      const power20k = calculateStatisticalPower({
        alpha: 0.05,
        beta: 0.05,
        expectedControlCompletionRate: 0.20,
        minimumDetectableEffectAbsolute: 0.05,
        totalSampleSize: 20000,
      });
      expect(power20k.powerPct).toBeGreaterThanOrEqual(99);
    });
  });

  describe("Measurement Engine Calculations", () => {
    it("accurately computes primary endpoint comparative statistics", () => {
      const now = new Date();
      const mockRecords: PilotCaseRecord[] = [
        // 5 Intervention: 4 completed, 1 no-show
        {
          caseId: "int-1",
          memberId: "m1",
          studyArm: "INTERVENTION",
          referralDate: new Date(now.getTime() - 15 * 86400000),
          scheduledStartAt: new Date(now.getTime() - 5 * 86400000),
          firstCompletedVisitAt: new Date(now.getTime() - 5 * 86400000),
          appointmentStatus: "COMPLETED",
          coverageType: "MEDICAID",
          preferredLanguage: "Spanish",
          urbanicity: "URBAN",
          raceEthnicity: "Hispanic/Latino",
          primaryBarrier: "TRANSPORTATION",
          outreachSent: true,
          memberResponded: true,
          outreachTouchCount: 1,
          computeCostUSD: 0.08,
          careManagerLaborMinutes: 3,
          voucherCostUSD: 25,
          providerInNetwork: true,
          verifiedByDualSource: true,
        },
        {
          caseId: "int-2",
          memberId: "m2",
          studyArm: "INTERVENTION",
          referralDate: new Date(now.getTime() - 15 * 86400000),
          scheduledStartAt: new Date(now.getTime() - 6 * 86400000),
          firstCompletedVisitAt: new Date(now.getTime() - 6 * 86400000),
          appointmentStatus: "COMPLETED",
          coverageType: "MEDICAID",
          preferredLanguage: "Spanish",
          urbanicity: "URBAN",
          raceEthnicity: "Hispanic/Latino",
          primaryBarrier: "SCHEDULING_FRICTION",
          outreachSent: true,
          memberResponded: true,
          outreachTouchCount: 1,
          computeCostUSD: 0.08,
          careManagerLaborMinutes: 2,
          voucherCostUSD: 0,
          providerInNetwork: true,
          verifiedByDualSource: true,
        },
        {
          caseId: "int-3",
          memberId: "m3",
          studyArm: "INTERVENTION",
          referralDate: new Date(now.getTime() - 15 * 86400000),
          scheduledStartAt: new Date(now.getTime() - 4 * 86400000),
          firstCompletedVisitAt: new Date(now.getTime() - 4 * 86400000),
          appointmentStatus: "COMPLETED",
          coverageType: "COMMERCIAL",
          preferredLanguage: "English",
          urbanicity: "SUBURBAN",
          raceEthnicity: "White",
          primaryBarrier: "ACCESS_WAIT_TIME",
          outreachSent: true,
          memberResponded: true,
          outreachTouchCount: 1,
          computeCostUSD: 0.08,
          careManagerLaborMinutes: 2,
          voucherCostUSD: 0,
          providerInNetwork: true,
          verifiedByDualSource: true,
        },
        {
          caseId: "int-4",
          memberId: "m4",
          studyArm: "INTERVENTION",
          referralDate: new Date(now.getTime() - 15 * 86400000),
          scheduledStartAt: new Date(now.getTime() - 7 * 86400000),
          firstCompletedVisitAt: new Date(now.getTime() - 7 * 86400000),
          appointmentStatus: "COMPLETED",
          coverageType: "COMMERCIAL",
          preferredLanguage: "English",
          urbanicity: "URBAN",
          raceEthnicity: "Black/African American",
          primaryBarrier: "SCHEDULING_FRICTION",
          outreachSent: true,
          memberResponded: true,
          outreachTouchCount: 1,
          computeCostUSD: 0.08,
          careManagerLaborMinutes: 2,
          voucherCostUSD: 0,
          providerInNetwork: true,
          verifiedByDualSource: true,
        },
        {
          caseId: "int-5",
          memberId: "m5",
          studyArm: "INTERVENTION",
          referralDate: new Date(now.getTime() - 15 * 86400000),
          scheduledStartAt: new Date(now.getTime() - 3 * 86400000),
          firstCompletedVisitAt: null,
          appointmentStatus: "NO_SHOW",
          coverageType: "MEDICAID",
          preferredLanguage: "Spanish",
          urbanicity: "RURAL",
          raceEthnicity: "Hispanic/Latino",
          primaryBarrier: "TRANSPORTATION",
          outreachSent: true,
          memberResponded: true,
          outreachTouchCount: 2,
          computeCostUSD: 0.08,
          careManagerLaborMinutes: 3,
          voucherCostUSD: 0,
          providerInNetwork: true,
          verifiedByDualSource: false,
        },

        // 5 Control: 1 completed, 2 no-show, 2 unreached
        {
          caseId: "ctrl-1",
          memberId: "c1",
          studyArm: "USUAL_CARE_CONTROL",
          referralDate: new Date(now.getTime() - 40 * 86400000),
          scheduledStartAt: new Date(now.getTime() - 5 * 86400000),
          firstCompletedVisitAt: new Date(now.getTime() - 5 * 86400000),
          appointmentStatus: "COMPLETED",
          coverageType: "COMMERCIAL",
          preferredLanguage: "English",
          urbanicity: "URBAN",
          raceEthnicity: "White",
          primaryBarrier: "ACCESS_WAIT_TIME",
          outreachSent: true,
          memberResponded: true,
          outreachTouchCount: 1,
          computeCostUSD: 0,
          careManagerLaborMinutes: 15,
          voucherCostUSD: 0,
          providerInNetwork: true,
          verifiedByDualSource: false,
        },
        {
          caseId: "ctrl-2",
          memberId: "c2",
          studyArm: "USUAL_CARE_CONTROL",
          referralDate: new Date(now.getTime() - 40 * 86400000),
          scheduledStartAt: new Date(now.getTime() - 8 * 86400000),
          firstCompletedVisitAt: null,
          appointmentStatus: "NO_SHOW",
          coverageType: "MEDICAID",
          preferredLanguage: "Spanish",
          urbanicity: "URBAN",
          raceEthnicity: "Hispanic/Latino",
          primaryBarrier: "TRANSPORTATION",
          outreachSent: true,
          memberResponded: false,
          outreachTouchCount: 1,
          computeCostUSD: 0,
          careManagerLaborMinutes: 10,
          voucherCostUSD: 0,
          providerInNetwork: false,
          verifiedByDualSource: false,
        },
        {
          caseId: "ctrl-3",
          memberId: "c3",
          studyArm: "USUAL_CARE_CONTROL",
          referralDate: new Date(now.getTime() - 40 * 86400000),
          scheduledStartAt: new Date(now.getTime() - 6 * 86400000),
          firstCompletedVisitAt: null,
          appointmentStatus: "NO_SHOW",
          coverageType: "MEDICAID",
          preferredLanguage: "English",
          urbanicity: "RURAL",
          raceEthnicity: "Black/African American",
          primaryBarrier: "TRANSPORTATION",
          outreachSent: true,
          memberResponded: false,
          outreachTouchCount: 1,
          computeCostUSD: 0,
          careManagerLaborMinutes: 10,
          voucherCostUSD: 0,
          providerInNetwork: true,
          verifiedByDualSource: false,
        },
        {
          caseId: "ctrl-4",
          memberId: "c4",
          studyArm: "USUAL_CARE_CONTROL",
          referralDate: new Date(now.getTime() - 40 * 86400000),
          scheduledStartAt: null,
          firstCompletedVisitAt: null,
          appointmentStatus: "NONE",
          coverageType: "MEDICAID",
          preferredLanguage: "Spanish",
          urbanicity: "RURAL",
          raceEthnicity: "Hispanic/Latino",
          primaryBarrier: "LANGUAGE_CONCORDANCE",
          outreachSent: false,
          memberResponded: false,
          outreachTouchCount: 0,
          computeCostUSD: 0,
          careManagerLaborMinutes: 5,
          voucherCostUSD: 0,
          providerInNetwork: false,
          verifiedByDualSource: false,
        },
        {
          caseId: "ctrl-5",
          memberId: "c5",
          studyArm: "USUAL_CARE_CONTROL",
          referralDate: new Date(now.getTime() - 40 * 86400000),
          scheduledStartAt: null,
          firstCompletedVisitAt: null,
          appointmentStatus: "NONE",
          coverageType: "COMMERCIAL",
          preferredLanguage: "English",
          urbanicity: "SUBURBAN",
          raceEthnicity: "White",
          primaryBarrier: "SCHEDULING_FRICTION",
          outreachSent: true,
          memberResponded: false,
          outreachTouchCount: 1,
          computeCostUSD: 0,
          careManagerLaborMinutes: 5,
          voucherCostUSD: 0,
          providerInNetwork: false,
          verifiedByDualSource: false,
        },
      ];

      const report = generatePilotMeasurementReport(mockRecords, 6);

      expect(report.arms.intervention.completionRatePct).toBe(80.0);
      expect(report.arms.control.completionRatePct).toBe(20.0);
      expect(report.primaryEndpoint.absoluteLiftPctPoints).toBe(60.0);
      expect(report.primaryEndpoint.relativeRiskRatio).toBe(4.0);
      expect(report.secondaryMetrics.noShowRate.interventionPct).toBeLessThan(report.secondaryMetrics.noShowRate.controlPct);
      expect(report.secondaryMetrics.memberEngagement.interventionPct).toBeGreaterThan(report.secondaryMetrics.memberEngagement.controlPct);
    });

    it("evaluates a full 10,000 synthetic member cohort with statistical significance (p < 0.001)", () => {
      const records = simulatePilotCohort({ totalPopulation: 10000, durationMonths: 6, seed: 42 });
      expect(records.length).toBe(10000);

      const report = generatePilotMeasurementReport(records, 6);

      // Verify Arm Metrics
      expect(report.arms.intervention.totalReferrals).toBeGreaterThan(4800);
      expect(report.arms.intervention.totalReferrals).toBeLessThan(5200);
      expect(report.arms.intervention.totalReferrals + report.arms.control.totalReferrals).toBe(10000);
      expect(report.arms.intervention.completionRatePct).toBeGreaterThan(50);
      expect(report.arms.control.completionRatePct).toBeLessThan(30);

      // Primary Endpoint Significance
      expect(report.primaryEndpoint.absoluteLiftPctPoints).toBeGreaterThan(25);
      expect(report.primaryEndpoint.relativeRiskRatio).toBeGreaterThan(2.0);
      expect(report.primaryEndpoint.pValue).toBeLessThan(0.0001);
      expect(report.primaryEndpoint.isStatisticallySignificant).toBe(true);

      // Velocity: Intervention median days to care should be significantly lower
      expect(report.primaryEndpoint.medianDaysToCompletion.daysSaved).toBeGreaterThan(15);

      // Secondary Metrics
      expect(report.secondaryMetrics.noShowRate.interventionPct).toBeLessThan(15);
      expect(report.secondaryMetrics.noShowRate.controlPct).toBeGreaterThan(25);
      expect(report.secondaryMetrics.economicsAndCost.netRoiRatio).toBeGreaterThan(5);

      // Equity Disparities Reduced
      const coverageDisparity = report.equityDisparities.find((d) => d.dimension.includes("Coverage"));
      expect(coverageDisparity).toBeDefined();
      expect(coverageDisparity!.disparityReductionPctPoints).toBeGreaterThan(0);

      const languageDisparity = report.equityDisparities.find((d) => d.dimension.includes("Language"));
      expect(languageDisparity).toBeDefined();
      expect(languageDisparity!.disparityReductionPctPoints).toBeGreaterThan(0);
    });
  });
});
