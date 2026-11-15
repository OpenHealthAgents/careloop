import { BarrierCategory, EpistemicStatus } from "@prisma/client";
import { z } from "zod";
import {
  BarrierDetectionInput,
  DetectedBarrierCandidate,
  DeterministicBarrierEngine,
} from "@/domain/barriers/barrier-engine";
import { BARRIER_UNKNOWN_LABEL } from "@/domain/barriers/taxonomy";
import {
  generateInterventionRecommendations,
  InterventionRecommendationSpec,
} from "@/domain/interventions/intervention-engine";
import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getCaseDetail } from "@/services/case-service";
import type { Agent } from "./contracts";

export const BarrierInferenceRecordSchema = z
  .object({
    barrier: z.nativeEnum(BarrierCategory),
    subBarrier: z.string().min(1),
    epistemicStatus: z.enum(["INFERENCE", "UNKNOWN"]),
    confidence: z.number().min(0).max(1),
    evidence: z.array(z.string()),
    source: z.string().min(1),
    timestamp: z.string().datetime(),
    recommendedAction: z.string().min(1),
  })
  .refine(
    (item) => {
      if (item.barrier !== BarrierCategory.UNKNOWN) {
        return item.evidence.length > 0 && item.epistemicStatus === "INFERENCE";
      }
      return item.epistemicStatus === "UNKNOWN";
    },
    {
      message:
        "Non-UNKNOWN barrier inference must cite non-empty evidence and carry epistemicStatus=INFERENCE; insufficient evidence must return UNKNOWN.",
    }
  );

export type BarrierInferenceRecord = z.infer<typeof BarrierInferenceRecordSchema>;

export interface BarrierIntelligenceInput {
  caseId: string;
  riskTier?: string;
  consentSms?: boolean;
  detection: BarrierDetectionInput;
}

export interface BarrierIntelligenceDecision {
  caseId: string;
  primary: BarrierInferenceRecord;
  secondary: BarrierInferenceRecord[];
  recommendedInterventions: InterventionRecommendationSpec[];
}

function defaultRecommendedActionForBarrier(
  category: BarrierCategory,
  subBarrier: string,
  interventions: InterventionRecommendationSpec[]
): string {
  if (category === "UNKNOWN") {
    return "Gather additional member, referral, or provider availability signals before selecting a barrier-specific intervention.";
  }
  if (category === "ACCESS") {
    return (
      interventions[0]?.intervention.recommendedAction ??
      "Search expanded geographic area or escalate provider access."
    );
  }
  return (
    interventions[0]?.intervention.recommendedAction ??
    `Recommend targeted ${category.toLowerCase()} intervention for '${subBarrier}' pending human confirmation.`
  );
}

function toInferenceRecord(
  candidate: DetectedBarrierCandidate,
  interventions: InterventionRecommendationSpec[]
): BarrierInferenceRecord {
  const hasEvidence = candidate.supportingSignals.length > 0;
  const barrier = hasEvidence ? candidate.category : BarrierCategory.UNKNOWN;
  const subBarrier = hasEvidence ? candidate.subBarrier : BARRIER_UNKNOWN_LABEL;
  const epistemicStatus: Extract<EpistemicStatus, "INFERENCE" | "UNKNOWN"> = hasEvidence
    ? "INFERENCE"
    : "UNKNOWN";

  return BarrierInferenceRecordSchema.parse({
    barrier,
    subBarrier,
    epistemicStatus,
    confidence: hasEvidence ? candidate.confidence : 0,
    evidence: hasEvidence ? candidate.supportingSignals : [],
    source: candidate.source,
    timestamp: candidate.detectedAt,
    recommendedAction: defaultRecommendedActionForBarrier(barrier, subBarrier, interventions),
  });
}

