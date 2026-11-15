import { describe, expect, it } from "vitest";
import { ProviderMatchingAgent } from "@/agent";
import { ProviderCandidate } from "@/domain/matching/provider-matcher";

describe("ProviderMatchingAgent (Eligibility Separation, Ranking & Non-Fabricated Availability)", () => {
  const agent = new ProviderMatchingAgent();
  const now = new Date("2026-11-12T08:00:00Z");

  const candidates: ProviderCandidate[] = [
    {
      id: "prov-eligible-verified-morning",
      npi: "1111111111",
      name: "Dr. Elena Alvarez",
      organizationName: "Horizon Behavioral",
      specialty: "Outpatient Therapy",
      networkNames: ["HorizonCare"],
      languages: ["English", "Spanish"],
      geography: "Central Metro",
      county: "Central",
      telehealthAvailable: true,
      acceptingNewPatients: true,
      availabilitySource: "VERIFIED_AVAILABILITY",
      nextVerifiedSlotAt: new Date("2026-11-13T09:00:00Z"),
      directoryWaitDays: 2,
      availabilityLastVerifiedAt: now,
      notes: "Wheelchair accessible clinic; ASL interpreter available; morning appointments",
      verifiedSlots: [
        {
          id: "slot-1",
          slotStartAt: new Date("2026-11-13T09:00:00Z"),
          slotEndAt: new Date("2026-11-13T10:00:00Z"),
          modality: "TELEHEALTH",
          status: "AVAILABLE",
        },
      ],
    },
    {
      id: "prov-directory-only",
      npi: "2222222222",
      name: "Dr. Directory Only",
      organizationName: "Metro Clinic",
      specialty: "Outpatient Therapy",
      networkNames: ["HorizonCare"],
      languages: ["English"],
      geography: "Central Metro",
      county: "Central",
      telehealthAvailable: true,
      acceptingNewPatients: true,
      availabilitySource: "DIRECTORY_INFORMATION",
      nextVerifiedSlotAt: null,
      directoryWaitDays: 7,
      availabilityLastVerifiedAt: null,
      notes: "",
      verifiedSlots: [],
    },
    {
      id: "prov-out-of-network",
      npi: "3333333333",
      name: "Dr. Out Of Network",
      organizationName: "Private Practice",
      specialty: "Outpatient Therapy",
      networkNames: ["OtherNet"],
      languages: ["Spanish"],
      geography: "Central Metro",
      county: "Central",
      telehealthAvailable: true,
      acceptingNewPatients: true,
      availabilitySource: "VERIFIED_AVAILABILITY",
      nextVerifiedSlotAt: new Date("2026-11-13T10:00:00Z"),
      directoryWaitDays: 1,
      availabilityLastVerifiedAt: now,
      notes: "",
      verifiedSlots: [
        {
          id: "slot-2",
          slotStartAt: new Date("2026-11-13T10:00:00Z"),
          slotEndAt: new Date("2026-11-13T11:00:00Z"),
          modality: "TELEHEALTH",
          status: "AVAILABLE",
        },
      ],
    },
    {
      id: "prov-not-accepting",
      npi: "4444444444",
      name: "Dr. Closed Panel",
      organizationName: "Horizon Behavioral",
      specialty: "Outpatient Therapy",
      networkNames: ["HorizonCare"],
      languages: ["English"],
      geography: "Central Metro",
      county: "Central",
      telehealthAvailable: false,
      acceptingNewPatients: false,
      availabilitySource: "NOT_AVAILABLE",
      nextVerifiedSlotAt: null,
      directoryWaitDays: null,
      availabilityLastVerifiedAt: null,
      notes: "no wheelchair access",
      verifiedSlots: [],
    },
  ];

  it("enforces deterministic eligibility rules separately from ranking and never invents availability", () => {
    const decision = agent.decide({
      caseId: "case-pm-1",
      specialty: "Outpatient Therapy",
      network: "HorizonCare",
      geography: "Central Metro",
      availability: { requireVerifiedAvailability: true },
      language: "Spanish",
      modality: "TELEHEALTH",
      memberPreferences: { preferredTimeWindow: "Morning" },
      accessibilityRequirements: {
        telehealthRequired: true,
        wheelchairAccessible: true,
        aslInterpreter: true,
      },
      appointmentTiming: {
        earliestDate: new Date("2026-11-13T00:00:00Z"),
        latestDate: new Date("2026-11-14T23:59:59Z"),
        preferredTimeOfDay: "MORNING",
      },
      candidates,
      now,
    });

    expect(decision.availabilityFabricated).toBe(false);
    expect(decision.eligibility.eligibleCount).toBe(1);
    expect(decision.eligibility.ineligibleCount).toBe(3);

    const directoryElig = decision.eligibility.results.find(
      (r) => r.providerId === "prov-directory-only"
    );
    expect(directoryElig?.eligible).toBe(false);
    expect(directoryElig?.reasons[0]).toContain("VERIFIED AVAILABILITY");

    expect(decision.recommendations).toHaveLength(1);
    expect(decision.recommendations[0].rank).toBe(1);
    expect(decision.recommendations[0].providerId).toBe("prov-eligible-verified-morning");
    expect(decision.recommendations[0].availabilityLabel).toBe("VERIFIED AVAILABILITY");
    expect(decision.recommendations[0].nextVerifiedSlot?.id).toBe("slot-1");
    expect(decision.recommendations[0].reasons.join(" ")).toContain("morning timing");
    expect(decision.recommendations[0].reasons.join(" ")).toContain("ASL");
  });

  it("still marks directory-only providers as DIRECTORY DATA (not verified) when verified availability is not required", () => {
    const decision = agent.decide({
      caseId: "case-pm-2",
      specialty: "Outpatient Therapy",
      network: "HorizonCare",
      geography: "Central Metro",
      availability: { requireVerifiedAvailability: false },
      language: "English",
      modality: "ANY",
      candidates,
      now,
    });

    expect(decision.eligibility.eligibleCount).toBe(2);
    expect(decision.recommendations[0].providerId).toBe("prov-eligible-verified-morning");
    expect(decision.recommendations[1].providerId).toBe("prov-directory-only");
    expect(decision.recommendations[1].availabilityLabel).toBe("DIRECTORY DATA");
    expect(decision.recommendations[1].nextVerifiedSlot).toBeNull();
  });
});
