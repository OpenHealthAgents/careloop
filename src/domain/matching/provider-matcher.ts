import { AvailabilitySource } from "@prisma/client";

export const STALE_AVAILABILITY_THRESHOLD_DAYS = 14;

export interface ProviderMatchInput {
  referralSpecialty: string;
  behavioralHealthNeed?: string;
  referralNetwork: string;
  referralGeography: string;
  preferredLanguage: string;
  preferredModality?: "TELEHEALTH" | "IN_PERSON" | "ANY";
  needsTelehealth?: boolean;
  digitalAccessLevel?: string;
  now?: Date;
}

export interface ProviderCandidate {
  id: string;
  npi: string;
  name: string;
  organizationName: string;
  specialty: string;
  networkNames: string[];
  languages: string[];
  geography: string;
  county: string;
  telehealthAvailable: boolean;
  acceptingNewPatients: boolean;
  availabilitySource: AvailabilitySource;
  nextVerifiedSlotAt: Date | null;
  directoryWaitDays: number | null;
  availabilityLastVerifiedAt: Date | null;
  notes?: string | null;
  verifiedSlots: Array<{
    id: string;
    slotStartAt: Date;
    slotEndAt: Date;
    modality: string;
    status: string;
  }>;
}

export interface ProviderMatchResult {
  provider: ProviderCandidate;
  matchScore: number;
  availabilityLabel: "VERIFIED AVAILABILITY" | "DIRECTORY DATA" | "NOT AVAILABLE";
  availabilityWarning: string | null;
  isStale: boolean;
  staleAgeDays: number | null;
  stalenessLabel: string;
  reasons: string[];
  mismatches: string[];
  nextVerifiedSlot: {
    id: string;
    slotStartAt: Date;
    slotEndAt: Date;
    modality: string;
  } | null;
}

/**
 * Ranks behavioral-health provider candidates using explicit operational criteria.
 *
 * CRITICAL DATA-INTEGRITY INVARIANT:
 * Strictly separates VERIFIED AVAILABILITY from DIRECTORY DATA.
 * Directory information NEVER claims or implies that an appointment slot is available.
 */
