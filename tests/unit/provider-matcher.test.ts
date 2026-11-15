import { describe, expect, it } from "vitest";
import { AvailabilitySource } from "@prisma/client";
import {
  ProviderCandidate,
  rankProvidersForReferral,
  STALE_AVAILABILITY_THRESHOLD_DAYS,
} from "@/domain/matching/provider-matcher";

describe("Provider Matching, Ranking & Stale Directory Separation", () => {
  const fixedNow = new Date("2026-11-11T12:00:00Z");
  const slotIn3Days = new Date(fixedNow.getTime() + 3 * 24 * 60 * 60 * 1000);
  const staleDate = new Date(
    fixedNow.getTime() - (STALE_AVAILABILITY_THRESHOLD_DAYS + 7) * 24 * 60 * 60 * 1000
  );

  const providers: ProviderCandidate[] = [
    {
      id: "prov-dir",
      npi: "1000000001",
      name: "Directory Only Provider",
      organizationName: "Valley Clinic",
      specialty: "Outpatient Behavioral Health",
      networkNames: ["Horizon Medicaid"],
      languages: ["English", "Spanish"],
      geography: "Central Metro",
      county: "Metro County",
      telehealthAvailable: true,
      acceptingNewPatients: true,
      availabilitySource: AvailabilitySource.DIRECTORY_INFORMATION,
      nextVerifiedSlotAt: null,
      directoryWaitDays: 25,
      availabilityLastVerifiedAt: staleDate,
      verifiedSlots: [],
    },
    {
      id: "prov-ver",
      npi: "1000000002",
      name: "Verified Slot Provider",
      organizationName: "Puente Clinic",
      specialty: "Outpatient Behavioral Health",
      networkNames: ["Horizon Medicaid"],
      languages: ["English", "Spanish"],
      geography: "Central Metro",
      county: "Metro County",
      telehealthAvailable: true,
      acceptingNewPatients: true,
      availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY,
      nextVerifiedSlotAt: slotIn3Days,
      directoryWaitDays: null,
      availabilityLastVerifiedAt: fixedNow,
      notes: "Trauma-informed and depression care team.",
      verifiedSlots: [
        {
          id: "slot-1",
          slotStartAt: slotIn3Days,
          slotEndAt: new Date(slotIn3Days.getTime() + 3600000),
          modality: "TELEHEALTH",
          status: "AVAILABLE",
        },
      ],
    },
    {
      id: "prov-closed",
      npi: "1000000003",
      name: "Closed Waitlist Provider",
      organizationName: "North Ridge",
      specialty: "Outpatient Behavioral Health",
      networkNames: ["Other Plan"],
      languages: ["English"],
      geography: "Rural North",
      county: "North County",
      telehealthAvailable: false,
      acceptingNewPatients: false,
      availabilitySource: AvailabilitySource.NOT_AVAILABLE,
      nextVerifiedSlotAt: null,
      directoryWaitDays: 45,
      availabilityLastVerifiedAt: null,
      verifiedSlots: [],
    },
  ];

  it("ranks VERIFIED AVAILABILITY highest with 'Why Matched' reasons and flags stale DIRECTORY DATA", () => {
    const ranked = rankProvidersForReferral(providers, {
      referralSpecialty: "Outpatient Behavioral Health",
      behavioralHealthNeed: "Depression support",
      referralNetwork: "Horizon Medicaid",
      referralGeography: "Central Metro",
      preferredLanguage: "Spanish",
      preferredModality: "TELEHEALTH",
      now: fixedNow,
    });

    // Top match: Verified provider
    expect(ranked[0].provider.id).toBe("prov-ver");
    expect(ranked[0].availabilityLabel).toBe("VERIFIED AVAILABILITY");
    expect(ranked[0].availabilityWarning).toBeNull();
    expect(ranked[0].isStale).toBe(false);
    expect(ranked[0].reasons).toContain("In network (Horizon Medicaid)");
    expect(ranked[0].reasons).toContain("Spanish-speaking");
    expect(ranked[0].reasons).toContain("Accepting new patients");
    expect(ranked[0].reasons).toContain("Verified appointment available within 7 days (3d)");

    // Second match: Directory-only provider NEVER claims an appointment is available
    expect(ranked[1].provider.id).toBe("prov-dir");
    expect(ranked[1].availabilityLabel).toBe("DIRECTORY DATA");
    expect(ranked[1].isStale).toBe(true);
    expect(ranked[1].staleAgeDays).toBe(21);
    expect(ranked[1].stalenessLabel).toContain("STALE (21d");
    expect(ranked[1].availabilityWarning).toContain("DIRECTORY DATA ONLY");
    expect(ranked[1].reasons.join(" ")).not.toContain("Verified appointment available");

    // Third match: Closed / Out-of-network / Not Available
    expect(ranked[2].provider.id).toBe("prov-closed");
    expect(ranked[2].availabilityLabel).toBe("NOT AVAILABLE");
    expect(ranked[2].isStale).toBe(true);
    expect(ranked[2].mismatches).toContain("Not accepting new patients");
  });
});
