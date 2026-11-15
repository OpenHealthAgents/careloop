import { describe, expect, it } from "vitest";
import {
  assertNoAutonomousPolicyMutation,
  calculateFrictionScore,
  CompletedCaseLearningSnapshot,
  findBestInterventionForBarrierAndContext,
  OptimalInterventionQuery,
  PolicyGovernanceViolationError,
} from "@/domain/learning/learning-system";

describe("Learning System Domain & Friction Analytics (Unit Tests)", () => {
  describe("Friction Score Calculation", () => {
    it("computes low friction score for rapid, low-labor, high-attendance care", () => {
      const friction = calculateFrictionScore({
        medianTimeToCareDays: 8,
        avgLaborMinutes: 3,
        noShowRatePct: 9,
      });

      expect(friction.compositeScore).toBeLessThan(20);
      expect(friction.breakdown.timeFriction).toBeLessThan(25);
      expect(friction.breakdown.laborFriction).toBeLessThan(15);
      expect(friction.breakdown.schedulingFriction).toBe(9);
    });

    it("computes high friction score for delayed, labor-heavy, high-no-show usual care", () => {
      const friction = calculateFrictionScore({
        medianTimeToCareDays: 42,
        avgLaborMinutes: 28,
        noShowRatePct: 38,
      });

      expect(friction.compositeScore).toBeGreaterThan(70);
      expect(friction.breakdown.timeFriction).toBe(100);
      expect(friction.breakdown.laborFriction).toBeGreaterThan(90);
    });
  });

  describe("Optimal Intervention Query Engine", () => {
    it("identifies the intervention producing the best completion with the least friction", () => {
      const mockSnapshots: CompletedCaseLearningSnapshot[] = [
        // 10 cases of Intervention A (Autonomous Transportation Voucher): 7 completed, fast, low labor
        ...Array.from({ length: 10 }).map((_, i) => ({
          caseId: `c-a-${i}`,
          tenantId: "tenant-1",
          capturedAt: new Date().toISOString(),
          initialContext: {
            memberId: `m-a-${i}`,
            coverageType: "MEDICAID",
            preferredLanguage: "Spanish",
            urbanicity: "URBAN",
            digitalAccessLevel: "LIMITED",
            specialty: "Outpatient Behavioral Health",
            behavioralHealthNeed: "Depression",
            urgency: "HIGH",
            priorityScore: 75,
            riskLevel: "MEDIUM",
          },
          barrier: {
            primaryCategory: "SOCIAL_LOGISTICAL",
            subBarrierCode: "NO_RELIABLE_TRANSIT",
            epistemicStatus: "FACT" as const,
            confidence: 0.95,
          },
          confidence: {
            barrierDetectionConfidence: 0.95,
            interventionRecommendationConfidence: 0.98,
          },
          intervention: {
            interventionType: "TRANSPORTATION_SUPPORT",
            catalogLabel: "Automated Rideshare Voucher",
            toolSelected: "issue_transit_voucher",
            hypothesis: "Voucher eliminates transit deficit",
          },
          executionPath: {
            stateSequence: ["NEW", "TRIAGED", "BARRIER_IDENTIFIED", "VERIFIED"],
            toolSequence: ["classify_barrier", "issue_transit_voucher"],
            iterationsCount: 2,
          },
          humanInvolvement: {
            reviewRequired: false,
            approvalCount: 0,
            supervisorOverrides: 0,
            humanIntervention: false,
            careManagerLaborMinutes: 3.0,
          },
          time: {
            timeToAppointmentDays: 8,
            timeToCompletionDays: 10,
            totalElapsedMs: 864000000,
          },
          cost: {
            computeTokens: 500,
            computeCostUSD: 0.05,
            voucherCostUSD: 25.0,
            humanLaborCostUSD: 2.25,
            totalCostUSD: 27.3,
          },
          outcome: {
            verifiedCompletion: i < 7, // 70% completion
            dualSourceVerified: i < 7,
            verificationSignals: ["PROVIDER_CONFIRMATION", "CLAIM_RECEIVED"],
            noShowRecorded: i === 8,
            finalStatus: i < 7 ? "VERIFIED" : "CLOSED",
            closureReason: i < 7 ? "Verified completion" : "Lost to follow up",
          },
          equityCohort: {
            cohortKey: "MEDICAID:Spanish:URBAN",
            coverageType: "MEDICAID",
            preferredLanguage: "Spanish",
            urbanicity: "URBAN",
            raceEthnicity: "Hispanic/Latino",
          },
        })),

        // 10 cases of Intervention B (Manual Care Manager Phone Escorts): 7 completed, but slow & high labor
        ...Array.from({ length: 10 }).map((_, i) => ({
          caseId: `c-b-${i}`,
          tenantId: "tenant-1",
          capturedAt: new Date().toISOString(),
          initialContext: {
            memberId: `m-b-${i}`,
            coverageType: "MEDICAID",
            preferredLanguage: "Spanish",
            urbanicity: "URBAN",
            digitalAccessLevel: "LIMITED",
            specialty: "Outpatient Behavioral Health",
            behavioralHealthNeed: "Depression",
            urgency: "HIGH",
            priorityScore: 75,
            riskLevel: "MEDIUM",
          },
          barrier: {
            primaryCategory: "SOCIAL_LOGISTICAL",
            subBarrierCode: "NO_RELIABLE_TRANSIT",
            epistemicStatus: "FACT" as const,
            confidence: 0.95,
          },
          confidence: {
            barrierDetectionConfidence: 0.95,
            interventionRecommendationConfidence: 0.98,
          },
          intervention: {
            interventionType: "MANUAL_PHONE_ESCORT",
            catalogLabel: "Manual Care Manager Phone Outreach",
            toolSelected: "create_human_task",
            hypothesis: "Human phone calls overcome transit",
          },
          executionPath: {
            stateSequence: ["NEW", "TRIAGED", "BARRIER_IDENTIFIED", "VERIFIED"],
            toolSequence: ["classify_barrier", "create_human_task"],
            iterationsCount: 4,
          },
          humanInvolvement: {
            reviewRequired: true,
            approvalCount: 1,
            supervisorOverrides: 1,
            humanIntervention: true,
            careManagerLaborMinutes: 28.0, // High friction
          },
          time: {
            timeToAppointmentDays: 24,
            timeToCompletionDays: 28, // Slower
            totalElapsedMs: 2419200000,
          },
          cost: {
            computeTokens: 500,
            computeCostUSD: 0.05,
            voucherCostUSD: 0.0,
            humanLaborCostUSD: 21.0,
            totalCostUSD: 21.05,
          },
          outcome: {
            verifiedCompletion: i < 7, // Same 70% completion, but high friction
            dualSourceVerified: i < 7,
            verificationSignals: ["PROVIDER_CONFIRMATION"],
            noShowRecorded: i >= 7 && i <= 8,
            finalStatus: i < 7 ? "VERIFIED" : "CLOSED",
            closureReason: i < 7 ? "Verified completion" : "Failed",
          },
          equityCohort: {
            cohortKey: "MEDICAID:Spanish:URBAN",
            coverageType: "MEDICAID",
            preferredLanguage: "Spanish",
            urbanicity: "URBAN",
            raceEthnicity: "Hispanic/Latino",
          },
        })),
      ];

      const query: OptimalInterventionQuery = {
        barrierCategory: "SOCIAL_LOGISTICAL",
        subBarrierCode: "NO_RELIABLE_TRANSIT",
        context: {
          coverageType: "MEDICAID",
          preferredLanguage: "Spanish",
          urbanicity: "URBAN",
        },
      };

      const result = findBestInterventionForBarrierAndContext(query, mockSnapshots);

      expect(result.matchingHistoricalCasesCount).toBe(20);
      expect(result.bestIntervention.interventionType).toBe("TRANSPORTATION_SUPPORT");
      expect(result.bestIntervention.frictionScore).toBeLessThan(
        result.rankedAlternatives[0].frictionScore
      );
      expect(result.bestIntervention.compositeEfficiencyScore).toBeGreaterThan(
        result.rankedAlternatives[0].compositeEfficiencyScore
      );
      expect(result.clinicalRationale).toContain("Automated Rideshare Voucher");
      expect(result.governanceStatus).toBe("ADVISORY_PROPOSAL_ONLY");
      expect(result.prohibitsAutonomousMutation).toBe(true);
    });
  });

  describe("Governance & Anti-Self-Mutation Boundary", () => {
    it("prohibits automated agents or care managers from mutating production policies", () => {
      expect(() => {
        assertNoAutonomousPolicyMutation("CARE_MANAGER");
      }).toThrowError(PolicyGovernanceViolationError);

      expect(() => {
        assertNoAutonomousPolicyMutation("AGENT_SERVICE_IDENTITY");
      }).toThrowError(PolicyGovernanceViolationError);
    });

    it("permits clinical supervisors and admins to review and govern policies", () => {
      expect(() => {
        assertNoAutonomousPolicyMutation("CLINICAL_SUPERVISOR");
      }).not.toThrow();

      expect(() => {
        assertNoAutonomousPolicyMutation("ADMIN");
      }).not.toThrow();
    });
  });
});
