import { assignStudyArm, StratificationFactors } from "./pilot-protocol";
import { PilotCaseRecord } from "./measurement-engine";

function createSeededRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export interface PilotSimulationOptions {
  totalPopulation?: number; // 10,000 to 50,000 (default 20,000)
  durationMonths?: number; // 3 or 6 (default 6)
  seed?: number;
}

/**
 * High-performance synthetic simulation generator for a 10,000–50,000 member pilot study.
 * Generates both Intervention and Usual Care (Control) arms using stratified random assignment.
 */
export function simulatePilotCohort(options?: PilotSimulationOptions): PilotCaseRecord[] {
  const count = Math.max(100, Math.min(50000, options?.totalPopulation ?? 20000));
  const durationMonths = options?.durationMonths ?? 6;
  const seed = options?.seed ?? 2026;
  const rng = createSeededRng(seed);

  const records: PilotCaseRecord[] = new Array(count);
  const baseTime = Date.now() - durationMonths * 30 * 86400000;

  for (let i = 0; i < count; i += 1) {
    const memberId = `MEM-PILOT-${100000 + i}`;
    const caseId = `CASE-PILOT-${100000 + i}`;

    // Stratification distributions reflecting real-world behavioral health populations
    const coverageRoll = rng();
    const coverageType: StratificationFactors["coverageType"] =
      coverageRoll < 0.55 ? "MEDICAID" : coverageRoll < 0.85 ? "COMMERCIAL" : coverageRoll < 0.95 ? "MEDICARE_DUAL" : "UNINSURED";

    const langRoll = rng();
    const preferredLanguage = langRoll < 0.65 ? "English" : langRoll < 0.92 ? "Spanish" : "Other";

    const urbanRoll = rng();
    const urbanicity: StratificationFactors["urbanicity"] =
      urbanRoll < 0.60 ? "URBAN" : urbanRoll < 0.85 ? "SUBURBAN" : "RURAL";

    const raceRoll = rng();
    const raceEthnicity: StratificationFactors["raceEthnicity"] =
      raceRoll < 0.35 ? "Hispanic/Latino" : raceRoll < 0.60 ? "Black/African American" : raceRoll < 0.88 ? "White" : raceRoll < 0.96 ? "Asian/Pacific Islander" : "Other";

    const strata: StratificationFactors = {
      coverageType,
      preferredLanguage: preferredLanguage as any,
      urbanicity,
      raceEthnicity,
    };

    // Stratified random arm allocation (1:1)
    const studyArm = assignStudyArm(memberId, strata, seed);

    // Referral staggered across study duration
    const referralOffsetDays = Math.floor(rng() * (durationMonths * 30 - 30));
    const referralDate = new Date(baseTime + referralOffsetDays * 86400000);

    // Identify underlying barrier
    const barrierRoll = rng();
    const primaryBarrier =
      barrierRoll < 0.35 ? "TRANSPORTATION" : barrierRoll < 0.60 ? "SCHEDULING_FRICTION" : barrierRoll < 0.80 ? "LANGUAGE_CONCORDANCE" : "ACCESS_WAIT_TIME";

    if (studyArm === "INTERVENTION") {
      // ----------------------------------------------------------------------
      // INTERVENTION ARM: CareLoop AI-Orchestrated Care Navigation
      // ----------------------------------------------------------------------
      const outreachSent = true;
      const reachProb = preferredLanguage === "Spanish" ? 0.88 : 0.84;
      const memberResponded = rng() < reachProb;
      const outreachTouchCount = memberResponded ? (rng() < 0.7 ? 1 : 2) : 3;

      let scheduledStartAt: Date | null = null;
      let firstCompletedVisitAt: Date | null = null;
      let appointmentStatus: PilotCaseRecord["appointmentStatus"] = "NONE";
      let voucherCostUSD = 0;

      if (memberResponded) {
        // High scheduling rate due to verified slots
        const schedDays = 4 + Math.floor(rng() * 12); // Fast median wait time (4 - 16 days)
        scheduledStartAt = new Date(referralDate.getTime() + schedDays * 86400000);

        // Transportation barrier resolution
        if (primaryBarrier === "TRANSPORTATION") {
          voucherCostUSD = 24.50; // Rideshare voucher
        }

        // Low no-show rate due to proactive reminders + barrier removal
        const noShowProb = primaryBarrier === "TRANSPORTATION" ? 0.09 : 0.11;
        const isNoShow = rng() < noShowProb;

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
        studyArm: "INTERVENTION",
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
        outreachTouchCount,
        computeCostUSD: 0.08,
        careManagerLaborMinutes: primaryBarrier === "TRANSPORTATION" ? 4.5 : 2.5,
        voucherCostUSD,
        providerInNetwork: true,
        verifiedByDualSource: firstCompletedVisitAt !== null,
      };
    } else {
      // ----------------------------------------------------------------------
      // CONTROL ARM: Standard Usual Care Navigation (Static directories, robocalls)
      // ----------------------------------------------------------------------
      const outreachSent = rng() < 0.65; // Standard clinic robocalls / automated blast
      // Low response rate due to lack of cultural tailoring
      const responseProb = preferredLanguage === "Spanish" ? 0.28 : 0.44;
      const memberResponded = outreachSent && rng() < responseProb;
      const outreachTouchCount = outreachSent ? 1 : 0;

      let scheduledStartAt: Date | null = null;
      let firstCompletedVisitAt: Date | null = null;
      let appointmentStatus: PilotCaseRecord["appointmentStatus"] = "NONE";

      // Phantom networks and long wait times cause heavy drop-off
      const overcomesPhantomNetwork = rng() < (coverageType === "MEDICAID" ? 0.38 : 0.52);

      if (overcomesPhantomNetwork) {
        const schedDays = 24 + Math.floor(rng() * 32); // Long usual care wait time (24 - 56 days)
        scheduledStartAt = new Date(referralDate.getTime() + schedDays * 86400000);

        // High no-show rate in control arm (lack of transportation voucher, lack of SMS check-in)
        const noShowProb =
          primaryBarrier === "TRANSPORTATION" ? 0.46 : preferredLanguage === "Spanish" ? 0.38 : 0.28;
        const isNoShow = rng() < noShowProb;

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
        studyArm: "USUAL_CARE_CONTROL",
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
        outreachTouchCount,
        computeCostUSD: 0.00,
        careManagerLaborMinutes: 12.0, // Manual manual entry and phone tag
        voucherCostUSD: 0.00,
        providerInNetwork: rng() < 0.78, // Higher out-of-network leakage
        verifiedByDualSource: false, // Single-source self-report
      };
    }
  }

  return records;
}
