import { afterEach, describe, expect, it, vi } from "vitest";
import { AvailabilitySource } from "@prisma/client";
import {
  AIPolicyViolationError,
  DeterministicAIProvider,
  enforceBarrierPolicy,
  enforceCommunicationPolicy,
  enforceInterventionPolicy,
  enforceProviderMatchPolicy,
  ExternalOpenAIProvider,
  getPromptTemplate,
  parseAndValidateModelJson,
  PROMPT_TEMPLATES,
  ReferralAssessmentInput,
} from "@/ai";
import {
  CalculateRiskResultSchema,
  ClassifyBarrierResultSchema,
  GenerateCommunicationResultSchema,
  MatchProviderResultSchema,
  RecommendInterventionResultSchema,
  SummarizeCaseResultSchema,
} from "@/ai/schemas";
import { BARRIER_UNKNOWN_LABEL } from "@/domain/barriers/taxonomy";
import { ValidationError } from "@/lib/errors";

describe("AIProvider Abstraction, Versioned Prompts, Policy Guards & Validation", () => {
  const ai = new DeterministicAIProvider("test-v1");

  const insufficientEvidenceInput: ReferralAssessmentInput = {
    referralId: "REF-EMPTY-1",
    referralDate: new Date(),
    behavioralHealthNeed: "Outpatient Counseling",
    specialty: "Outpatient Behavioral Health",
    urgency: "ROUTINE",
    geography: "Central Metro",
    networkRequired: "Horizon Medicaid",
    preferredLanguage: "English",
    eligibilityVerified: "VERIFIED",
    referringProviderName: "Dr. Morgan",
    operationalNotes: "",
    member: {
      urbanicity: "URBAN",
      coverageType: "MEDICAID",
      eligibilityStatus: "ACTIVE",
      preferredContactChannel: "PHONE",
      digitalAccessLevel: "HIGH",
      transportationAccess: "RELIABLE",
      priorNoShowCount: 0,
      historicalEngagementRate: 0.9,
    },
    matchingProvidersCount: 2,
    inNetworkProvidersCount: 2,
    languageConcordantProvidersCount: 2,
    verifiedAvailableSlotsCount: 2,
    minDirectoryWaitDays: 5,
  };

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    vi.restoreAllMocks();
  });

  it("exposes versioned prompt templates for all 6 AI operations", () => {
    expect(Object.keys(PROMPT_TEMPLATES)).toEqual([
      "CALCULATE_RISK",
      "CLASSIFY_BARRIER",
      "RECOMMEND_INTERVENTION",
      "SUMMARIZE_CASE",
      "GENERATE_COMMUNICATION",
      "MATCH_PROVIDER",
    ]);
    expect(getPromptTemplate("MATCH_PROVIDER").version).toBe("1.0.0");
  });

  it("validates all 6 AIProvider operations including matchProvider and exposes uncertainty", async () => {
    const riskInput: ReferralAssessmentInput = {
      ...insufficientEvidenceInput,
      preferredLanguage: "Spanish",
      languageConcordantProvidersCount: 0,
      verifiedAvailableSlotsCount: 0,
      member: {
        ...insufficientEvidenceInput.member,
        transportationAccess: "NONE",
        priorNoShowCount: 2,
      },
    };

    const risk = await ai.calculateRisk(riskInput);
    expect(CalculateRiskResultSchema.safeParse(risk).success).toBe(true);
    expect(risk.riskTier).toBe("HIGH");
    expect(risk.uncertainty.length).toBeGreaterThan(5);

    const barrier = await ai.classifyBarrier(riskInput);
    expect(ClassifyBarrierResultSchema.safeParse(barrier).success).toBe(true);
    expect(barrier.primaryBarrier.category).toBe("COMMUNICATION");

    const rec = await ai.recommendIntervention({
      caseId: "case-1",
      primaryBarrierCategory: barrier.primaryBarrier.category,
      primaryBarrierCode: barrier.primaryBarrier.subBarrier,
      riskTier: risk.riskTier,
      preferredLanguage: "Spanish",
      digitalAccessLevel: "LIMITED",
      transportationAccess: "NONE",
      consentSms: true,
      verifiedAvailableSlotsCount: 1,
      languageConcordantProvidersCount: 1,
    });
    expect(RecommendInterventionResultSchema.safeParse(rec).success).toBe(true);

    const summary = await ai.summarizeCase({
      caseId: "case-1",
      status: "INTERVENTION_RECOMMENDED",
      referralNeed: "Outpatient Therapy",
      specialty: "Outpatient Behavioral Health",
      referralDate: new Date(),
      riskTier: "HIGH",
      priorityScore: 82,
      barriers: [],
      interventions: [],
      appointmentsCount: 0,
      latestAppointmentStatus: null,
      outreachCount: 0,
      verificationsCount: 0,
    });
    expect(SummarizeCaseResultSchema.safeParse(summary).success).toBe(true);

    const comm = await ai.generateMemberCommunication({
      memberFirstName: "Elena",
      preferredLanguage: "Spanish",
      channel: "SMS",
      purpose: "SCHEDULING_ASSIST",
      specialty: "Outpatient Behavioral Health",
    });
    expect(GenerateCommunicationResultSchema.safeParse(comm).success).toBe(true);
    expect(comm.draftMessage).toContain("Hola Elena");

    const match = await ai.matchProvider({
      caseId: "case-1",
      criteria: {
        referralSpecialty: "Outpatient Behavioral Health",
        referralNetwork: "Horizon Medicaid",
        referralGeography: "Central Metro",
        preferredLanguage: "Spanish",
      },
      candidates: [
        {
          id: "prov-1",
          npi: "111",
          name: "Dr. Rivera",
          organizationName: "Puente",
          specialty: "Outpatient Behavioral Health",
          networkNames: ["Horizon Medicaid"],
          languages: ["English", "Spanish"],
          geography: "Central Metro",
          county: "Metro",
          telehealthAvailable: true,
          acceptingNewPatients: true,
          availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY,
          nextVerifiedSlotAt: new Date(),
          directoryWaitDays: null,
          availabilityLastVerifiedAt: new Date(),
          verifiedSlots: [
            {
              id: "slot-1",
              slotStartAt: new Date(Date.now() + 86400000),
              slotEndAt: new Date(Date.now() + 90000000),
              modality: "TELEHEALTH",
              status: "AVAILABLE",
            },
          ],
        },
      ],
    });
    expect(MatchProviderResultSchema.safeParse(match).success).toBe(true);
    expect(match.rankedMatches[0].availabilityLabel).toBe("VERIFIED AVAILABILITY");
    expect(match.promptVersion).toBe("1.0.0");
  });

  it("rejects malformed model responses (invalid JSON and invalid schema)", async () => {
    expect(() =>
      parseAndValidateModelJson("{broken json", CalculateRiskResultSchema, "CALCULATE_RISK")
    ).toThrow(ValidationError);

    process.env.OPENAI_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"priorityScore": 999, "badField": true}' } }],
      }),
    } as Response);

    const strictExt = new ExternalOpenAIProvider({
      modelVersion: "gpt-4o-mini",
      strictRejectMalformed: true,
    });
    await expect(strictExt.calculateRisk(insufficientEvidenceInput)).rejects.toThrow(ValidationError);
  });

  it("rejects unsupported recommendations, clinical scope violations, and missing evidence via policy guard", async () => {
    const validComm = await ai.generateMemberCommunication({
      memberFirstName: "David",
      preferredLanguage: "English",
      channel: "SMS",
      purpose: "INITIAL_OUTREACH",
      specialty: "Outpatient Psychiatry",
    });

    // SMS without consent MUST be rejected by application policy
    expect(() =>
      enforceCommunicationPolicy(validComm, { consentSms: false, consentOutreach: true })
    ).toThrow(AIPolicyViolationError);

    // Clinical advice wording MUST be rejected
    const validRec = await ai.recommendIntervention({
      caseId: "case-1",
      primaryBarrierCategory: "FINANCIAL",
      primaryBarrierCode: "copay concern",
      riskTier: "MEDIUM",
      preferredLanguage: "English",
      digitalAccessLevel: "HIGH",
      transportationAccess: "RELIABLE",
      consentSms: false,
      verifiedAvailableSlotsCount: 1,
      languageConcordantProvidersCount: 1,
    });
    validRec.proposedInterventions[0].recommendedAction =
      "Prescribe SSRI medication dosage immediately";
    expect(() => enforceInterventionPolicy(validRec)).toThrow(AIPolicyViolationError);

    // Provider misrepresentation (DIRECTORY_INFORMATION labeled VERIFIED AVAILABILITY) MUST be rejected
    expect(() =>
      enforceProviderMatchPolicy(
        {
          providerName: "LLM",
          modelVersion: "1",
          timestamp: new Date().toISOString(),
          confidence: 0.8,
          uncertainty: "test",
          evidenceSignals: ["dir"],
          facts: ["test"],
          inferences: [],
          recommendations: [],
          rankedMatches: [
            {
              providerId: "prov-dir",
              providerName: "Dir Doc",
              matchScore: 80,
              availabilityLabel: "VERIFIED AVAILABILITY",
              recommendedForBooking: true,
              rationale: "Fake verified claim",
              availabilityWarning: null,
            },
          ],
        },
        new Map([["prov-dir", { availabilitySource: "DIRECTORY_INFORMATION" }]])
      )
    ).toThrow(AIPolicyViolationError);

    // Missing evidence on non-UNKNOWN barrier MUST be rejected
    const validBarrier = await ai.classifyBarrier({
      ...insufficientEvidenceInput,
      operationalNotes: "Missing prior authorization",
    });
    validBarrier.evidenceSignals = [];
    expect(() => enforceBarrierPolicy(validBarrier)).toThrow(AIPolicyViolationError);
  });

  it("never fabricates barriers on insufficient evidence and returns Barrier unknown", async () => {
    const res = await ai.classifyBarrier(insufficientEvidenceInput);
    expect(res.primaryBarrier.category).toBe("UNKNOWN");
    expect(res.primaryBarrier.subBarrier).toBe(BARRIER_UNKNOWN_LABEL);
    expect(res.confidence).toBeLessThanOrEqual(0.35);
  });
});
