import { BarrierCategory, EpistemicStatus } from "@prisma/client";
import { BARRIER_UNKNOWN_LABEL } from "./taxonomy";

export interface BarrierDetectionInput {
  referralId: string;
  specialty: string;
  geography: string;
  networkRequired: string;
  preferredLanguage: string;
  eligibilityVerified: string;
  referringProviderName?: string | null;
  operationalNotes?: string | null;
  member: {
    urbanicity: string;
    eligibilityStatus: string;
    digitalAccessLevel: string;
    transportationAccess: string;
    priorNoShowCount: number;
    historicalEngagementRate: number | null;
  };
  matchingProvidersCount: number;
  inNetworkProvidersCount?: number;
  languageConcordantProvidersCount: number;
  verifiedAvailableSlotsCount: number;
  minDirectoryWaitDays: number | null;
  now?: Date;
}

export interface DetectedBarrierCandidate {
  category: BarrierCategory;
  subBarrier: string;
  epistemicStatus: EpistemicStatus;
  confidence: number;
  evidenceSummary: string;
  supportingSignals: string[];
  uncertainty: string;
  source: string;
  modelVersion: string;
  detectedAt: string;
}

export interface BarrierDetectionResult {
  primary: DetectedBarrierCandidate;
  secondary: DetectedBarrierCandidate[];
}

export interface BarrierInferenceEngine {
  readonly source: string;
  readonly modelVersion: string;
  detectBarriers(input: BarrierDetectionInput): Promise<BarrierDetectionResult>;
}

interface RuleHit {
  category: BarrierCategory;
  subBarrier: string;
  confidence: number;
  signal: string;
}

/**
 * Deterministic rule-based barrier intelligence engine.
 * Strictly grounded in observed operational signals; never fabricates barriers
 * when evidence is absent or ambiguous (returns "Barrier unknown" / UNKNOWN).
 */
export class DeterministicBarrierEngine implements BarrierInferenceEngine {
  public readonly source = "DETERMINISTIC_RULES";
  public readonly modelVersion: string;

  constructor(modelVersion = "careloop-barrier-rules-v2") {
    this.modelVersion = modelVersion;
  }

