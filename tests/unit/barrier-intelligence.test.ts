import { afterEach, describe, expect, it, vi } from "vitest";
import { BarrierCategory, EpistemicStatus } from "@prisma/client";
import { ExternalOpenAIProvider } from "@/ai/external-provider";
import { ClassifyBarrierResultSchema } from "@/ai/schemas";
import {
  BarrierDetectionInput,
  DeterministicBarrierEngine,
} from "@/domain/barriers/barrier-engine";
import { BARRIER_TAXONOMY, BARRIER_UNKNOWN_LABEL } from "@/domain/barriers/taxonomy";

describe("Barrier Intelligence Engine & Hallucination Resistance", () => {
  const engine = new DeterministicBarrierEngine("careloop-barrier-rules-v2");

  const cleanBaseInput: BarrierDetectionInput = {
    referralId: "REF-CLEAN-1",
    specialty: "Outpatient Behavioral Health",
    geography: "Central Metro",
    networkRequired: "Horizon Medicaid",
    preferredLanguage: "English",
    eligibilityVerified: "VERIFIED",
    referringProviderName: "Dr. Morgan",
    operationalNotes: "",
    member: {
      urbanicity: "URBAN",
      eligibilityStatus: "ACTIVE",
      digitalAccessLevel: "HIGH",
      transportationAccess: "RELIABLE",
      priorNoShowCount: 0,
      historicalEngagementRate: 0.9,
    },
    matchingProvidersCount: 3,
    inNetworkProvidersCount: 3,
    languageConcordantProvidersCount: 3,
    verifiedAvailableSlotsCount: 4,
    minDirectoryWaitDays: 5,
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("covers all 7 canonical barrier categories and returns Barrier unknown when evidence is insufficient", async () => {
    expect(Object.keys(BARRIER_TAXONOMY)).toEqual([
      "ACCESS",
      "ADMINISTRATIVE",
      "FINANCIAL",
      "COMMUNICATION",
      "BEHAVIORAL",
      "SOCIAL_LOGISTICAL",
      "UNKNOWN",
    ]);

    const unknownResult = await engine.detectBarriers(cleanBaseInput);
    expect(unknownResult.primary.category).toBe(BarrierCategory.UNKNOWN);
    expect(unknownResult.primary.subBarrier).toBe(BARRIER_UNKNOWN_LABEL);
    expect(unknownResult.primary.epistemicStatus).toBe(EpistemicStatus.UNKNOWN);
    expect(unknownResult.primary.supportingSignals).toEqual([]);
    expect(unknownResult.primary.source).toBe("DETERMINISTIC_RULES");
    expect(unknownResult.primary.modelVersion).toBe("careloop-barrier-rules-v2");
  });

  it("never fabricates barriers from vague or non-specific referral notes", async () => {
    const vagueNotes = [
      "Routine outpatient referral placed by PCP.",
      "Member asked for callback next week.",
      "Standard behavioral health intake.",
    ];

    for (const operationalNotes of vagueNotes) {
      const res = await engine.detectBarriers({ ...cleanBaseInput, operationalNotes });
      expect(res.primary.category).toBe(BarrierCategory.UNKNOWN);
      expect(res.primary.subBarrier).toBe(BARRIER_UNKNOWN_LABEL);
      expect(res.primary.epistemicStatus).toBe(EpistemicStatus.UNKNOWN);
    }
  });

  it("detects specific canonical barriers with evidence signals and INFERENCE epistemic status", async () => {
    const financial = await engine.detectBarriers({
      ...cleanBaseInput,
      operationalNotes: "Member worried about copay amount on specialist visits",
    });
    expect(financial.primary.category).toBe(BarrierCategory.FINANCIAL);
    expect(financial.primary.subBarrier).toBe("copay concern");
    expect(financial.primary.epistemicStatus).toBe(EpistemicStatus.INFERENCE);
    expect(financial.primary.supportingSignals.length).toBeGreaterThanOrEqual(1);

    const admin = await engine.detectBarriers({
      ...cleanBaseInput,
      operationalNotes: "Pending prior authorization from payer",
    });
    expect(admin.primary.category).toBe(BarrierCategory.ADMINISTRATIVE);
    expect(admin.primary.subBarrier).toBe("authorization requirement");

    const access = await engine.detectBarriers({
      ...cleanBaseInput,
      matchingProvidersCount: 0,
    });
    expect(access.primary.category).toBe(BarrierCategory.ACCESS);
    expect(access.primary.subBarrier).toBe("provider shortage");
  });

  it("enforces anti-hallucination schema guard: rejects non-UNKNOWN barriers without evidence signals", () => {
    const hallucinated = ClassifyBarrierResultSchema.safeParse({
      providerName: "LLM",
      modelVersion: "gpt-test",
      timestamp: new Date().toISOString(),
      epistemicStatus: "INFERENCE",
      source: "LLM_INFERENCE",
      confidence: 0.92,
      uncertainty: "low",
      evidenceSignals: [], // Empty evidence!
      facts: ["Referral received."],
      inferences: [{ statement: "Transportation barrier", confidence: 0.9, uncertainty: "none", supportingSignals: [] }],
      recommendations: [{ action: "Send ride", rationale: "Guess", confidence: 0.9, requiresHumanReview: true }],
      primaryBarrier: {
        category: "SOCIAL_LOGISTICAL",
        subBarrier: "transportation",
        rationale: "Fabricated guess",
      },
    });
    expect(hallucinated.success).toBe(false);
  });

  it("falls back safely to Barrier unknown if an external LLM returns hallucinated or invalid JSON", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                primaryBarrier: { category: "ACCESS", subBarrier: "invented reason", rationale: "fake" },
                evidenceSignals: [],
              }),
            },
          },
        ],
      }),
    } as Response);

    const ext = new ExternalOpenAIProvider("gpt-4o-mini");
    const result = await ext.classifyBarrier({
      ...cleanBaseInput,
      referralDate: new Date(),
      behavioralHealthNeed: "Counseling",
      urgency: "ROUTINE",
      member: {
        ...cleanBaseInput.member,
        coverageType: "MEDICAID",
        preferredContactChannel: "PHONE",
      },
    });

    delete process.env.OPENAI_API_KEY;
    expect(result.primaryBarrier.category).toBe("UNKNOWN");
    expect(result.primaryBarrier.subBarrier).toBe(BARRIER_UNKNOWN_LABEL);
    expect(result.epistemicStatus).toBe("UNKNOWN");
  });
});
