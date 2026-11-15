import { DeterministicBarrierEngine } from "@/domain/barriers/barrier-engine";
import {
  normalizeCommunicationMessageType,
  renderCommunicationTemplate,
} from "@/domain/communications/templates";
import { generateInterventionRecommendations } from "@/domain/interventions/intervention-engine";
import { rankProvidersForReferral } from "@/domain/matching/provider-matcher";
import { DeterministicRiskEngine } from "@/domain/risk/risk-engine";
import { getPromptTemplate } from "./prompts/registry";
import {
  AIProvider,
  GenerateCommunicationInput,
  MatchProviderAIInput,
  RecommendInterventionInput,
  ReferralAssessmentInput,
  SummarizeCaseInput,
} from "./provider";
import {
  CalculateRiskResult,
  CalculateRiskResultSchema,
  ClassifyBarrierResult,
  ClassifyBarrierResultSchema,
  GenerateCommunicationResult,
  GenerateCommunicationResultSchema,
  MatchProviderResult,
  MatchProviderResultSchema,
  RecommendInterventionResult,
  RecommendInterventionResultSchema,
  SummarizeCaseResult,
  SummarizeCaseResultSchema,
} from "./schemas";

export class DeterministicAIProvider implements AIProvider {
  public readonly name = "CareLoop-Deterministic-Engine";
  public readonly modelVersion: string;
  private readonly riskEngine: DeterministicRiskEngine;
  private readonly barrierEngine: DeterministicBarrierEngine;

