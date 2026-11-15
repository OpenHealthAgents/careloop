import {
  ProviderCandidate,
  ProviderMatchResult,
  rankProvidersForReferral,
} from "@/domain/matching/provider-matcher";
import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getCaseDetail } from "@/services/case-service";
import type { Agent } from "./contracts";

export interface MemberProviderPreferences {
  preferredModality?: "TELEHEALTH" | "IN_PERSON" | "ANY";
  preferredTimeWindow?: string | null;
  preferredDaysOfWeek?: string[];
  notes?: string;
}

export interface AccessibilityRequirements {
  wheelchairAccessible?: boolean;
  aslInterpreter?: boolean;
  telehealthRequired?: boolean;
  publicTransitNear?: boolean;
  notes?: string[];
}

export interface AppointmentTimingPreferences {
  earliestDate?: Date | string;
  latestDate?: Date | string;
  preferredTimeOfDay?: "MORNING" | "AFTERNOON" | "EVENING" | "ANY";
}

export interface ProviderMatchingInput {
  caseId?: string;
  specialty: string;
  behavioralHealthNeed?: string;
  network: string;
  geography: string;
  availability?: {
    requireVerifiedAvailability?: boolean;
  };
  language: string;
  modality?: "TELEHEALTH" | "IN_PERSON" | "ANY";
  memberPreferences?: MemberProviderPreferences;
  accessibilityRequirements?: AccessibilityRequirements;
  appointmentTiming?: AppointmentTimingPreferences;
  digitalAccessLevel?: string;
  candidates: ProviderCandidate[];
  now?: Date;
}

export interface ProviderEligibilityResult {
  providerId: string;
  providerName: string;
  eligible: boolean;
  reasons: string[];
  verifiedSlotsCount: number;
  verifiedSlotsInWindowCount: number;
}

export interface ProviderRecommendationItem {
  rank: number;
  providerId: string;
  providerName: string;
  organizationName: string;
  specialty: string;
  recommendationScore: number;
  availabilityLabel: ProviderMatchResult["availabilityLabel"];
  availabilityWarning: string | null;
  isStale: boolean;
  stalenessLabel: string;
  reasons: string[];
  mismatches: string[];
  nextVerifiedSlot: ProviderMatchResult["nextVerifiedSlot"];
}

export interface ProviderMatchingDecision {
  caseId?: string;
  /** Deterministic system-enforced eligibility results for every candidate */
  eligibility: {
    eligibleCount: number;
    ineligibleCount: number;
    results: ProviderEligibilityResult[];
  };
  /** Ranked recommendations over eligible providers ONLY (never invents availability) */
  recommendations: ProviderRecommendationItem[];
  availabilityFabricated: false;
}

function slotMatchesTimeOfDay(
  slotStartAt: Date,
  preferredTimeOfDay?: AppointmentTimingPreferences["preferredTimeOfDay"]
): boolean {
  if (!preferredTimeOfDay || preferredTimeOfDay === "ANY") return true;
  const hour = slotStartAt.getUTCHours();
  if (preferredTimeOfDay === "MORNING") return hour >= 6 && hour < 12;
  if (preferredTimeOfDay === "AFTERNOON") return hour >= 12 && hour < 17;
  if (preferredTimeOfDay === "EVENING") return hour >= 17 && hour <= 21;
  return true;
}

/**
 * Deterministic Provider Eligibility Evaluator.
 * Enforced by the system prior to any AI/heuristic ranking so ineligible providers
 * or unverified availability can never be recommended as eligible.
 */