  async detectBarriers(input: BarrierDetectionInput): Promise<BarrierDetectionResult> {
    const now = input.now ?? new Date();
    const detectedAt = now.toISOString();
    const notes = (input.operationalNotes ?? "").toLowerCase();
    const hits: RuleHit[] = [];

    // COMMUNICATION
    if (
      input.preferredLanguage.toLowerCase() !== "english" &&
      input.languageConcordantProvidersCount === 0
    ) {
      hits.push({
        category: "COMMUNICATION",
        subBarrier: "language",
        confidence: 0.9,
        signal: `Preferred language is ${input.preferredLanguage} with 0 matching language-concordant providers in directory`,
      });
    } else if (
      input.preferredLanguage.toLowerCase() !== "english" &&
      (notes.includes("language") || notes.includes("interpreter") || notes.includes("spanish"))
    ) {
      hits.push({
        category: "COMMUNICATION",
        subBarrier: "language",
        confidence: 0.82,
        signal: `Referral notes specify language concordance/interpreter need for ${input.preferredLanguage}`,
      });
    }

    if (
      input.member.digitalAccessLevel === "NONE" ||
      input.member.digitalAccessLevel === "LIMITED" ||
      notes.includes("no internet") ||
      notes.includes("no smartphone")
    ) {
      hits.push({
        category: "COMMUNICATION",
        subBarrier: "digital access",
        confidence: input.member.digitalAccessLevel === "NONE" ? 0.8 : 0.68,
        signal: `Digital access level is ${input.member.digitalAccessLevel}`,
      });
    }

    if (
      notes.includes("understand") ||
      notes.includes("literacy") ||
      notes.includes("confused by instructions")
    ) {
      hits.push({
        category: "COMMUNICATION",
        subBarrier: "inability to understand healthcare instructions",
        confidence: 0.74,
        signal: "Intake notes reference difficulty understanding healthcare instructions",
      });
    }

    // SOCIAL / LOGISTICAL
    if (
      input.member.transportationAccess === "NONE" ||
      notes.includes("transport") ||
      notes.includes("no car") ||
      notes.includes("bus") ||
      notes.includes("ride")
    ) {
      hits.push({
        category: "SOCIAL_LOGISTICAL",
        subBarrier: "transportation",
        confidence: 0.87,
        signal: "Transportation limitation recorded on member profile or intake notes",
      });
    }

    if (notes.includes("work") || notes.includes("shift") || notes.includes("hours")) {
      hits.push({
        category: "SOCIAL_LOGISTICAL",
        subBarrier: "work schedule",
        confidence: 0.76,
        signal: "Operational notes reference work-schedule conflicts",
      });
    }

    if (notes.includes("childcare") || notes.includes("caregiv") || notes.includes("dependent")) {
      hits.push({
        category: "SOCIAL_LOGISTICAL",
        subBarrier: "caregiving responsibilities",
        confidence: 0.77,
        signal: "Operational notes reference family caregiving responsibilities",
      });
    }

    // ADMINISTRATIVE
    if (notes.includes("auth")) {
      hits.push({
        category: "ADMINISTRATIVE",
        subBarrier: "authorization requirement",
        confidence: 0.85,
        signal: "Operational notes cite pending prior authorization",
      });
    }

    if (
      input.eligibilityVerified === "UNVERIFIED" ||
      input.member.eligibilityStatus === "PENDING" ||
      notes.includes("incomplete") ||
      notes.includes("missing signature")
    ) {
      hits.push({
        category: "ADMINISTRATIVE",
        subBarrier: "incomplete referral",
        confidence: 0.82,
        signal: `Eligibility (${input.eligibilityVerified}) or referral documentation requires completion`,
      });
    }

    if (
      (input.inNetworkProvidersCount !== undefined && input.inNetworkProvidersCount === 0) ||
      notes.includes("network confusion") ||
      notes.includes("out of network")
    ) {
      hits.push({
        category: "ADMINISTRATIVE",
        subBarrier: "network confusion",
        confidence: 0.79,
        signal: "Network mismatch or uncertainty on covered in-network clinics",
      });
    }

    if (notes.includes("documentation") || notes.includes("paperwork") || notes.includes("form")) {
      hits.push({
        category: "ADMINISTRATIVE",
        subBarrier: "documentation requirement",
        confidence: 0.75,
        signal: "Operational notes cite pending administrative documentation",
      });
    }

    // FINANCIAL
    if (notes.includes("copay") || notes.includes("co-pay")) {
      hits.push({
        category: "FINANCIAL",
        subBarrier: "copay concern",
        confidence: 0.83,
        signal: "Operational notes cite member copay concern",
      });
    } else if (notes.includes("coverage") || notes.includes("deductible")) {
      hits.push({
        category: "FINANCIAL",
        subBarrier: "coverage uncertainty",
        confidence: 0.78,
        signal: "Operational notes cite benefit coverage uncertainty",
      });
    } else if (notes.includes("afford") || notes.includes("cost") || notes.includes("expensive")) {
      hits.push({
        category: "FINANCIAL",
        subBarrier: "affordability",
        confidence: 0.79,
        signal: "Operational notes cite affordability concern",
      });
    }

    // ACCESS
    if (input.matchingProvidersCount === 0) {
      hits.push({
        category: "ACCESS",
        subBarrier: "provider shortage",
        confidence: 0.91,
        signal: `Zero in-network ${input.specialty} providers matched in ${input.geography}`,
      });
    } else if (input.verifiedAvailableSlotsCount === 0 && (input.minDirectoryWaitDays ?? 0) >= 21) {
      hits.push({
        category: "ACCESS",
        subBarrier: "long wait time",
        confidence: 0.79,
        signal: `Zero verified slots and minimum directory wait is ${input.minDirectoryWaitDays} days`,
      });
    } else if (input.member.urbanicity === "RURAL" && input.verifiedAvailableSlotsCount === 0) {
      hits.push({
        category: "ACCESS",
        subBarrier: "geographic distance",
        confidence: 0.76,
        signal: "Rural member geography with zero verified local slots",
      });
    } else if (input.verifiedAvailableSlotsCount === 0 && notes.includes("unavailable")) {
      hits.push({
        category: "ACCESS",
        subBarrier: "unavailable appointments",
        confidence: 0.75,
        signal: "No verified open appointments available",
      });
    }

    // BEHAVIORAL (non-clinical engagement friction only)
    if (input.member.priorNoShowCount >= 2) {
      hits.push({
        category: "BEHAVIORAL",
        subBarrier: "prior missed appointments",
        confidence: 0.81,
        signal: `${input.member.priorNoShowCount} prior missed appointments recorded`,
      });
    } else if (
      input.member.historicalEngagementRate !== null &&
      input.member.historicalEngagementRate < 0.45
    ) {
      hits.push({
        category: "BEHAVIORAL",
        subBarrier: "low engagement",
        confidence: 0.71,
        signal: `Historical appointment engagement rate is ${Math.round(
          input.member.historicalEngagementRate * 100
        )}%`,
      });
    } else if (notes.includes("hesitant") || notes.includes("unsure about starting")) {
      hits.push({
        category: "BEHAVIORAL",
        subBarrier: "treatment uncertainty",
        confidence: 0.7,
        signal: "Intake notes indicate non-clinical scheduling ambivalence",
      });
    }

    const sorted = hits.sort((a, b) => b.confidence - a.confidence);

    // Hallucination-resistant fallback: if evidence is insufficient, MUST return Barrier unknown.
    if (sorted.length === 0) {
      return {
        primary: {
          category: BarrierCategory.UNKNOWN,
          subBarrier: BARRIER_UNKNOWN_LABEL,
          epistemicStatus: EpistemicStatus.UNKNOWN,
          confidence: 0.3,
          evidenceSummary:
            "Insufficient operational evidence in referral or member records to identify a barrier.",
          supportingSignals: [],
          uncertainty:
            "No concrete access, administrative, financial, communication, engagement, or logistical blocker was observed. Human outreach required rather than guessing.",
          source: this.source,
          modelVersion: this.modelVersion,
          detectedAt,
        },
        secondary: [],
      };
    }

    const top = sorted[0];
    const toCandidate = (hit: RuleHit): DetectedBarrierCandidate => ({
      category: hit.category,
      subBarrier: hit.subBarrier,
      epistemicStatus: EpistemicStatus.INFERENCE,
      confidence: Number(hit.confidence.toFixed(2)),
      evidenceSummary: hit.signal,
      supportingSignals: [hit.signal],
      uncertainty:
        sorted.length > 1
          ? `Multiple candidate signals detected (${sorted.length}); confirm primary barrier with member.`
          : "Inferred from operational intake signals; confirm directly with member.",
      source: this.source,
      modelVersion: this.modelVersion,
      detectedAt,
    });

    return {
      primary: toCandidate(top),
      secondary: sorted.slice(1, 3).map(toCandidate),
    };
  }
}