export function rankProvidersForReferral(
  candidates: ProviderCandidate[],
  criteria: ProviderMatchInput
): ProviderMatchResult[] {
  const now = criteria.now ?? new Date();
  const preferredModality =
    criteria.preferredModality ?? (criteria.needsTelehealth ? "TELEHEALTH" : "ANY");

  const results = candidates.map((provider) => {
    let score = 0;
    const reasons: string[] = [];
    const mismatches: string[] = [];

    // 1. Specialty & behavioral-health need
    const specLower = provider.specialty.toLowerCase();
    const targetSpec = criteria.referralSpecialty.toLowerCase();
    const needLower = (criteria.behavioralHealthNeed ?? "").toLowerCase();
    const notesLower = (provider.notes ?? "").toLowerCase();

    const specialtyMatch =
      !criteria.referralSpecialty ||
      specLower === targetSpec ||
      specLower.includes(targetSpec) ||
      targetSpec.includes(specLower);

    if (criteria.referralSpecialty && specialtyMatch) {
      score += 26;
      reasons.push(`Specialty match (${provider.specialty})`);
    } else if (criteria.referralSpecialty) {
      mismatches.push(`Specialty differs (${provider.specialty})`);
    }

    if (
      needLower &&
      (specLower.includes(needLower) ||
        notesLower.includes(needLower.split(" ")[0] ?? "") ||
        (needLower.includes("trauma") && notesLower.includes("trauma")))
    ) {
      score += 6;
      reasons.push(`Aligned to need (${criteria.behavioralHealthNeed})`);
    }

    // 2. Network
    const networkMatch =
      !criteria.referralNetwork ||
      criteria.referralNetwork === "UNKNOWN" ||
      provider.networkNames.some(
        (n) => n.toLowerCase() === criteria.referralNetwork.toLowerCase()
      );
    if (networkMatch && criteria.referralNetwork && criteria.referralNetwork !== "UNKNOWN") {
      score += 22;
      reasons.push(`In network (${criteria.referralNetwork})`);
    } else if (!networkMatch) {
      score -= 22;
      mismatches.push(`Not verified in network (${criteria.referralNetwork})`);
    }

    // 3. Language
    const langMatch =
      !criteria.preferredLanguage ||
      provider.languages.some(
        (l) => l.toLowerCase() === criteria.preferredLanguage.toLowerCase()
      );
    if (criteria.preferredLanguage && langMatch) {
      score += 20;
      reasons.push(`${criteria.preferredLanguage}-speaking`);
    } else if (criteria.preferredLanguage) {
      mismatches.push(`Does not list ${criteria.preferredLanguage}`);
    }

    // 4. Geography & modality preferences
    const geoMatch =
      !criteria.referralGeography ||
      provider.geography.toLowerCase() === criteria.referralGeography.toLowerCase() ||
      provider.county.toLowerCase() === criteria.referralGeography.toLowerCase();

    if (criteria.referralGeography && geoMatch) {
      score += 14;
      reasons.push(`Local geography (${provider.geography})`);
    } else if (provider.telehealthAvailable && criteria.digitalAccessLevel !== "NONE") {
      score += 8;
      reasons.push("Telehealth accessible across geography");
    } else if (criteria.referralGeography) {
      mismatches.push(`Outside local geography (${provider.geography})`);
    }

    if (preferredModality === "TELEHEALTH") {
      if (provider.telehealthAvailable) {
        score += 8;
        reasons.push("Matches telehealth preference");
      } else {
        score -= 12;
        mismatches.push("In-person only (no telehealth)");
      }
    }

    // 5. Provider status (accepting new patients)
    if (provider.acceptingNewPatients) {
      score += 8;
      reasons.push("Accepting new patients");
    } else {
      score -= 32;
      mismatches.push("Not accepting new patients");
    }

    // 6. Staleness calculation
    let staleAgeDays: number | null = null;
    let isStale = true;
    let stalenessLabel = "STALE (Verification date unknown)";
    if (provider.availabilityLastVerifiedAt) {
      staleAgeDays = Math.max(
        0,
        Math.floor(
          (now.getTime() - provider.availabilityLastVerifiedAt.getTime()) / (1000 * 60 * 60 * 24)
        )
      );
      isStale = staleAgeDays > STALE_AVAILABILITY_THRESHOLD_DAYS;
      stalenessLabel = isStale
        ? `STALE (${staleAgeDays}d since refresh)`
        : staleAgeDays === 0
          ? "FRESH (Verified today)"
          : `FRESH (${staleAgeDays}d ago)`;
    }

    // 7. Verified Availability vs Directory Data (never conflate!)
    const availableVerifiedSlots = provider.verifiedSlots
      .filter((s) => s.status === "AVAILABLE" && s.slotStartAt.getTime() >= now.getTime())
      .sort((a, b) => a.slotStartAt.getTime() - b.slotStartAt.getTime());

    const nextVerifiedSlot = availableVerifiedSlots[0] ?? null;

    let availabilityLabel: ProviderMatchResult["availabilityLabel"];
    let availabilityWarning: string | null = null;

    if (
      provider.availabilitySource === "VERIFIED_AVAILABILITY" &&
      (nextVerifiedSlot || provider.nextVerifiedSlotAt)
    ) {
      availabilityLabel = "VERIFIED AVAILABILITY";
      score += 14;
      const slotDate = nextVerifiedSlot?.slotStartAt ?? provider.nextVerifiedSlotAt!;
      const daysUntilSlot = Math.max(
        0,
        Math.ceil((slotDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );
      if (daysUntilSlot <= 7) {
        score += 6;
        reasons.push(`Verified appointment available within 7 days (${daysUntilSlot}d)`);
      } else {
        reasons.push(`Verified slot available in ${daysUntilSlot} days`);
      }
      if (isStale) {
        availabilityWarning = `Verified slot feed was last refreshed ${staleAgeDays} days ago; re-confirm slot before booking.`;
      }
    } else if (provider.availabilitySource === "NOT_AVAILABLE") {
      availabilityLabel = "NOT AVAILABLE";
      score -= 30;
      availabilityWarning = "Provider marked NOT AVAILABLE for new referrals.";
      mismatches.push("No current availability");
    } else {
      availabilityLabel = "DIRECTORY DATA";
      availabilityWarning =
        "DIRECTORY DATA ONLY — appointment availability is NOT verified. Contact clinic before promising any date to member.";
      if (provider.directoryWaitDays !== null) {
        mismatches.push(`Unverified directory wait estimate ~${provider.directoryWaitDays} days`);
        if (provider.directoryWaitDays > 21) {
          score -= 6;
        }
      } else {
        mismatches.push("Directory wait time unverified");
      }
    }

    return {
      provider,
      matchScore: Math.max(0, Math.min(100, score)),
      availabilityLabel,
      availabilityWarning,
      isStale,
      staleAgeDays,
      stalenessLabel,
      reasons,
      mismatches,
      nextVerifiedSlot,
    };
  });

  return results.sort((a, b) => b.matchScore - a.matchScore);
}