export function evaluateProviderEligibility(
  candidate: ProviderCandidate,
  input: Omit<ProviderMatchingInput, "candidates">
): ProviderEligibilityResult {
  const now = input.now ?? new Date();
  const failureReasons: string[] = [];

  if (!candidate.acceptingNewPatients) {
    failureReasons.push("Provider is not accepting new patients.");
  }

  if (candidate.availabilitySource === "NOT_AVAILABLE") {
    failureReasons.push("Provider availability status is NOT_AVAILABLE.");
  }

  const networkMatch = candidate.networkNames.some(
    (n) => n.toLowerCase() === input.network.toLowerCase()
  );
  if (input.network && !networkMatch) {
    failureReasons.push(`Provider is not in required network '${input.network}'.`);
  }

  if (input.accessibilityRequirements?.telehealthRequired && !candidate.telehealthAvailable) {
    failureReasons.push("Accessibility/modality requires telehealth, which provider does not offer.");
  }

  const notesLower = (candidate.notes ?? "").toLowerCase();
  if (
    input.accessibilityRequirements?.wheelchairAccessible &&
    notesLower.includes("no wheelchair")
  ) {
    failureReasons.push("Provider facility is marked as not wheelchair accessible.");
  }

  const futureVerifiedSlots = candidate.verifiedSlots.filter(
    (s) => s.status === "AVAILABLE" && s.slotStartAt >= now
  );

  const earliest = input.appointmentTiming?.earliestDate
    ? new Date(input.appointmentTiming.earliestDate)
    : null;
  const latest = input.appointmentTiming?.latestDate
    ? new Date(input.appointmentTiming.latestDate)
    : null;

  const slotsInWindow = futureVerifiedSlots.filter((s) => {
    if (earliest && s.slotStartAt < earliest) return false;
    if (latest && s.slotStartAt > latest) return false;
    return true;
  });

  if (input.availability?.requireVerifiedAvailability && futureVerifiedSlots.length === 0) {
    failureReasons.push("No VERIFIED AVAILABILITY slots exist (directory data is not sufficient).");
  }

  if (
    input.availability?.requireVerifiedAvailability &&
    (earliest || latest) &&
    slotsInWindow.length === 0
  ) {
    failureReasons.push("No VERIFIED AVAILABILITY slots fall within the requested appointment timing window.");
  }

  return {
    providerId: candidate.id,
    providerName: candidate.name,
    eligible: failureReasons.length === 0,
    reasons: failureReasons.length === 0 ? ["Passed all deterministic eligibility rules."] : failureReasons,
    verifiedSlotsCount: futureVerifiedSlots.length,
    verifiedSlotsInWindowCount: slotsInWindow.length,
  };
}