  constructor(modelVersion = "careloop-rules-v1") {
    this.modelVersion = modelVersion;
    this.riskEngine = new DeterministicRiskEngine(modelVersion);
    this.barrierEngine = new DeterministicBarrierEngine(modelVersion);
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  private collectFacts(input: ReferralAssessmentInput): string[] {
    const facts: string[] = [
      `Referral ${input.referralId} requests ${input.specialty} (${input.behavioralHealthNeed}) in ${input.geography}.`,
      `Member preferred language is ${input.preferredLanguage}; eligibility verification status is ${input.eligibilityVerified}.`,
      `Matching in-network providers found: ${input.matchingProvidersCount}; verified open slots: ${input.verifiedAvailableSlotsCount}.`,
    ];
    if (input.member.priorNoShowCount > 0) {
      facts.push(`Historical record shows ${input.member.priorNoShowCount} prior missed appointment(s).`);
    }
    if (input.member.transportationAccess !== "UNKNOWN") {
      facts.push(`Recorded transportation access: ${input.member.transportationAccess}.`);
    }
    if (input.member.digitalAccessLevel !== "UNKNOWN") {
      facts.push(`Recorded digital access level: ${input.member.digitalAccessLevel}.`);
    }
    if (input.minDirectoryWaitDays !== null) {
      facts.push(`Minimum directory-estimated wait time is ${input.minDirectoryWaitDays} days.`);
    }
    return facts;
  }

  async classifyBarrier(input: ReferralAssessmentInput): Promise<ClassifyBarrierResult> {
    const facts = this.collectFacts(input);
    const detection = await this.barrierEngine.detectBarriers({
      referralId: input.referralId,
      specialty: input.specialty,
      geography: input.geography,
      networkRequired: input.networkRequired,
      preferredLanguage: input.preferredLanguage,
      eligibilityVerified: input.eligibilityVerified,
      referringProviderName: input.referringProviderName,
      operationalNotes: input.operationalNotes,
      member: {
        urbanicity: input.member.urbanicity,
        eligibilityStatus: input.member.eligibilityStatus,
        digitalAccessLevel: input.member.digitalAccessLevel,
        transportationAccess: input.member.transportationAccess,
        priorNoShowCount: input.member.priorNoShowCount,
        historicalEngagementRate: input.member.historicalEngagementRate,
      },
      matchingProvidersCount: input.matchingProvidersCount,
      inNetworkProvidersCount: input.inNetworkProvidersCount,
      languageConcordantProvidersCount: input.languageConcordantProvidersCount,
      verifiedAvailableSlotsCount: input.verifiedAvailableSlotsCount,
      minDirectoryWaitDays: input.minDirectoryWaitDays,
    });

    const primary = detection.primary;
    const isUnknown = primary.category === "UNKNOWN";

    const result: ClassifyBarrierResult = {
      providerName: this.name,
      modelVersion: primary.modelVersion,
      timestamp: primary.detectedAt,
      epistemicStatus: isUnknown ? "UNKNOWN" : "INFERENCE",
      source: primary.source,
      confidence: primary.confidence,
      uncertainty: primary.uncertainty,
      evidenceSignals: isUnknown
        ? primary.supportingSignals
        : [primary, ...detection.secondary].flatMap((b) => b.supportingSignals),
      facts,
      inferences: isUnknown
        ? [
            {
              statement: "Available intake records are insufficient to assert a specific care barrier.",
              confidence: primary.confidence,
              uncertainty: primary.uncertainty,
              supportingSignals: [],
            },
          ]
        : [primary, ...detection.secondary].map((b) => ({
            statement: `Likely ${b.category.toLowerCase()} barrier: ${b.subBarrier}.`,
            confidence: b.confidence,
            uncertainty: b.uncertainty,
            supportingSignals: b.supportingSignals,
          })),
      recommendations: [
        {
          action: isUnknown
            ? "Conduct brief human navigator outreach to clarify scheduling needs; do not guess a barrier."
            : `Confirm '${primary.subBarrier}' barrier during initial outreach and stage targeted support.`,
          rationale: primary.evidenceSummary,
          confidence: isUnknown ? 0.75 : primary.confidence,
          requiresHumanReview: isUnknown || primary.confidence < 0.8 || detection.secondary.length > 0,
        },
      ],
      primaryBarrier: {
        category: primary.category,
        subBarrier: primary.subBarrier,
        rationale: primary.evidenceSummary,
      },
      secondaryBarriers: detection.secondary.map((s) => ({
        category: s.category,
        subBarrier: s.subBarrier,
        confidence: s.confidence,
      })),
    };

    return ClassifyBarrierResultSchema.parse(result);
  }

  async calculateRisk(input: ReferralAssessmentInput): Promise<CalculateRiskResult> {
    const facts = this.collectFacts(input);
    const riskOutput = await this.riskEngine.scoreReferral({
      referralId: input.referralId,
      referralDate: input.referralDate,
      urgency: input.urgency,
      specialty: input.specialty,
      geography: input.geography,
      networkRequired: input.networkRequired,
      preferredLanguage: input.preferredLanguage,
      eligibilityVerified: input.eligibilityVerified,
      referringProviderName: input.referringProviderName,
      operationalNotes: input.operationalNotes,
      member: {
        urbanicity: input.member.urbanicity,
        eligibilityStatus: input.member.eligibilityStatus,
        digitalAccessLevel: input.member.digitalAccessLevel,
        transportationAccess: input.member.transportationAccess,
        priorNoShowCount: input.member.priorNoShowCount,
        priorFailedReferralsCount: input.member.priorFailedReferralsCount,
        historicalEngagementRate: input.member.historicalEngagementRate,
      },
      matchingProvidersCount: input.matchingProvidersCount,
      inNetworkProvidersCount: input.inNetworkProvidersCount ?? input.matchingProvidersCount,
      languageConcordantProvidersCount: input.languageConcordantProvidersCount,
      verifiedAvailableSlotsCount: input.verifiedAvailableSlotsCount,
      minDirectoryWaitDays: input.minDirectoryWaitDays,
    });

    const signalTexts = riskOutput.supportingSignals.map((s) => `${s.signal} (+${s.points})`);

    const result: CalculateRiskResult = {
      providerName: this.name,
      modelVersion: riskOutput.modelVersion,
      timestamp: riskOutput.calculatedAt,
      confidence: riskOutput.confidence,
      uncertainty: riskOutput.uncertainty,
      evidenceSignals: signalTexts.length > 0 ? signalTexts : ["Baseline referral drop-off profile"],
      facts,
      inferences: [
        {
          statement: `Estimated ${riskOutput.riskLevel} operational risk of referral non-completion (${riskOutput.riskScore}/100).`,
          confidence: riskOutput.confidence,
          uncertainty: riskOutput.uncertainty,
          supportingSignals: signalTexts,
        },
      ],
      recommendations: [
        {
          action: riskOutput.humanEscalationRecommended
            ? "Assign immediately to Care Manager for active human-in-the-loop coordination."
            : "Proceed with standard barrier verification and assisted scheduling workflow.",
          rationale: `Priority score ${riskOutput.riskScore}/100 driven by ${riskOutput.supportingSignals.length || 1} operational risk factor(s).`,
          confidence: riskOutput.confidence,
          requiresHumanReview: riskOutput.humanEscalationRecommended,
        },
      ],
      priorityScore: riskOutput.riskScore,
      riskTier: riskOutput.riskLevel,
      explanation: riskOutput.explanation,
      humanEscalationRecommended: riskOutput.humanEscalationRecommended,
      signalContributions: riskOutput.supportingSignals,
    };

    return CalculateRiskResultSchema.parse(result);
  }

  async recommendIntervention(
    input: RecommendInterventionInput
  ): Promise<RecommendInterventionResult> {
    const specs = generateInterventionRecommendations(input);
    const facts = [
      `Case ${input.caseId} has primary barrier ${input.primaryBarrierCategory} (${input.primaryBarrierCode}).`,
      `Risk tier is ${input.riskTier}; verified available slots: ${input.verifiedAvailableSlotsCount}.`,
    ];
    const evidenceSignals = Array.from(new Set(specs.flatMap((s) => s.evidence)));
    const topConfidence = specs[0]?.confidence ?? 0.75;

    const proposed: RecommendInterventionResult["proposedInterventions"] = specs.map((spec) => ({
      type: spec.intervention.type,
      reason: spec.rationale,
      triggeringBarrierCategory: spec.barrier.category,
      triggeringBarrierCode: spec.barrier.code,
      barrierLabel: spec.barrier.label,
      recommendedAction: spec.intervention.recommendedAction,
      executionMode: spec.automationEligibility.executionMode,
      automationEligible: spec.automationEligibility.eligible,
      isHighRisk: spec.isHighRisk,
      requiredHumanInvolvement: spec.requiredHumanInvolvement,
      expectedOutcome: spec.expectedOutcome,
      evidence: spec.evidence,
      confidence: spec.confidence,
    }));

    const result: RecommendInterventionResult = {
      providerName: this.name,
      modelVersion: this.modelVersion,
      timestamp: this.nowIso(),
      confidence: topConfidence,
      uncertainty:
        "Recommendations reflect historical coordination patterns; human-assisted/human-only or high-risk interventions require Care Manager approval before execution.",
      evidenceSignals,
      facts,
      inferences: [
        {
          statement: `${proposed[0].type} (${proposed[0].executionMode}) is the highest-leverage next intervention for ${input.primaryBarrierCode}.`,
          confidence: topConfidence,
          uncertainty: "Effectiveness depends on member responsiveness and slot confirmation.",
          supportingSignals: evidenceSignals,
        },
      ],
      recommendations: proposed.map((p) => ({
        action: p.recommendedAction,
        rationale: p.reason,
        confidence: p.confidence,
        requiresHumanReview: !p.automationEligible || p.isHighRisk || p.executionMode !== "AUTOMATED",
      })),
      proposedInterventions: proposed,
    };

    return RecommendInterventionResultSchema.parse(result);
  }

  async summarizeCase(input: SummarizeCaseInput): Promise<SummarizeCaseResult> {
    const confirmedBarriers = input.barriers.filter((b) => b.confirmedByHuman);
    const inferredBarriers = input.barriers.filter((b) => !b.confirmedByHuman);
    const completedInterventions = input.interventions.filter((i) => i.status === "COMPLETED");

    const facts = [
      `Case ${input.caseId} is in status ${input.status} for ${input.specialty} (${input.referralNeed}).`,
      `Risk tier: ${input.riskTier} (${input.priorityScore}/100).`,
      `Recorded outreach attempts: ${input.outreachCount}; appointments: ${input.appointmentsCount} (latest: ${input.latestAppointmentStatus ?? "NONE"}); verification signals: ${input.verificationsCount}.`,
    ];

    const openGaps: string[] = [];
    if (confirmedBarriers.length === 0) {
      openGaps.push("Primary barrier has not yet been confirmed by a human coordinator.");
    }
    if (input.appointmentsCount === 0) {
      openGaps.push("No appointment scheduled yet.");
    }
    if (input.verificationsCount === 0) {
      openGaps.push("First completed visit not yet verified.");
    }

    const nextStepSummary =
      input.verificationsCount > 0
        ? "Review completion verification evidence and close case if visit goals are met."
        : input.appointmentsCount > 0
          ? "Confirm appointment attendance and capture provider/claim verification signal."
          : "Approve recommended intervention, match verified provider slot, and coordinate scheduling.";

    const result: SummarizeCaseResult = {
      providerName: this.name,
      modelVersion: this.modelVersion,
      timestamp: this.nowIso(),
      confidence: 0.9,
      uncertainty: "Summary reflects structured database facts as of generation timestamp.",
      evidenceSignals: [
        `Confirmed barriers: ${confirmedBarriers.length}`,
        `Inferred barriers: ${inferredBarriers.length}`,
        `Completed interventions: ${completedInterventions.length}`,
      ],
      facts,
      inferences: [
        {
          statement:
            openGaps.length > 0
              ? `Case has ${openGaps.length} open operational gap(s) preventing verified care completion.`
              : "All operational milestones through verification appear satisfied.",
          confidence: 0.88,
          uncertainty: "Verify external clinic status if appointment is pending.",
          supportingSignals: openGaps,
        },
      ],
      recommendations: [
        {
          action: nextStepSummary,
          rationale: "Aligned to CareLoop Referral -> Appointment -> Completed Visit journey.",
          confidence: 0.88,
          requiresHumanReview: true,
        },
      ],
      operationalSummary: `Case ${input.caseId} (${input.status}) — ${input.specialty} referral from ${input.referralDate.toISOString().slice(0, 10)}. Risk ${input.riskTier} (${input.priorityScore}/100). ${completedInterventions.length} intervention(s) completed, ${input.appointmentsCount} appointment(s) tracked.`,
      openGaps,
      nextStepSummary,
    };

    return SummarizeCaseResultSchema.parse(result);
  }

  async generateMemberCommunication(
    input: GenerateCommunicationInput
  ): Promise<GenerateCommunicationResult> {
    const messageType = normalizeCommunicationMessageType(input.purpose);
    const readingLevel = input.readingLevel ?? "PLAIN";
    const rendered = renderCommunicationTemplate({
      messageType,
      language: input.preferredLanguage,
      readingLevel,
      memberFirstName: input.memberFirstName,
      specialty: input.specialty,
      networkRequired: input.networkRequired,
      providerCount: input.providerCount,
      availableThisWeekCount: input.availableThisWeekCount,
      providerName: input.providerName,
      appointmentDateText: input.appointmentDateText,
    });

    const result: GenerateCommunicationResult = {
      providerName: this.name,
      modelVersion: this.modelVersion,
      timestamp: this.nowIso(),
      confidence: 0.91,
      uncertainty:
        "Draft message requires coordinator review before sending; verify member SMS consent and preferred channel.",
      evidenceSignals: [
        `Preferred language: ${input.preferredLanguage}`,
        `Channel: ${input.channel}`,
        `Message type: ${messageType} (${readingLevel})`,
      ],
      facts: [
        `Member prefers ${input.preferredLanguage} communication via ${input.channel}.`,
        `Referral specialty is ${input.specialty}.`,
      ],
      inferences: [
        {
          statement: "Supportive, plain-language outreach in the member's preferred language and reading level reduces scheduling drop-off.",
          confidence: 0.85,
          uncertainty: "Member response depends on active phone/SMS availability.",
          supportingSignals: [`Channel ${input.channel}`, `Language ${input.preferredLanguage}`, `Reading level ${readingLevel}`],
        },
      ],
      recommendations: [
        {
          action: "Review draft wording for accuracy and send via approved outreach channel.",
          rationale: "Human-approved messaging avoids robotic tone and verifies consent.",
          confidence: 0.91,
          requiresHumanReview: true,
        },
      ],
      channel: input.channel,
      messageType,
      readingLevel,
      templateKey: rendered.templateKey,
      internalAiLabel: "AI_GENERATED",
      language: input.preferredLanguage,
      subject: rendered.subject,
      draftMessage: rendered.body,
      toneNotes:
        "Warm, supportive human care-coordination voice adapted for language & reading level; free of clinical claims or internal AI reasoning.",
      promptVersion: getPromptTemplate("GENERATE_COMMUNICATION").version,
    };

    return GenerateCommunicationResultSchema.parse(result);
  }

  async matchProvider(input: MatchProviderAIInput): Promise<MatchProviderResult> {
    const ranked = rankProvidersForReferral(input.candidates, input.criteria);
    const top = ranked[0];

    const result: MatchProviderResult = {
      providerName: this.name,
      modelVersion: this.modelVersion,
      promptVersion: getPromptTemplate("MATCH_PROVIDER").version,
      timestamp: this.nowIso(),
      confidence: top ? Number((top.matchScore / 100).toFixed(2)) : 0.25,
      uncertainty:
        top?.availabilityLabel === "VERIFIED AVAILABILITY"
          ? "Top match has verified slot inventory; confirm member schedule fit before booking."
          : "Directory availability is unverified; clinic outreach required before promising a visit date.",
      evidenceSignals: ranked
        .slice(0, 3)
        .map((r) => `${r.provider.name}: ${r.matchScore}% (${r.availabilityLabel})`),
      facts: [
        `Evaluated ${input.candidates.length} network candidate(s) for ${input.criteria.referralSpecialty} (${input.criteria.preferredLanguage}, ${input.criteria.referralGeography}).`,
      ],
      inferences: top
        ? [
            {
              statement: `${top.provider.name} is the strongest operational match (${top.matchScore}%).`,
              confidence: Number((top.matchScore / 100).toFixed(2)),
              uncertainty: top.availabilityWarning ?? "Verified availability confirmed.",
              supportingSignals: top.reasons,
            },
          ]
        : [],
      recommendations: top
        ? [
            {
              action:
                top.availabilityLabel === "VERIFIED AVAILABILITY"
                  ? `Coordinate assisted scheduling with ${top.provider.name} using verified slot.`
                  : `Verify clinic availability with ${top.provider.name} before confirming appointment.`,
              rationale: top.reasons.join("; ") || "Best available match",
              confidence: Number((top.matchScore / 100).toFixed(2)),
              requiresHumanReview: top.availabilityLabel !== "VERIFIED AVAILABILITY",
            },
          ]
        : [
            {
              action: "Escalate for out-of-network or telehealth expansion due to 0 matching providers.",
              rationale: "No candidate providers met baseline criteria.",
              confidence: 0.9,
              requiresHumanReview: true,
            },
          ],
      rankedMatches: ranked.map((r) => ({
        providerId: r.provider.id,
        providerName: r.provider.name,
        matchScore: r.matchScore,
        availabilityLabel: r.availabilityLabel,
        recommendedForBooking: r.availabilityLabel !== "NOT AVAILABLE",
        rationale: r.reasons.join("; ") || r.mismatches.join("; ") || "Directory candidate",
        availabilityWarning: r.availabilityWarning,
      })),
    };

    return MatchProviderResultSchema.parse(result);
  }
}