export class BarrierIntelligenceAgent
  implements Agent<BarrierIntelligenceInput, BarrierIntelligenceDecision>
{
  public readonly name = "CareLoopBarrierIntelligenceAgent";
  public readonly modelVersion = "careloop-barrier-rules-v2";
  public readonly promptVersion = "2.0.0";

  private readonly engine = new DeterministicBarrierEngine(this.modelVersion);

  async decide(input: BarrierIntelligenceInput): Promise<BarrierIntelligenceDecision> {
    const detected = await this.engine.detectBarriers(input.detection);

    const recommendedInterventions = generateInterventionRecommendations({
      caseId: input.caseId,
      primaryBarrierCategory: detected.primary.category,
      primaryBarrierCode: detected.primary.subBarrier,
      riskTier: input.riskTier ?? "MEDIUM",
      preferredLanguage: input.detection.preferredLanguage,
      digitalAccessLevel: input.detection.member.digitalAccessLevel,
      transportationAccess: input.detection.member.transportationAccess,
      consentSms: input.consentSms ?? false,
      verifiedAvailableSlotsCount: input.detection.verifiedAvailableSlotsCount,
      languageConcordantProvidersCount: input.detection.languageConcordantProvidersCount,
      priorNoShowCount: input.detection.member.priorNoShowCount,
      eligibilityVerified: input.detection.eligibilityVerified,
    });

    const primary = toInferenceRecord(detected.primary, recommendedInterventions);
    const secondary = detected.secondary.map((sec) =>
      toInferenceRecord(
        sec,
        generateInterventionRecommendations({
          caseId: input.caseId,
          primaryBarrierCategory: sec.category,
          primaryBarrierCode: sec.subBarrier,
          riskTier: input.riskTier ?? "MEDIUM",
          preferredLanguage: input.detection.preferredLanguage,
          digitalAccessLevel: input.detection.member.digitalAccessLevel,
          transportationAccess: input.detection.member.transportationAccess,
          consentSms: input.consentSms ?? false,
          verifiedAvailableSlotsCount: input.detection.verifiedAvailableSlotsCount,
          languageConcordantProvidersCount: input.detection.languageConcordantProvidersCount,
          priorNoShowCount: input.detection.member.priorNoShowCount,
          eligibilityVerified: input.detection.eligibilityVerified,
        })
      )
    );

    return {
      caseId: input.caseId,
      primary,
      secondary,
      recommendedInterventions,
    };
  }

  async analyzeCase(
    session: SessionUser,
    caseId: string
  ): Promise<BarrierIntelligenceDecision> {
    requirePermission(session, PERMISSIONS.AI_RUN);
    const careCase = await getCaseDetail(session.tenantId, caseId);

    const matchingProviders = await prisma.provider.findMany({
      where: {
        tenantId: session.tenantId,
        deletedAt: null,
        acceptingNewPatients: true,
      },
      include: {
        availabilities: {
          where: {
            source: "VERIFIED_AVAILABILITY",
            status: "AVAILABLE",
            slotStartAt: { gte: new Date() },
          },
        },
      },
    });

    const inNetwork = matchingProviders.filter((p) =>
      p.networkNames.includes(careCase.referral.networkRequired)
    );
    const languageConcordant = inNetwork.filter((p) =>
      p.languages.includes(careCase.member.preferredLanguage)
    );
    const verifiedSlots = inNetwork.reduce((sum, p) => sum + p.availabilities.length, 0);
    const waitDays = inNetwork
      .map((p) => p.directoryWaitDays)
      .filter((d): d is number => typeof d === "number");

    return this.decide({
      caseId: careCase.id,
      riskTier: careCase.riskLevel,
      consentSms: careCase.member.consentSms,
      detection: {
        referralId: careCase.referral.id,
        specialty: careCase.referral.specialty,
        geography: careCase.referral.geography,
        networkRequired: careCase.referral.networkRequired,
        preferredLanguage: careCase.member.preferredLanguage,
        eligibilityVerified: careCase.referral.eligibilityVerified,
        referringProviderName: careCase.referral.referringProviderName,
        operationalNotes: careCase.referral.operationalNotes,
        member: {
          urbanicity: careCase.member.urbanicity,
          eligibilityStatus: careCase.member.eligibilityStatus,
          digitalAccessLevel: careCase.member.digitalAccessLevel,
          transportationAccess: careCase.member.transportationAccess,
          priorNoShowCount: careCase.member.priorNoShowCount,
          historicalEngagementRate: careCase.member.historicalEngagementRate,
        },
        matchingProvidersCount: matchingProviders.length,
        inNetworkProvidersCount: inNetwork.length,
        languageConcordantProvidersCount: languageConcordant.length,
        verifiedAvailableSlotsCount: verifiedSlots,
        minDirectoryWaitDays: waitDays.length > 0 ? Math.min(...waitDays) : null,
      },
    });
  }
}

export const barrierIntelligenceAgent = new BarrierIntelligenceAgent();
