import { describe, expect, it } from "vitest";
import {
  compareCohorts,
  computeCohortMetrics,
  computeDisparityReducingInterventions,
  EquityCaseRecord,
  MIN_RELIABLE_COHORT_SIZE,
} from "@/domain/equity/analytics";

describe("Dedicated Health Equity Analytics Engine", () => {
  const mkCase = (overrides: Partial<EquityCaseRecord> & { caseId: string }): EquityCaseRecord => ({
    referralDate: new Date("2026-10-01T10:00:00Z"),
    firstCompletedVisitAt: null,
    status: "INTERVENTION_IN_PROGRESS",
    primaryBarrierCategory: "COMMUNICATION",
    preferredLanguage: "Spanish",
    urbanicity: "URBAN",
    coverageType: "MEDICAID",
    raceEthnicityCohort: "Hispanic / Latino",
    ageGroupCohort: "35-49",
    interventions: [],
    appointments: [],
    ...overrides,
  });

  const dataset: EquityCaseRecord[] = [
    // English cohort (n=5, 4 completed -> 80%, fast 3d, 0 no-shows)
    mkCase({
      caseId: "e1",
      preferredLanguage: "English",
      firstCompletedVisitAt: new Date("2026-10-04T10:00:00Z"),
      appointments: [{ status: "COMPLETED" }],
    }),
    mkCase({
      caseId: "e2",
      preferredLanguage: "English",
      firstCompletedVisitAt: new Date("2026-10-04T10:00:00Z"),
      appointments: [{ status: "COMPLETED" }],
    }),
    mkCase({
      caseId: "e3",
      preferredLanguage: "English",
      firstCompletedVisitAt: new Date("2026-10-04T10:00:00Z"),
      appointments: [{ status: "COMPLETED" }],
    }),
    mkCase({
      caseId: "e4",
      preferredLanguage: "English",
      firstCompletedVisitAt: new Date("2026-10-04T10:00:00Z"),
      appointments: [{ status: "COMPLETED" }],
    }),
    mkCase({
      caseId: "e5",
      preferredLanguage: "English",
      firstCompletedVisitAt: null,
      appointments: [{ status: "SCHEDULED" }],
    }),

    // Spanish cohort (n=4 -> Small Sample!, 2 completed -> 50%, 8d, 1 no-show; recent period shows decreasing gap!)
    mkCase({
      caseId: "s1",
      preferredLanguage: "Spanish",
      referralDate: new Date("2026-09-10T10:00:00Z"),
      firstCompletedVisitAt: null,
      appointments: [{ status: "NO_SHOW" }],
      interventions: [{ type: "HUMAN_OUTREACH", status: "COMPLETED" }],
    }),
    mkCase({
      caseId: "s2",
      preferredLanguage: "Spanish",
      referralDate: new Date("2026-09-15T10:00:00Z"),
      firstCompletedVisitAt: null,
      appointments: [{ status: "SCHEDULED" }],
    }),
    mkCase({
      caseId: "s3",
      preferredLanguage: "Spanish",
      referralDate: new Date("2026-10-15T10:00:00Z"),
      firstCompletedVisitAt: new Date("2026-10-23T10:00:00Z"),
      appointments: [{ status: "COMPLETED" }],
      interventions: [{ type: "LANGUAGE_COMPATIBLE_PROVIDER_SEARCH", status: "COMPLETED" }],
    }),
    mkCase({
      caseId: "s4",
      preferredLanguage: "Spanish",
      referralDate: new Date("2026-10-20T10:00:00Z"),
      firstCompletedVisitAt: new Date("2026-10-28T10:00:00Z"),
      appointments: [{ status: "COMPLETED" }],
      interventions: [{ type: "LANGUAGE_COMPATIBLE_PROVIDER_SEARCH", status: "COMPLETED" }],
    }),
  ];

  it("flags small cohorts (n < MIN_RELIABLE_COHORT_SIZE), measures no-shows/time-to-care, and computes disparity trend", () => {
    expect(MIN_RELIABLE_COHORT_SIZE).toBe(5);
    const langs = computeCohortMetrics(dataset, "preferredLanguage");

    const spanish = langs.find((l) => l.cohort === "Spanish")!;
    const english = langs.find((l) => l.cohort === "English")!;

    expect(spanish.totalCases).toBe(4);
    expect(spanish.isSmallSample).toBe(true);
    expect(spanish.sampleCaution).toContain("n=4");
    expect(spanish.avgTimeToCareDays).toBe(8);
    expect(spanish.noShowRatePct).toBe(25);
    expect(spanish.appointmentCompletionRatePct).toBe(50);
    // Earlier Spanish was 0% vs Recent 100% -> disparity gap decreased sharply
    expect(spanish.disparityTrend).toBe("DECREASING");

    expect(english.totalCases).toBe(5);
    expect(english.isSmallSample).toBe(false);
    expect(english.sampleCaution).toBeNull();
    expect(english.avgTimeToCareDays).toBe(3);
  });

  it("identifies disparity-reducing interventions and supports side-by-side cohort comparison", () => {
    const lift = computeDisparityReducingInterventions(dataset);
    const langSearch = lift.find(
      (r) => r.interventionType === "LANGUAGE_COMPATIBLE_PROVIDER_SEARCH"
    )!;
    expect(langSearch.rateWithInterventionPct).toBe(100);
    expect(langSearch.rateWithoutInterventionPct).toBe(0);
    expect(langSearch.liftPctPoints).toBe(100);
    expect(langSearch.isSmallSample).toBe(true);

    const comp = compareCohorts(
      dataset,
      { dimension: "preferredLanguage", value: "Spanish" },
      { dimension: "preferredLanguage", value: "English" }
    );
    expect(comp.cohortA?.cohort).toBe("Spanish");
    expect(comp.cohortB?.cohort).toBe("English");
    expect(comp.deltas.completionRateDiffPctPts).toBe(-30);
    expect(comp.deltas.avgTimeToCareDiffDays).toBe(5);
  });
});
