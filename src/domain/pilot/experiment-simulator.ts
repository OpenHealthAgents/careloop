import { assignMultiArmExperiment, ExperimentArmId, MultiArmCaseRecord } from "./experimentation-engine";
import { StratificationFactors } from "./pilot-protocol";

function createSeededRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export interface MultiArmSimulationOptions {
  totalPopulation?: number; // 1,000 to 50,000 (default 10,000)
  durationMonths?: number;
  seed?: number;
  armWeights?: Record<ExperimentArmId, number>;
}

export function simulateMultiArmCohort(options?: MultiArmSimulationOptions): MultiArmCaseRecord[] {
  const total = Math.max(100, Math.min(50000, options?.totalPopulation ?? 10000));
  const durationMonths = options?.durationMonths ?? 6;
  const seed = options?.seed ?? 2026;
  const rng = createSeededRng(seed);

  const records: MultiArmCaseRecord[] = new Array(total);
  const baseTime = Date.now() - durationMonths * 30 * 86400000;

  for (let i = 0; i < total; i += 1) {
    const memberId = `MEM-EXP-${100000 + i}`;
    const caseId = `CASE-EXP-${100000 + i}`;

    const covRoll = rng();
    const coverageType: StratificationFactors["coverageType"] =
      covRoll < 0.55 ? "MEDICAID" : covRoll < 0.85 ? "COMMERCIAL" : covRoll < 0.95 ? "MEDICARE_DUAL" : "UNINSURED";

    const langRoll = rng();
    const preferredLanguage = langRoll < 0.65 ? "English" : langRoll < 0.92 ? "Spanish" : "Other";

    const urbRoll = rng();
    const urbanicity: StratificationFactors["urbanicity"] =
      urbRoll < 0.60 ? "URBAN" : urbRoll < 0.85 ? "SUBURBAN" : "RURAL";

    const raceRoll = rng();
    const raceEthnicity: StratificationFactors["raceEthnicity"] =
      raceRoll < 0.35 ? "Hispanic/Latino" : raceRoll < 0.60 ? "Black/African American" : raceRoll < 0.88 ? "White" : raceRoll < 0.96 ? "Asian/Pacific Islander" : "Other";

    const strata: StratificationFactors = {
      coverageType,
      preferredLanguage: preferredLanguage as any,
      urbanicity,
      raceEthnicity,
    };

    const armId = assignMultiArmExperiment(memberId, strata, seed, options?.armWeights);

    const referralOffsetDays = Math.floor(rng() * (durationMonths * 30 - 30));
    const referralDate = new Date(baseTime + referralOffsetDays * 86400000);

    const barrierRoll = rng();
    const primaryBarrier =
      barrierRoll < 0.35 ? "TRANSPORTATION" : barrierRoll < 0.60 ? "SCHEDULING_FRICTION" : barrierRoll < 0.80 ? "LANGUAGE_CONCORDANCE" : "ACCESS_WAIT_TIME";

    // 0.4% baseline acute crisis safety filter
    const isCrisis = rng() < 0.004;
    if (isCrisis) {
      records[i] = {
        caseId,
        memberId,
        armId,
        referralDate,
        scheduledStartAt: null,
        firstCompletedVisitAt: null,
        appointmentStatus: "NONE",
        coverageType,
        preferredLanguage,
        urbanicity,
        raceEthnicity,
        primaryBarrier: "ACUTE_CRISIS_ESCALATION",
        outreachSent: false,
        memberResponded: false,
        outreachTouchCount: 0,
        memberOptedOut: false,
        computeCostUSD: 0.02,
        careManagerLaborMinutes: 45.0, // Clinical emergency warm handoff
        voucherCostUSD: 0,
        approvalRequestsSpawned: 1,
        humanTouchesCount: 3,
        safetyHalted: true,
        policyViolationsBlocked: 0,
      };
      continue;
    }

    if (armId === "INTERVENTION_A") {
      // ----------------------------------------------------------------------
      // INTERVENTION A: Autonomous Digital-First
      // ----------------------------------------------------------------------
      const reachProb = preferredLanguage === "Spanish" ? 0.86 : 0.83;
      const memberResponded = rng() < reachProb;
      const outreachTouchCount = memberResponded ? 1 : 2;

      let scheduledStartAt: Date | null = null;
      let firstCompletedVisitAt: Date | null = null;
      let appointmentStatus: MultiArmCaseRecord["appointmentStatus"] = "NONE";
      let voucherCostUSD = 0;

      if (memberResponded) {
        const schedDays = 4 + Math.floor(rng() * 10);
        scheduledStartAt = new Date(referralDate.getTime() + schedDays * 86400000);
        if (primaryBarrier === "TRANSPORTATION") voucherCostUSD = 24.50;

        const isNoShow = rng() < (primaryBarrier === "TRANSPORTATION" ? 0.09 : 0.11);
        if (isNoShow) {
          appointmentStatus = "NO_SHOW";
        } else {
          appointmentStatus = "COMPLETED";
          firstCompletedVisitAt = scheduledStartAt;
        }
      }

      records[i] = {
        caseId,
        memberId,
        armId,
        referralDate,
        scheduledStartAt,
        firstCompletedVisitAt,
        appointmentStatus,
        coverageType,
        preferredLanguage,
        urbanicity,
        raceEthnicity,
        primaryBarrier,
        outreachSent: true,
        memberResponded,
        outreachTouchCount,
        memberOptedOut: rng() < 0.015,
        computeCostUSD: 0.08,
        careManagerLaborMinutes: primaryBarrier === "TRANSPORTATION" ? 4.0 : 2.5,
        voucherCostUSD,
        approvalRequestsSpawned: primaryBarrier === "TRANSPORTATION" ? 1 : 0,
        humanTouchesCount: 0,
        safetyHalted: false,
        policyViolationsBlocked: 0,
      };
    } else if (armId === "INTERVENTION_B") {
      // ----------------------------------------------------------------------
      // INTERVENTION B: Multimodal Rapid-Access (Telehealth + Dual Channel)
      // ----------------------------------------------------------------------
      // Higher reach via dual channel (SMS + Secure Portal)
      const reachProb = preferredLanguage === "Spanish" ? 0.91 : 0.88;
      const memberResponded = rng() < reachProb;
      const outreachTouchCount = memberResponded ? (rng() < 0.65 ? 1 : 2) : 3;

      let scheduledStartAt: Date | null = null;
      let firstCompletedVisitAt: Date | null = null;
      let appointmentStatus: MultiArmCaseRecord["appointmentStatus"] = "NONE";
      let voucherCostUSD = 0;

      if (memberResponded) {
        // Fast telehealth access reduces wait times even further
        const schedDays = 3 + Math.floor(rng() * 8);
        scheduledStartAt = new Date(referralDate.getTime() + schedDays * 86400000);

        if (primaryBarrier === "TRANSPORTATION") {
          // Half choose telehealth (no voucher needed), half choose in-person with voucher
          if (rng() < 0.5) voucherCostUSD = 24.50;
        }

        const isNoShow = rng() < 0.08; // Very low no-show with telehealth flexibility
        if (isNoShow) {
          appointmentStatus = "NO_SHOW";
        } else {
          appointmentStatus = "COMPLETED";
          firstCompletedVisitAt = scheduledStartAt;
        }
      }

      records[i] = {
        caseId,
        memberId,
        armId,
        referralDate,
        scheduledStartAt,
        firstCompletedVisitAt,
        appointmentStatus,
        coverageType,
        preferredLanguage,
        urbanicity,
        raceEthnicity,
        primaryBarrier,
        outreachSent: true,
        memberResponded,
        outreachTouchCount,
        memberOptedOut: rng() < 0.012,
        computeCostUSD: 0.12,
        careManagerLaborMinutes: 3.5,
        voucherCostUSD,
        approvalRequestsSpawned: voucherCostUSD > 0 ? 1 : 0,
        humanTouchesCount: 0,
        safetyHalted: false,
        policyViolationsBlocked: 0,
      };
    } else if (armId === "HUMAN_ASSISTED") {
      // ----------------------------------------------------------------------
      // HUMAN-ASSISTED: Care Manager in the Loop
      // ----------------------------------------------------------------------
      // Very high engagement and highest completion rate through human warmth
      const reachProb = preferredLanguage === "Spanish" ? 0.89 : 0.87;
      const memberResponded = rng() < reachProb;
      const outreachTouchCount = memberResponded ? (rng() < 0.5 ? 1 : 2) : 3;

      let scheduledStartAt: Date | null = null;
      let firstCompletedVisitAt: Date | null = null;
      let appointmentStatus: MultiArmCaseRecord["appointmentStatus"] = "NONE";
      let voucherCostUSD = 0;

      if (memberResponded) {
        // Scheduling queue has slight human latency
        const schedDays = 6 + Math.floor(rng() * 12);
        scheduledStartAt = new Date(referralDate.getTime() + schedDays * 86400000);

        if (primaryBarrier === "TRANSPORTATION") voucherCostUSD = 24.50;

        const isNoShow = rng() < 0.07; // Lowest no-show due to human care manager trust
        if (isNoShow) {
          appointmentStatus = "NO_SHOW";
        } else {
          appointmentStatus = "COMPLETED";
          firstCompletedVisitAt = scheduledStartAt;
        }
      }

      records[i] = {
        caseId,
        memberId,
        armId,
        referralDate,
        scheduledStartAt,
        firstCompletedVisitAt,
        appointmentStatus,
        coverageType,
        preferredLanguage,
        urbanicity,
        raceEthnicity,
        primaryBarrier,
        outreachSent: true,
        memberResponded,
        outreachTouchCount,
        memberOptedOut: rng() < 0.008,
        computeCostUSD: 0.05,
        careManagerLaborMinutes: 22.5, // Significant human labor (review + phone handoff)
        voucherCostUSD,
        approvalRequestsSpawned: 1, // Human review before dispatch
        humanTouchesCount: memberResponded ? 2 : 1,
        safetyHalted: false,
        policyViolationsBlocked: 0,
      };
    } else {
      // ----------------------------------------------------------------------
      // USUAL CARE (Control): Static Directory & Robocalls
      // ----------------------------------------------------------------------
      const outreachSent = rng() < 0.65;
      const responseProb = preferredLanguage === "Spanish" ? 0.28 : 0.44;
      const memberResponded = outreachSent && rng() < responseProb;

      let scheduledStartAt: Date | null = null;
      let firstCompletedVisitAt: Date | null = null;
      let appointmentStatus: MultiArmCaseRecord["appointmentStatus"] = "NONE";

      const overcomesPhantomNetwork = rng() < (coverageType === "MEDICAID" ? 0.38 : 0.52);
      if (overcomesPhantomNetwork) {
        const schedDays = 24 + Math.floor(rng() * 32);
        scheduledStartAt = new Date(referralDate.getTime() + schedDays * 86400000);

        const isNoShow = rng() < (primaryBarrier === "TRANSPORTATION" ? 0.46 : preferredLanguage === "Spanish" ? 0.38 : 0.28);
        if (isNoShow) {
          appointmentStatus = "NO_SHOW";
        } else {
          appointmentStatus = "COMPLETED";
          firstCompletedVisitAt = scheduledStartAt;
        }
      }

      records[i] = {
        caseId,
        memberId,
        armId,
        referralDate,
        scheduledStartAt,
        firstCompletedVisitAt,
        appointmentStatus,
        coverageType,
        preferredLanguage,
        urbanicity,
        raceEthnicity,
        primaryBarrier,
        outreachSent,
        memberResponded,
        outreachTouchCount: outreachSent ? 1 : 0,
        memberOptedOut: rng() < 0.045, // Higher fatigue from cold unhelpful robocalls
        computeCostUSD: 0.00,
        careManagerLaborMinutes: 12.0, // Manual back-office phone tag
        voucherCostUSD: 0.00,
        approvalRequestsSpawned: 0,
        humanTouchesCount: 0,
        safetyHalted: false,
        policyViolationsBlocked: 0,
      };
    }
  }

  return records;
}
