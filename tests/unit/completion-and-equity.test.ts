import { describe, expect, it } from "vitest";
import { VerificationSignalType, VerificationStatus } from "@prisma/client";
import { APPOINTMENT_STATUS_ORDER } from "@/domain/appointments/state-machine";
import {
  calculateReferralToCompletedRate,
  evaluateVerificationSignal,
  isVisitCompletionSignal,
  summarizeVerificationSignals,
} from "@/domain/completion/verifier";
import { computeCohortMetrics, EquityCaseRecord } from "@/domain/equity/analytics";

describe("Completion Verification & Health Equity Analytics", () => {
  it("exposes all 8 appointment lifecycle states and never counts scheduled/confirmed alone as completed visit", () => {
    expect(APPOINTMENT_STATUS_ORDER).toEqual([
      "REQUESTED",
      "SCHEDULED",
      "CONFIRMED",
      "RESCHEDULED",
      "CANCELLED",
      "NO_SHOW",
      "COMPLETED",
      "UNKNOWN",
    ]);

    expect(isVisitCompletionSignal(VerificationSignalType.APPOINTMENT_SCHEDULED)).toBe(false);
    expect(isVisitCompletionSignal(VerificationSignalType.APPOINTMENT_CONFIRMED)).toBe(false);
    expect(isVisitCompletionSignal(VerificationSignalType.APPOINTMENT_COMPLETED)).toBe(true);
    expect(isVisitCompletionSignal(VerificationSignalType.CLAIM_RECEIVED)).toBe(true);
    expect(isVisitCompletionSignal(VerificationSignalType.PROVIDER_CONFIRMATION)).toBe(true);
    expect(isVisitCompletionSignal(VerificationSignalType.MEMBER_CONFIRMATION)).toBe(true);

    expect(
      evaluateVerificationSignal({
        signalType: VerificationSignalType.APPOINTMENT_SCHEDULED,
        verificationStatus: VerificationStatus.VERIFIED,
      }).provesCareCompleted
    ).toBe(false);

    expect(
      evaluateVerificationSignal({
        signalType: VerificationSignalType.PROVIDER_CONFIRMATION,
        verificationStatus: VerificationStatus.DISPUTED,
      }).provesCareCompleted
    ).toBe(false);

    const claimEval = evaluateVerificationSignal({
      signalType: VerificationSignalType.CLAIM_RECEIVED,
      verificationStatus: VerificationStatus.VERIFIED,
    });
    expect(claimEval.provesCareCompleted).toBe(true);
    expect(claimEval.resolvedConfidence).toBe(0.99);

    const summary = summarizeVerificationSignals([
      { signalType: VerificationSignalType.APPOINTMENT_SCHEDULED, verified: true },
      { signalType: VerificationSignalType.APPOINTMENT_CONFIRMED, verified: true },
    ]);
    expect(summary.hasCompletedVisit).toBe(false);
    expect(summary.evidenceSourceCount).toBe(0);
    expect(calculateReferralToCompletedRate(10, 4)).toBe(40);
  });

  it("computes cohort disparity metrics and handles missing time-to-care cleanly", () => {
    const refDate = new Date("2026-10-01T10:00:00Z");
    const visitDate = new Date("2026-10-06T10:00:00Z");
    const records: EquityCaseRecord[] = [
      {
        caseId: "c1",
        referralDate: refDate,
        firstCompletedVisitAt: visitDate,
        status: "VERIFIED",
        primaryBarrierCategory: "COMMUNICATION",
        preferredLanguage: "Spanish",
        urbanicity: "URBAN",
        coverageType: "MEDICAID",
        raceEthnicityCohort: "Hispanic / Latino",
        ageGroupCohort: "35-49",
        interventions: [{ type: "LANGUAGE_COMPATIBLE_PROVIDER_SEARCH", status: "COMPLETED" }],
      },
      {
        caseId: "c2",
        referralDate: refDate,
        firstCompletedVisitAt: null,
        status: "INTERVENTION_IN_PROGRESS",
        primaryBarrierCategory: "COMMUNICATION",
        preferredLanguage: "Spanish",
        urbanicity: "URBAN",
        coverageType: "MEDICAID",
        raceEthnicityCohort: "Hispanic / Latino",
        ageGroupCohort: "35-49",
        interventions: [],
      },
      {
        caseId: "c3",
        referralDate: refDate,
        firstCompletedVisitAt: visitDate,
        status: "CLOSED",
        primaryBarrierCategory: "FINANCIAL",
        preferredLanguage: "English",
        urbanicity: "SUBURBAN",
        coverageType: "MEDICARE_ADVANTAGE",
        raceEthnicityCohort: "White",
        ageGroupCohort: "50-64",
        interventions: [],
      },
    ];

    const byLang = computeCohortMetrics(records, "preferredLanguage");
    const spanish = byLang.find((r) => r.cohort === "Spanish")!;
    const english = byLang.find((r) => r.cohort === "English")!;
    expect(spanish.completionRatePct).toBe(50);
    expect(spanish.avgTimeToCareDays).toBe(5);
    expect(english.completionRatePct).toBe(100);
    expect(spanish.disparityGapPctPoints).toBeLessThan(0);
  });
});