export class ProviderMatchingAgent
  implements Agent<ProviderMatchingInput, ProviderMatchingDecision>
{
  public readonly name = "CareLoopProviderMatchingAgent";
  public readonly modelVersion = "careloop-provider-matcher-v2";
  public readonly promptVersion = "2.0.0";

  decide(input: ProviderMatchingInput): ProviderMatchingDecision {
    const eligibilityResults = input.candidates.map((candidate) =>
      evaluateProviderEligibility(candidate, input)
    );
    const eligibleSet = new Set(
      eligibilityResults.filter((r) => r.eligible).map((r) => r.providerId)
    );
    const eligibleCandidates = input.candidates.filter((c) => eligibleSet.has(c.id));

    const effectiveModality =
      input.modality ??
      input.memberPreferences?.preferredModality ??
      (input.accessibilityRequirements?.telehealthRequired ? "TELEHEALTH" : "ANY");

    const baseRanked = rankProvidersForReferral(eligibleCandidates, {
      referralSpecialty: input.specialty,
      behavioralHealthNeed: input.behavioralHealthNeed,
      referralNetwork: input.network,
      referralGeography: input.geography,
      preferredLanguage: input.language,
      preferredModality: effectiveModality,
      needsTelehealth: input.accessibilityRequirements?.telehealthRequired,
      digitalAccessLevel: input.digitalAccessLevel,
      now: input.now,
    });

    const scored = baseRanked.map((item) => {
      let bonus = 0;
      const extraReasons: string[] = [];

      // Appointment timing bonus when verified slots match preferred time of day
      if (
        input.appointmentTiming?.preferredTimeOfDay &&
        input.appointmentTiming.preferredTimeOfDay !== "ANY" &&
        item.provider.verifiedSlots.some((s) =>
          slotMatchesTimeOfDay(s.slotStartAt, input.appointmentTiming?.preferredTimeOfDay)
        )
      ) {
        bonus += 6;
        extraReasons.push(
          `Verified slot matches preferred ${input.appointmentTiming.preferredTimeOfDay.toLowerCase()} timing`
        );
      }

      // Member preference & accessibility bonus
      const notesLower = (item.provider.notes ?? "").toLowerCase();
      if (
        input.accessibilityRequirements?.aslInterpreter &&
        (notesLower.includes("asl") ||
          item.provider.languages.some((l) => l.toLowerCase() === "asl"))
      ) {
        bonus += 8;
        extraReasons.push("Supports ASL accessibility requirement");
      }

      if (
        input.accessibilityRequirements?.wheelchairAccessible &&
        notesLower.includes("wheelchair")
      ) {
        bonus += 5;
        extraReasons.push("Facility notes indicate wheelchair accessibility");
      }

      if (
        input.memberPreferences?.preferredTimeWindow &&
        notesLower.includes(input.memberPreferences.preferredTimeWindow.toLowerCase())
      ) {
        bonus += 4;
        extraReasons.push(`Matches preferred time window (${input.memberPreferences.preferredTimeWindow})`);
      }

      return {
        item,
        recommendationScore: item.matchScore + bonus,
        reasons: [...item.reasons, ...extraReasons],
      };
    });

    scored.sort((a, b) => b.recommendationScore - a.recommendationScore);

    const recommendations: ProviderRecommendationItem[] = scored.map((entry, idx) => ({
      rank: idx + 1,
      providerId: entry.item.provider.id,
      providerName: entry.item.provider.name,
      organizationName: entry.item.provider.organizationName,
      specialty: entry.item.provider.specialty,
      recommendationScore: entry.recommendationScore,
      availabilityLabel: entry.item.availabilityLabel,
      availabilityWarning: entry.item.availabilityWarning,
      isStale: entry.item.isStale,
      stalenessLabel: entry.item.stalenessLabel,
      reasons: entry.reasons,
      mismatches: entry.item.mismatches,
      nextVerifiedSlot: entry.item.nextVerifiedSlot,
    }));

    return {
      caseId: input.caseId,
      eligibility: {
        eligibleCount: eligibleCandidates.length,
        ineligibleCount: input.candidates.length - eligibleCandidates.length,
        results: eligibilityResults,
      },
      recommendations,
      availabilityFabricated: false,
    };
  }

  async matchForCase(
    session: SessionUser,
    caseId: string,
    overrides?: {
      requireVerifiedAvailability?: boolean;
      modality?: "TELEHEALTH" | "IN_PERSON" | "ANY";
      memberPreferences?: MemberProviderPreferences;
      accessibilityRequirements?: AccessibilityRequirements;
      appointmentTiming?: AppointmentTimingPreferences;
    }
  ): Promise<ProviderMatchingDecision> {
    requirePermission(session, PERMISSIONS.PROVIDERS_READ);
    const careCase = await getCaseDetail(session.tenantId, caseId);

    const providers = await prisma.provider.findMany({
      where: {
        tenantId: session.tenantId,
        deletedAt: null,
      },
      include: {
        availabilities: {
          where: {
            source: "VERIFIED_AVAILABILITY",
            status: "AVAILABLE",
            slotStartAt: { gte: new Date() },
          },
          orderBy: { slotStartAt: "asc" },
        },
      },
    });

    const candidates: ProviderCandidate[] = providers.map((p) => ({
      id: p.id,
      npi: p.npi,
      name: p.name,
      organizationName: p.organizationName,
      specialty: p.specialty,
      networkNames: p.networkNames,
      languages: p.languages,
      geography: p.geography,
      county: p.county,
      telehealthAvailable: p.telehealthAvailable,
      acceptingNewPatients: p.acceptingNewPatients,
      availabilitySource: p.availabilitySource,
      nextVerifiedSlotAt: p.nextVerifiedSlotAt,
      directoryWaitDays: p.directoryWaitDays,
      availabilityLastVerifiedAt: p.availabilityLastVerifiedAt,
      notes: p.notes,
      verifiedSlots: p.availabilities.map((s) => ({
        id: s.id,
        slotStartAt: s.slotStartAt,
        slotEndAt: s.slotEndAt,
        modality: s.modality,
        status: s.status,
      })),
    }));

    return this.decide({
      caseId: careCase.id,
      specialty: careCase.referral.specialty,
      behavioralHealthNeed: careCase.referral.behavioralHealthNeed,
      network: careCase.referral.networkRequired,
      geography: careCase.referral.geography,
      availability: {
        requireVerifiedAvailability: overrides?.requireVerifiedAvailability ?? false,
      },
      language: careCase.member.preferredLanguage,
      modality: overrides?.modality,
      memberPreferences: overrides?.memberPreferences,
      accessibilityRequirements: overrides?.accessibilityRequirements,
      appointmentTiming: overrides?.appointmentTiming,
      digitalAccessLevel: careCase.member.digitalAccessLevel,
      candidates,
    });
  }
}

export const providerMatchingAgent = new ProviderMatchingAgent();
