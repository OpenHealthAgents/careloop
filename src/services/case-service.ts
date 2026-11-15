import { createHash } from "crypto";
import {
  AIOperation,
  AppointmentStatus,
  BarrierCategory,
  CaseStatus,
  CommunicationChannel,
  CommunicationMessageType,
  DeliveryStatus,
  InterventionExecutionMode,
  InterventionStatus,
  InterventionType,
  NotificationStatus,
  Prisma,
  ReadingLevel,
  RecommendationStatus,
  ReferralStatus,
  VerificationSignalType,
  VerificationStatus,
  WorkflowEventType,
} from "@prisma/client";
import {
  enforceBarrierPolicy,
  enforceCommunicationPolicy,
  enforceInterventionPolicy,
  enforceProviderMatchPolicy,
  enforceRiskPolicy,
  getAIProvider,
  getPromptTemplate,
  ReferralAssessmentInput,
} from "@/ai";
import { DeterministicCommunicationAdapter, DeterministicSchedulingAdapter } from "@/adapters/dev-adapters";
import {
  assertAppointmentTransition,
  assertRecommendationTransition,
  canTransitionAppointmentStatus,
} from "@/domain/appointments/state-machine";
import { BARRIER_UNKNOWN_LABEL } from "@/domain/barriers/taxonomy";
import { assertCaseTransition, canTransitionCaseStatus } from "@/domain/cases/state-machine";
import { normalizeCommunicationMessageType } from "@/domain/communications/templates";
import { validateOutboundCommunication } from "@/domain/communications/validator";
import {
  evaluateVerificationSignal,
  resolveVerificationRules,
  VerificationRulesConfig,
} from "@/domain/completion/verifier";
import { INTERVENTION_CATALOG } from "@/domain/interventions/catalog";
import { resolveExecutionClassification } from "@/domain/interventions/intervention-engine";
import {
  assertAutomatedExecutionAllowed,
  assertInterventionTransition,
} from "@/domain/interventions/state-machine";
import { rankProvidersForReferral } from "@/domain/matching/provider-matcher";
import { canTransitionReferralStatus } from "@/domain/referrals/state-machine";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { caseRepository } from "@/repositories/case-repository";
import { providerRepository } from "@/repositories/provider-repository";
import { recordAuditEvent } from "./audit-service";

const commAdapter = new DeterministicCommunicationAdapter();
const schedAdapter = new DeterministicSchedulingAdapter();

export async function getCaseDetail(tenantId: string, caseId: string) {
  return caseRepository.findDetailById(tenantId, caseId);
}

export async function transitionCaseStatus(params: {
  session: SessionUser;
  caseId: string;
  toStatus: CaseStatus;
  reason: string;
  escalationReason?: string;
  closureReason?: string;
  correlationId?: string;
}) {
  const existing = await prisma.case.findFirst({
    where: { id: params.caseId, tenantId: params.session.tenantId },
  });
  if (!existing) throw new NotFoundError("Case", params.caseId);

  assertCaseTransition(existing.status, params.toStatus);

  const eventType: WorkflowEventType =
    params.toStatus === "ESCALATED"
      ? WorkflowEventType.ESCALATED
      : params.toStatus === "CLOSED"
        ? WorkflowEventType.CASE_CLOSED
        : WorkflowEventType.STATUS_TRANSITION;

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.case.update({
      where: { id: existing.id },
      data: {
        status: params.toStatus,
        ...(params.toStatus === "ESCALATED"
          ? {
              escalationReason: params.escalationReason ?? params.reason,
              humanReviewRequired: true,
            }
          : {}),
        ...(params.toStatus === "REQUIRES_HUMAN_REVIEW" ? { humanReviewRequired: true } : {}),
        ...(params.toStatus === "CLOSED"
          ? {
              closedAt: new Date(),
              closureReason: params.closureReason ?? params.reason,
              humanReviewRequired: false,
            }
          : {}),
      },
    });

    await tx.workflowEvent.create({
      data: {
        tenantId: params.session.tenantId,
        caseId: existing.id,
        eventType,
        fromStatus: existing.status,
        toStatus: params.toStatus,
        actorId: params.session.userId,
        actorRole: params.session.role,
        reason: params.reason,
      },
    });

    if (params.toStatus === "ESCALATED") {
      await tx.notification.create({
        data: {
          tenantId: params.session.tenantId,
          caseId: existing.id,
          recipientUserId: existing.assignedToId ?? params.session.userId,
          notificationType: "CASE_ESCALATION",
          title: "Case Escalated for Human Review",
          message: params.escalationReason ?? params.reason,
          status: NotificationStatus.SENT,
          sentAt: new Date(),
        },
      });
    }

    return c;
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "CASE_STATUS_TRANSITION",
    entityType: "Case",
    entityId: existing.id,
    source: "CASE_WORKFLOW",
    previousState: { status: existing.status, humanReviewRequired: existing.humanReviewRequired },
    newState: { status: updated.status, humanReviewRequired: updated.humanReviewRequired },
    correlationId: params.correlationId,
    summary: `Case transitioned from ${existing.status} to ${params.toStatus}`,
    metadata: { fromStatus: existing.status, toStatus: params.toStatus },
  });

  return updated;
}

export async function runCaseAIAssessment(params: {
  tenantId: string;
  caseId: string;
  actor?: SessionUser | null;
  correlationId?: string;
}) {
  const careCase = await getCaseDetail(params.tenantId, params.caseId);
  const providers = await providerRepository.listWithAvailabilities(params.tenantId);

  const ranked = rankProvidersForReferral(
    providers.map((p) => ({
      ...p,
      verifiedSlots: p.availabilities,
    })),
    {
      referralSpecialty: careCase.referral.specialty,
      behavioralHealthNeed: careCase.referral.behavioralHealthNeed,
      referralNetwork: careCase.referral.networkRequired,
      referralGeography: careCase.referral.geography,
      preferredLanguage: careCase.referral.preferredLanguage,
      digitalAccessLevel: careCase.member.digitalAccessLevel,
    }
  );

  const matchingProviders = ranked.filter((r) => r.matchScore >= 40);
  const inNetworkProvidersCount = providers.filter(
    (p) =>
      careCase.referral.networkRequired === "UNKNOWN" ||
      p.networkNames.some(
        (n) => n.toLowerCase() === careCase.referral.networkRequired.toLowerCase()
      )
  ).length;
  const priorFailedReferralsCount = await prisma.case.count({
    where: {
      tenantId: params.tenantId,
      memberId: careCase.memberId,
      id: { not: careCase.id },
      status: { in: ["LOST_TO_FOLLOW_UP", "BLOCKED"] },
    },
  });
  const languageConcordant = providers.filter((p) =>
    p.languages.some(
      (l) => l.toLowerCase() === careCase.referral.preferredLanguage.toLowerCase()
    )
  );
  const verifiedSlotsCount = providers.reduce(
    (sum, p) => sum + p.availabilities.filter((s) => s.source === "VERIFIED_AVAILABILITY").length,
    0
  );
  const waitDaysList = providers
    .map((p) => p.directoryWaitDays)
    .filter((d): d is number => d !== null);

  const assessmentInput: ReferralAssessmentInput = {
    referralId: careCase.referral.externalReferralId,
    referralDate: careCase.referral.referralDate,
    behavioralHealthNeed: careCase.referral.behavioralHealthNeed,
    specialty: careCase.referral.specialty,
    urgency: careCase.referral.urgency,
    geography: careCase.referral.geography,
    networkRequired: careCase.referral.networkRequired,
    preferredLanguage: careCase.referral.preferredLanguage,
    eligibilityVerified: careCase.referral.eligibilityVerified,
    referringProviderName: careCase.referral.referringProviderName,
    operationalNotes: careCase.referral.operationalNotes,
    member: {
      urbanicity: careCase.member.urbanicity,
      coverageType: careCase.member.coverageType,
      eligibilityStatus: careCase.member.eligibilityStatus,
      preferredContactChannel: careCase.member.preferredContactChannel,
      digitalAccessLevel: careCase.member.digitalAccessLevel,
      transportationAccess: careCase.member.transportationAccess,
      priorNoShowCount: careCase.member.priorNoShowCount,
      priorFailedReferralsCount,
      historicalEngagementRate: careCase.member.historicalEngagementRate,
    },
    matchingProvidersCount: matchingProviders.length,
    inNetworkProvidersCount,
    languageConcordantProvidersCount: languageConcordant.length,
    verifiedAvailableSlotsCount: verifiedSlotsCount,
    minDirectoryWaitDays: waitDaysList.length > 0 ? Math.min(...waitDaysList) : null,
  };

  const ai = getAIProvider();
  const [rawRiskResult, rawBarrierResult, rawMatchResult] = await Promise.all([
    ai.calculateRisk(assessmentInput),
    ai.classifyBarrier(assessmentInput),
    ai.matchProvider({
      caseId: careCase.id,
      criteria: {
        referralSpecialty: careCase.referral.specialty,
        referralNetwork: careCase.referral.networkRequired,
        referralGeography: careCase.referral.geography,
        preferredLanguage: careCase.referral.preferredLanguage,
        digitalAccessLevel: careCase.member.digitalAccessLevel,
      },
      candidates: providers.map((p) => ({ ...p, verifiedSlots: p.availabilities })),
    }),
  ]);

  const riskResult = enforceRiskPolicy(rawRiskResult);
  const barrierResult = enforceBarrierPolicy(rawBarrierResult);
  const matchResult = enforceProviderMatchPolicy(
    rawMatchResult,
    new Map(providers.map((p) => [p.id, { availabilitySource: p.availabilitySource }]))
  );

  const interventionInput = {
    caseId: careCase.id,
    primaryBarrierCategory: barrierResult.primaryBarrier.category,
    primaryBarrierCode: barrierResult.primaryBarrier.subBarrier,
    riskTier: riskResult.riskTier,
    preferredLanguage: careCase.referral.preferredLanguage,
    digitalAccessLevel: careCase.member.digitalAccessLevel,
    transportationAccess: careCase.member.transportationAccess,
    consentSms: careCase.member.consentSms,
    verifiedAvailableSlotsCount: verifiedSlotsCount,
    languageConcordantProvidersCount: languageConcordant.length,
    priorNoShowCount: careCase.member.priorNoShowCount,
    eligibilityVerified: careCase.referral.eligibilityVerified,
  };

  const interventionResult = enforceInterventionPolicy(
    await ai.recommendIntervention(interventionInput),
    { riskTier: riskResult.riskTier }
  );

  const riskAssessment = await prisma.riskAssessment.create({
    data: {
      tenantId: params.tenantId,
      caseId: careCase.id,
      referralId: careCase.referralId,
      riskLevel: riskResult.riskTier,
      score: riskResult.priorityScore,
      confidence: riskResult.confidence,
      uncertainty: riskResult.uncertainty,
      explanation: riskResult.explanation,
      humanEscalationSuggested: riskResult.humanEscalationRecommended,
      evidenceSignals: (riskResult.signalContributions.length > 0
        ? riskResult.signalContributions
        : riskResult.evidenceSignals) as unknown as Prisma.InputJsonValue,
      providerName: riskResult.providerName,
      modelVersion: riskResult.modelVersion,
      assessedAt: new Date(riskResult.timestamp),
    },
  });

  const riskRec = await prisma.aIRecommendation.create({
    data: {
      tenantId: params.tenantId,
      caseId: careCase.id,
      referralId: careCase.referralId,
      operation: AIOperation.CALCULATE_RISK,
      status: RecommendationStatus.PENDING,
      providerName: riskResult.providerName,
      modelVersion: riskResult.modelVersion,
      promptVersion: riskResult.promptVersion ?? getPromptTemplate("CALCULATE_RISK").version,
      inputContext: assessmentInput as unknown as Prisma.InputJsonValue,
      outputPayload: riskResult as unknown as Prisma.InputJsonValue,
      resultingAction: `UPDATED_RISK_PRIORITY:${riskResult.riskTier}(${riskResult.priorityScore})`,
      facts: riskResult.facts as Prisma.InputJsonValue,
      inferences: riskResult.inferences as Prisma.InputJsonValue,
      recommendations: riskResult.recommendations as Prisma.InputJsonValue,
      confidence: riskResult.confidence,
      uncertainty: riskResult.uncertainty,
      evidenceSignals: riskResult.evidenceSignals as Prisma.InputJsonValue,
      correlationId: params.correlationId,
    },
  });

  const barrierRec = await prisma.aIRecommendation.create({
    data: {
      tenantId: params.tenantId,
      caseId: careCase.id,
      referralId: careCase.referralId,
      operation: AIOperation.CLASSIFY_BARRIER,
      status: RecommendationStatus.PENDING,
      providerName: barrierResult.providerName,
      modelVersion: barrierResult.modelVersion,
      promptVersion: barrierResult.promptVersion ?? getPromptTemplate("CLASSIFY_BARRIER").version,
      inputContext: assessmentInput as unknown as Prisma.InputJsonValue,
      outputPayload: barrierResult as unknown as Prisma.InputJsonValue,
      resultingAction: `STAGED_BARRIER_${barrierResult.epistemicStatus}:${barrierResult.primaryBarrier.category}/${barrierResult.primaryBarrier.subBarrier}`,
      facts: barrierResult.facts as Prisma.InputJsonValue,
      inferences: barrierResult.inferences as Prisma.InputJsonValue,
      recommendations: barrierResult.recommendations as Prisma.InputJsonValue,
      confidence: barrierResult.confidence,
      uncertainty: barrierResult.uncertainty,
      evidenceSignals: barrierResult.evidenceSignals as Prisma.InputJsonValue,
      correlationId: params.correlationId,
    },
  });

  const interventionRec = await prisma.aIRecommendation.create({
    data: {
      tenantId: params.tenantId,
      caseId: careCase.id,
      referralId: careCase.referralId,
      operation: AIOperation.RECOMMEND_INTERVENTION,
      status: RecommendationStatus.PENDING,
      providerName: interventionResult.providerName,
      modelVersion: interventionResult.modelVersion,
      promptVersion:
        interventionResult.promptVersion ?? getPromptTemplate("RECOMMEND_INTERVENTION").version,
      inputContext: interventionInput as unknown as Prisma.InputJsonValue,
      outputPayload: interventionResult as unknown as Prisma.InputJsonValue,
      resultingAction: `STAGED_${interventionResult.proposedInterventions.length}_INTERVENTIONS_FOR_HUMAN_REVIEW`,
      facts: interventionResult.facts as Prisma.InputJsonValue,
      inferences: interventionResult.inferences as Prisma.InputJsonValue,
      recommendations: interventionResult.recommendations as Prisma.InputJsonValue,
      confidence: interventionResult.confidence,
      uncertainty: interventionResult.uncertainty,
      evidenceSignals: interventionResult.evidenceSignals as Prisma.InputJsonValue,
      correlationId: params.correlationId,
    },
  });

  await prisma.aIRecommendation.create({
    data: {
      tenantId: params.tenantId,
      caseId: careCase.id,
      referralId: careCase.referralId,
      operation: AIOperation.MATCH_PROVIDER,
      status: RecommendationStatus.PENDING,
      providerName: matchResult.providerName,
      modelVersion: matchResult.modelVersion,
      promptVersion: matchResult.promptVersion ?? getPromptTemplate("MATCH_PROVIDER").version,
      inputContext: { caseId: careCase.id, candidateCount: providers.length } as Prisma.InputJsonValue,
      outputPayload: matchResult as unknown as Prisma.InputJsonValue,
      resultingAction: matchResult.rankedMatches[0]
        ? `RANKED_TOP_PROVIDER:${matchResult.rankedMatches[0].providerId}`
        : "NO_MATCHING_PROVIDER",
      facts: matchResult.facts as Prisma.InputJsonValue,
      inferences: matchResult.inferences as Prisma.InputJsonValue,
      recommendations: matchResult.recommendations as Prisma.InputJsonValue,
      confidence: matchResult.confidence,
      uncertainty: matchResult.uncertainty,
      evidenceSignals: matchResult.evidenceSignals as Prisma.InputJsonValue,
      correlationId: params.correlationId,
    },
  });

  await prisma.barrier.create({
    data: {
      tenantId: params.tenantId,
      caseId: careCase.id,
      category: barrierResult.primaryBarrier.category,
      subBarrier: barrierResult.primaryBarrier.subBarrier,
      epistemicStatus:
        barrierResult.primaryBarrier.category === "UNKNOWN" ? "UNKNOWN" : "INFERENCE",
      confidence: barrierResult.confidence,
      evidenceSummary: barrierResult.primaryBarrier.rationale,
      evidenceSignals: barrierResult.evidenceSignals as Prisma.InputJsonValue,
      uncertainty: barrierResult.uncertainty,
      source: barrierResult.source,
      modelVersion: barrierResult.modelVersion,
      reviewStatus: "PENDING_REVIEW",
      confirmedByHuman: false,
      detectedAt: new Date(barrierResult.timestamp),
    },
  });

  for (const prop of interventionResult.proposedInterventions) {
    const classification = resolveExecutionClassification({
      type: prop.type,
      riskTier: riskResult.riskTier,
    });
    const resolvedExecutionMode: InterventionExecutionMode = classification.isHighRisk
      ? classification.executionMode
      : prop.executionMode;
    const resolvedAutoEligible =
      !classification.isHighRisk &&
      classification.executionMode === InterventionExecutionMode.AUTOMATED &&
      prop.automationEligible;

    await prisma.intervention.create({
      data: {
        tenantId: params.tenantId,
        caseId: careCase.id,
        type: prop.type,
        reason: prop.reason,
        triggeringBarrierCategory: prop.triggeringBarrierCategory,
        triggeringBarrierCode: prop.triggeringBarrierCode,
        recommendedAction: prop.recommendedAction,
        executionMode: resolvedExecutionMode,
        automationEligible: resolvedAutoEligible,
        isHighRisk: classification.isHighRisk,
        confidence: prop.confidence,
        requiredHumanInvolvement: prop.requiredHumanInvolvement,
        expectedOutcome: prop.expectedOutcome,
        status: InterventionStatus.RECOMMENDED,
        epistemicOrigin: "AI_RECOMMENDATION",
        aiRecommendationId: interventionRec.id,
        evidence: (prop.evidence.length > 0
          ? prop.evidence
          : interventionResult.evidenceSignals) as Prisma.InputJsonValue,
      },
    });
  }

  let nextStatus = careCase.status;
  if (
    careCase.status === "NEW" ||
    careCase.status === "TRIAGED" ||
    careCase.status === "BARRIER_IDENTIFIED"
  ) {
    nextStatus = CaseStatus.INTERVENTION_RECOMMENDED;
  }

  const updatedCase = await prisma.case.update({
    where: { id: careCase.id },
    data: {
      priorityScore: riskResult.priorityScore,
      riskLevel: riskResult.riskTier,
      riskExplanation: riskResult.explanation,
      primaryBarrierCategory: barrierResult.primaryBarrier.category,
      primaryBarrierCode: barrierResult.primaryBarrier.subBarrier,
      humanReviewRequired:
        riskResult.humanEscalationRecommended || barrierResult.primaryBarrier.category === "UNKNOWN",
      matchedProviderId: ranked[0]?.provider.id ?? careCase.matchedProviderId,
      status: nextStatus,
    },
  });

  if (nextStatus !== careCase.status) {
    await prisma.workflowEvent.create({
      data: {
        tenantId: params.tenantId,
        caseId: careCase.id,
        eventType: WorkflowEventType.INTERVENTION_RECOMMENDED,
        fromStatus: careCase.status,
        toStatus: nextStatus,
        actorId: params.actor?.userId ?? null,
        actorRole: params.actor?.role ?? "SYSTEM_AI",
        reason: `AI triage completed: ${riskResult.riskTier} risk (${riskResult.priorityScore}/100), inferred barrier '${barrierResult.primaryBarrier.subBarrier}'`,
      },
    });
  }

  logger.info(
    "case.ai_assessment_completed",
    {
      caseId: careCase.id,
      riskLevel: riskResult.riskTier,
      priorityScore: riskResult.priorityScore,
      barrierCategory: barrierResult.primaryBarrier.category,
    },
    { tenantId: params.tenantId, actorId: params.actor?.userId, correlationId: params.correlationId }
  );

  return {
    careCase: updatedCase,
    riskAssessment,
    riskTrace: riskRec,
    barrierTrace: barrierRec,
    recTrace: interventionRec,
    riskResult,
    barrierResult,
    interventionResult,
    rankedProviders: ranked.slice(0, 5),
  };
}

export async function confirmOrCorrectBarrier(params: {
  session: SessionUser;
  caseId: string;
  category: BarrierCategory;
  subBarrier: string;
  evidenceNote: string;
  correlationId?: string;
}) {
  const existing = await prisma.case.findFirst({
    where: { id: params.caseId, tenantId: params.session.tenantId },
  });
  if (!existing) throw new NotFoundError("Case", params.caseId);

  const resolvedSubBarrier =
    params.category === "UNKNOWN" ? BARRIER_UNKNOWN_LABEL : params.subBarrier;
  const epistemicStatus = params.category === "UNKNOWN" ? "UNKNOWN" : "FACT";

  const barrier = await prisma.barrier.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: existing.id,
      category: params.category,
      subBarrier: resolvedSubBarrier,
      epistemicStatus,
      confidence: params.category === "UNKNOWN" ? null : 1.0,
      evidenceSummary: params.evidenceNote,
      evidenceSignals: [params.evidenceNote] as Prisma.InputJsonValue,
      source: "HUMAN_REVIEW",
      reviewStatus: params.category === "UNKNOWN" ? "MARKED_UNKNOWN" : "ACCEPTED",
      confirmedByHuman: params.category !== "UNKNOWN",
      confirmedById: params.session.userId,
      reviewedById: params.session.userId,
      reviewNotes: params.evidenceNote,
      reviewedAt: new Date(),
    },
  });

  const updateData: Prisma.CaseUpdateInput = {
    primaryBarrierCategory: params.category,
    primaryBarrierCode: resolvedSubBarrier,
  };
  if (canTransitionCaseStatus(existing.status, CaseStatus.BARRIER_IDENTIFIED)) {
    updateData.status = CaseStatus.BARRIER_IDENTIFIED;
  }

  await prisma.case.update({
    where: { id: existing.id },
    data: updateData,
  });

  await prisma.workflowEvent.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: existing.id,
      eventType: WorkflowEventType.BARRIER_CONFIRMED,
      fromStatus: existing.status,
      toStatus: updateData.status ? CaseStatus.BARRIER_IDENTIFIED : existing.status,
      actorId: params.session.userId,
      actorRole: params.session.role,
      reason: `Human confirmed barrier FACT: ${params.category}/${resolvedSubBarrier}`,
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "BARRIER_CONFIRMED",
    entityType: "Barrier",
    entityId: barrier.id,
    correlationId: params.correlationId,
    summary: `Human confirmed barrier ${params.category}/${resolvedSubBarrier} on case ${existing.id}`,
  });

  return barrier;
}

export async function reviewBarrier(params: {
  session: SessionUser;
  barrierId: string;
  action: "ACCEPT" | "REJECT" | "MODIFY" | "MARK_UNKNOWN";
  category?: BarrierCategory;
  subBarrier?: string;
  notes?: string;
  correlationId?: string;
}) {
  const barrier = await prisma.barrier.findFirst({
    where: { id: params.barrierId, tenantId: params.session.tenantId },
    include: { careCase: true },
  });
  if (!barrier) throw new NotFoundError("Barrier", params.barrierId);

  const now = new Date();
  let updatedBarrier;

  if (params.action === "ACCEPT") {
    const isUnknown = barrier.category === "UNKNOWN";
    updatedBarrier = await prisma.barrier.update({
      where: { id: barrier.id },
      data: {
        epistemicStatus: isUnknown ? "UNKNOWN" : "FACT",
        reviewStatus: "ACCEPTED",
        confirmedByHuman: !isUnknown,
        confirmedById: !isUnknown ? params.session.userId : null,
        reviewedById: params.session.userId,
        reviewNotes: params.notes ?? "Accepted inferred barrier as verified FACT.",
        reviewedAt: now,
      },
    });
    await prisma.case.update({
      where: { id: barrier.caseId },
      data: {
        primaryBarrierCategory: barrier.category,
        primaryBarrierCode: barrier.subBarrier,
      },
    });
  } else if (params.action === "REJECT") {
    updatedBarrier = await prisma.barrier.update({
      where: { id: barrier.id },
      data: {
        reviewStatus: "REJECTED",
        confirmedByHuman: false,
        reviewedById: params.session.userId,
        reviewNotes: params.notes ?? "Rejected inferred barrier due to insufficient evidence.",
        reviewedAt: now,
      },
    });
    await prisma.case.update({
      where: { id: barrier.caseId },
      data: {
        primaryBarrierCategory: BarrierCategory.UNKNOWN,
        primaryBarrierCode: BARRIER_UNKNOWN_LABEL,
        humanReviewRequired: true,
      },
    });
  } else if (params.action === "MARK_UNKNOWN") {
    updatedBarrier = await prisma.barrier.update({
      where: { id: barrier.id },
      data: {
        category: BarrierCategory.UNKNOWN,
        subBarrier: BARRIER_UNKNOWN_LABEL,
        epistemicStatus: "UNKNOWN",
        reviewStatus: "MARKED_UNKNOWN",
        confirmedByHuman: false,
        reviewedById: params.session.userId,
        reviewNotes: params.notes ?? "Marked Barrier unknown — insufficient evidence.",
        reviewedAt: now,
      },
    });
    await prisma.case.update({
      where: { id: barrier.caseId },
      data: {
        primaryBarrierCategory: BarrierCategory.UNKNOWN,
        primaryBarrierCode: BARRIER_UNKNOWN_LABEL,
        humanReviewRequired: true,
      },
    });
  } else {
    if (!params.category || !params.subBarrier) {
      throw new ValidationError("category and subBarrier are required when modifying a barrier");
    }
    const resolvedSub =
      params.category === "UNKNOWN" ? BARRIER_UNKNOWN_LABEL : params.subBarrier;
    updatedBarrier = await prisma.barrier.update({
      where: { id: barrier.id },
      data: {
        category: params.category,
        subBarrier: resolvedSub,
        epistemicStatus: params.category === "UNKNOWN" ? "UNKNOWN" : "FACT",
        reviewStatus: "MODIFIED",
        confirmedByHuman: params.category !== "UNKNOWN",
        confirmedById: params.category !== "UNKNOWN" ? params.session.userId : null,
        reviewedById: params.session.userId,
        reviewNotes: params.notes ?? `Modified to ${params.category} — ${resolvedSub}`,
        reviewedAt: now,
      },
    });
    await prisma.case.update({
      where: { id: barrier.caseId },
      data: {
        primaryBarrierCategory: params.category,
        primaryBarrierCode: resolvedSub,
      },
    });
  }

  await prisma.workflowEvent.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: barrier.caseId,
      eventType: WorkflowEventType.BARRIER_CONFIRMED,
      fromStatus: barrier.careCase.status,
      toStatus: barrier.careCase.status,
      actorId: params.session.userId,
      actorRole: params.session.role,
      reason: `Barrier review ${params.action}: ${updatedBarrier.category}/${updatedBarrier.subBarrier}`,
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: `BARRIER_${params.action}`,
    entityType: "Barrier",
    entityId: barrier.id,
    source: "BARRIER_REVIEW",
    previousState: {
      category: barrier.category,
      subBarrier: barrier.subBarrier,
      epistemicStatus: barrier.epistemicStatus,
    },
    newState: {
      category: updatedBarrier.category,
      subBarrier: updatedBarrier.subBarrier,
      epistemicStatus: updatedBarrier.epistemicStatus,
    },
    correlationId: params.correlationId,
    summary: `Care team ${params.action.toLowerCase()} barrier ${barrier.id} -> ${updatedBarrier.category}/${updatedBarrier.subBarrier} (${updatedBarrier.epistemicStatus})`,
    metadata: {
      previousCategory: barrier.category,
      previousSubBarrier: barrier.subBarrier,
      newCategory: updatedBarrier.category,
      newSubBarrier: updatedBarrier.subBarrier,
      epistemicStatus: updatedBarrier.epistemicStatus,
    },
  });

  return updatedBarrier;
}

export async function reviewIntervention(params: {
  session: SessionUser;
  interventionId: string;
  decision: "APPROVE" | "MODIFY" | "REJECT" | "START" | "COMPLETE" | "FAIL";
  modifiedAction?: string;
  outcome?: string;
  outcomeStatus?: string;
  barriersResolved?: boolean;
  followUpRequired?: boolean;
  notes?: string;
  correlationId?: string;
}) {
  const inv = await prisma.intervention.findFirst({
    where: { id: params.interventionId, tenantId: params.session.tenantId },
    include: { careCase: true, aiRecommendation: true },
  });
  if (!inv) throw new NotFoundError("Intervention", params.interventionId);

  const now = new Date();
  let newStatus: InterventionStatus = inv.status;
  let aiDecision: RecommendationStatus | undefined;
  let eventType: WorkflowEventType = WorkflowEventType.INTERVENTION_APPROVED;

  switch (params.decision) {
    case "APPROVE":
      newStatus = InterventionStatus.APPROVED;
      aiDecision = RecommendationStatus.APPROVED;
      eventType = WorkflowEventType.INTERVENTION_APPROVED;
      break;
    case "MODIFY":
      if (!params.modifiedAction) {
        throw new ValidationError("modifiedAction is required when modifying an intervention");
      }
      newStatus = InterventionStatus.MODIFIED;
      aiDecision = RecommendationStatus.MODIFIED;
      eventType = WorkflowEventType.INTERVENTION_MODIFIED;
      break;
    case "REJECT":
      newStatus = InterventionStatus.REJECTED;
      aiDecision = RecommendationStatus.REJECTED;
      eventType = WorkflowEventType.INTERVENTION_REJECTED;
      break;
    case "START":
      newStatus = InterventionStatus.IN_PROGRESS;
      eventType = WorkflowEventType.STATUS_TRANSITION;
      break;
    case "COMPLETE":
      newStatus = InterventionStatus.COMPLETED;
      eventType = WorkflowEventType.INTERVENTION_COMPLETED;
      break;
    case "FAIL":
      newStatus = InterventionStatus.FAILED;
      eventType = WorkflowEventType.STATUS_TRANSITION;
      break;
  }

  assertInterventionTransition(inv.status, newStatus);

  await prisma.intervention.update({
    where: { id: inv.id },
    data: {
      status: newStatus,
      assignedOwnerId: inv.assignedOwnerId ?? params.session.userId,
      recommendedAction: params.modifiedAction ?? inv.recommendedAction,
      notes: params.notes ?? inv.notes,
      ...(params.decision === "APPROVE" || params.decision === "MODIFY" ? { approvedAt: now } : {}),
      ...(params.decision === "START" ? { startedAt: now } : {}),
      ...(params.decision === "COMPLETE" ? { completedAt: now } : {}),
    },
  });

  if (
    (params.decision === "COMPLETE" || params.decision === "FAIL") &&
    (params.outcome || params.notes)
  ) {
    await prisma.interventionOutcome.create({
      data: {
        tenantId: params.session.tenantId,
        interventionId: inv.id,
        outcomeStatus:
          params.outcomeStatus ?? (params.decision === "COMPLETE" ? "COMPLETED" : "UNRESOLVED"),
        summary:
          params.outcome ??
          params.notes ??
          (params.decision === "COMPLETE"
            ? "Intervention completed by care team."
            : "Intervention marked failed; follow-up needed."),
        barriersResolved: params.barriersResolved ?? params.decision === "COMPLETE",
        followUpRequired: params.followUpRequired ?? params.decision === "FAIL",
        recordedById: params.session.userId,
      },
    });
  }

  if (inv.aiRecommendationId && inv.aiRecommendation && aiDecision) {
    if (inv.aiRecommendation.status === RecommendationStatus.PENDING) {
      assertRecommendationTransition(inv.aiRecommendation.status, aiDecision);
      await prisma.aIRecommendation.update({
        where: { id: inv.aiRecommendationId },
        data: {
          status: aiDecision,
          humanReviewerId: params.session.userId,
          humanReviewNotes: params.notes ?? null,
          reviewedAt: now,
        },
      });
    }
  }

  if (
    (params.decision === "APPROVE" || params.decision === "MODIFY" || params.decision === "START") &&
    canTransitionCaseStatus(inv.careCase.status, CaseStatus.INTERVENTION_IN_PROGRESS)
  ) {
    await prisma.case.update({
      where: { id: inv.caseId },
      data: { status: CaseStatus.INTERVENTION_IN_PROGRESS },
    });
    await prisma.workflowEvent.create({
      data: {
        tenantId: params.session.tenantId,
        caseId: inv.caseId,
        eventType,
        fromStatus: inv.careCase.status,
        toStatus: CaseStatus.INTERVENTION_IN_PROGRESS,
        actorId: params.session.userId,
        actorRole: params.session.role,
        reason: `Intervention ${inv.type} (${inv.executionMode}) ${params.decision.toLowerCase()}`,
      },
    });
  } else {
    await prisma.workflowEvent.create({
      data: {
        tenantId: params.session.tenantId,
        caseId: inv.caseId,
        eventType,
        fromStatus: inv.careCase.status,
        toStatus: inv.careCase.status,
        actorId: params.session.userId,
        actorRole: params.session.role,
        reason: `Intervention ${inv.type} (${inv.executionMode}) -> ${newStatus}`,
      },
    });
  }

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: `INTERVENTION_${params.decision}`,
    entityType: "Intervention",
    entityId: inv.id,
    source: "INTERVENTION_APPROVAL",
    previousState: { status: inv.status, executionMode: inv.executionMode, isHighRisk: inv.isHighRisk },
    newState: { status: newStatus, executionMode: inv.executionMode, isHighRisk: inv.isHighRisk },
    correlationId: params.correlationId,
    summary: `Intervention ${inv.type} (${inv.executionMode}) marked ${newStatus} on case ${inv.caseId}`,
    metadata: {
      executionMode: inv.executionMode,
      isHighRisk: inv.isHighRisk,
      decision: params.decision,
      newStatus,
      barriersResolved: params.barriersResolved,
      followUpRequired: params.followUpRequired,
    },
  });

  return prisma.intervention.findFirstOrThrow({
    where: { id: inv.id, tenantId: params.session.tenantId },
    include: { outcomes: { orderBy: { recordedAt: "desc" } } },
  });
}

export async function executeAutomatedIntervention(params: {
  session: SessionUser;
  interventionId: string;
  correlationId?: string;
}) {
  const inv = await prisma.intervention.findFirst({
    where: { id: params.interventionId, tenantId: params.session.tenantId },
    include: {
      careCase: {
        include: {
          member: true,
          referral: true,
        },
      },
    },
  });
  if (!inv) throw new NotFoundError("Intervention", params.interventionId);

  try {
    assertAutomatedExecutionAllowed({
      status: inv.status,
      executionMode: inv.executionMode,
      automationEligible: inv.automationEligible,
      isHighRisk: inv.isHighRisk,
      caseRiskLevel: inv.careCase.riskLevel,
    });
  } catch (err) {
    await recordAuditEvent({
      tenantId: params.session.tenantId,
      actorId: params.session.userId,
      actorEmail: params.session.email,
      actorRole: params.session.role,
      action: "INTERVENTION_AUTO_EXECUTION_BLOCKED",
      entityType: "Intervention",
      entityId: inv.id,
      correlationId: params.correlationId,
      summary: `Blocked automated execution of ${inv.type} (${inv.executionMode}, highRisk=${inv.isHighRisk || inv.careCase.riskLevel === "HIGH"})`,
      metadata: {
        executionMode: inv.executionMode,
        isHighRisk: inv.isHighRisk,
        caseRiskLevel: inv.careCase.riskLevel,
        reason: err instanceof Error ? err.message : "Policy block",
      },
    });
    throw err;
  }

  const now = new Date();
  let executionSummary = `Automated execution completed for ${inv.type.replaceAll("_", " ")}.`;
  let executionEvidence: Record<string, unknown> = {
    automated: true,
    executedAt: now.toISOString(),
  };

  if (
    inv.type === InterventionType.ALTERNATIVE_PROVIDER_SEARCH ||
    inv.type === InterventionType.LANGUAGE_COMPATIBLE_PROVIDER_SEARCH
  ) {
    const providers = await providerRepository.listWithAvailabilities(params.session.tenantId);
    const ranked = rankProvidersForReferral(
      providers.map((p) => ({ ...p, verifiedSlots: p.availabilities })),
      {
        referralSpecialty: inv.careCase.referral.specialty,
        behavioralHealthNeed: inv.careCase.referral.behavioralHealthNeed,
        referralNetwork: inv.careCase.referral.networkRequired,
        referralGeography: inv.careCase.referral.geography,
        preferredLanguage: inv.careCase.referral.preferredLanguage,
        digitalAccessLevel: inv.careCase.member.digitalAccessLevel,
      }
    );
    const verifiedMatches = ranked.filter((r) => r.availabilityLabel === "VERIFIED AVAILABILITY");
    const topMatch = ranked[0];
    executionSummary = topMatch
      ? `Automated provider search identified ${ranked.length} matches (${verifiedMatches.length} with verified availability). Top candidate: ${topMatch.provider.name} (${topMatch.reasons.slice(0, 3).join(", ")}).`
      : "Automated provider search found 0 matching providers in directory; Care Manager follow-up advised.";
    executionEvidence = {
      ...executionEvidence,
      totalMatches: ranked.length,
      verifiedMatches: verifiedMatches.length,
      topProviderId: topMatch?.provider.id ?? null,
      topProviderName: topMatch?.provider.name ?? null,
    };
  } else if (inv.type === InterventionType.BENEFIT_NETWORK_EXPLANATION) {
    executionSummary = `Automated benefit/network verification compiled for ${inv.careCase.referral.networkRequired} (eligibility: ${inv.careCase.referral.eligibilityVerified}) ready for member delivery via ${inv.careCase.member.preferredContactChannel}.`;
    executionEvidence = {
      ...executionEvidence,
      networkRequired: inv.careCase.referral.networkRequired,
      eligibilityVerified: inv.careCase.referral.eligibilityVerified,
      coverageType: inv.careCase.member.coverageType,
    };
  }

  await prisma.intervention.update({
    where: { id: inv.id },
    data: {
      status: InterventionStatus.COMPLETED,
      autoExecuted: true,
      assignedOwnerId: inv.assignedOwnerId ?? params.session.userId,
      startedAt: inv.startedAt ?? now,
      completedAt: now,
    },
  });

  await prisma.interventionOutcome.create({
    data: {
      tenantId: params.session.tenantId,
      interventionId: inv.id,
      outcomeStatus: "COMPLETED",
      summary: executionSummary,
      barriersResolved: false,
      followUpRequired: true,
      evidence: executionEvidence as Prisma.InputJsonValue,
      recordedById: params.session.userId,
      recordedAt: now,
    },
  });

  if (canTransitionCaseStatus(inv.careCase.status, CaseStatus.INTERVENTION_IN_PROGRESS)) {
    await prisma.case.update({
      where: { id: inv.caseId },
      data: { status: CaseStatus.INTERVENTION_IN_PROGRESS },
    });
  }

  await prisma.workflowEvent.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: inv.caseId,
      eventType: WorkflowEventType.INTERVENTION_COMPLETED,
      fromStatus: inv.careCase.status,
      toStatus: canTransitionCaseStatus(inv.careCase.status, CaseStatus.INTERVENTION_IN_PROGRESS)
        ? CaseStatus.INTERVENTION_IN_PROGRESS
        : inv.careCase.status,
      actorId: params.session.userId,
      actorRole: params.session.role,
      reason: `Automated low-risk intervention ${inv.type} executed cleanly`,
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "INTERVENTION_AUTO_EXECUTED",
    entityType: "Intervention",
    entityId: inv.id,
    correlationId: params.correlationId,
    summary: `Auto-executed ${inv.type} on low/medium-risk case ${inv.caseId}`,
    metadata: executionEvidence,
  });

  return prisma.intervention.findFirstOrThrow({
    where: { id: inv.id, tenantId: params.session.tenantId },
    include: { outcomes: { orderBy: { recordedAt: "desc" } } },
  });
}

export async function recordInterventionOutcome(params: {
  session: SessionUser;
  interventionId: string;
  outcomeStatus: string;
  summary: string;
  barriersResolved: boolean;
  followUpRequired: boolean;
  notes?: string;
  correlationId?: string;
}) {
  const inv = await prisma.intervention.findFirst({
    where: { id: params.interventionId, tenantId: params.session.tenantId },
  });
  if (!inv) throw new NotFoundError("Intervention", params.interventionId);

  const outcome = await prisma.interventionOutcome.create({
    data: {
      tenantId: params.session.tenantId,
      interventionId: inv.id,
      outcomeStatus: params.outcomeStatus,
      summary: params.summary,
      barriersResolved: params.barriersResolved,
      followUpRequired: params.followUpRequired,
      evidence: params.notes ? ({ notes: params.notes } as Prisma.InputJsonValue) : undefined,
      recordedById: params.session.userId,
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "INTERVENTION_OUTCOME_RECORDED",
    entityType: "Intervention",
    entityId: inv.id,
    correlationId: params.correlationId,
    summary: `Outcome '${params.outcomeStatus}' recorded for ${inv.type}: ${params.summary}`,
    metadata: {
      outcomeId: outcome.id,
      outcomeStatus: params.outcomeStatus,
      barriersResolved: params.barriersResolved,
      followUpRequired: params.followUpRequired,
    },
  });

  return outcome;
}

export async function createManualIntervention(params: {
  session: SessionUser;
  caseId: string;
  type: InterventionType;
  reason: string;
  recommendedAction: string;
  triggeringBarrierCategory?: BarrierCategory;
  triggeringBarrierCode?: string;
  correlationId?: string;
}) {
  const careCase = await prisma.case.findFirst({
    where: { id: params.caseId, tenantId: params.session.tenantId },
  });
  if (!careCase) throw new NotFoundError("Case", params.caseId);

  const cat = INTERVENTION_CATALOG[params.type];
  const classification = resolveExecutionClassification({
    type: params.type,
    riskTier: careCase.riskLevel,
  });

  const intervention = await prisma.intervention.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: careCase.id,
      type: params.type,
      reason: params.reason,
      triggeringBarrierCategory: params.triggeringBarrierCategory ?? careCase.primaryBarrierCategory,
      triggeringBarrierCode: params.triggeringBarrierCode ?? careCase.primaryBarrierCode,
      recommendedAction: params.recommendedAction,
      executionMode: classification.executionMode,
      automationEligible: false,
      isHighRisk: classification.isHighRisk,
      confidence: 1.0,
      requiredHumanInvolvement: classification.requiredHumanInvolvement,
      expectedOutcome: cat.expectedOutcome,
      assignedOwnerId: params.session.userId,
      status: InterventionStatus.APPROVED,
      epistemicOrigin: "HUMAN_CREATED",
      approvedAt: new Date(),
    },
  });

  if (canTransitionCaseStatus(careCase.status, CaseStatus.INTERVENTION_IN_PROGRESS)) {
    await prisma.case.update({
      where: { id: careCase.id },
      data: { status: CaseStatus.INTERVENTION_IN_PROGRESS },
    });
    await prisma.workflowEvent.create({
      data: {
        tenantId: params.session.tenantId,
        caseId: careCase.id,
        eventType: WorkflowEventType.STATUS_TRANSITION,
        fromStatus: careCase.status,
        toStatus: CaseStatus.INTERVENTION_IN_PROGRESS,
        actorId: params.session.userId,
        actorRole: params.session.role,
        reason: `Manual intervention ${params.type} initiated by care team`,
      },
    });
  }

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "INTERVENTION_CREATED",
    entityType: "Intervention",
    entityId: intervention.id,
    correlationId: params.correlationId,
    summary: `Created manual intervention ${params.type} (${classification.executionMode}) for case ${careCase.id}`,
  });

  return intervention;
}

export async function generateAndSendOutreach(params: {
  session: SessionUser;
  caseId: string;
  channel: "SMS" | "PHONE" | "EMAIL" | "PORTAL";
  purpose:
    | CommunicationMessageType
    | "INITIAL_OUTREACH"
    | "SCHEDULING_ASSIST"
    | "APPOINTMENT_REMINDER"
    | "MISSED_VISIT_FOLLOWUP"
    | "COVERAGE_CLARIFICATION";
  readingLevel?: ReadingLevel;
  interventionId?: string;
  customMessage?: string;
  sendImmediately?: boolean;
  correlationId?: string;
}) {
  const careCase = await getCaseDetail(params.session.tenantId, params.caseId);
  if (!careCase.member.consentOutreach) {
    throw new ConflictError("Member has opted out of proactive outreach.");
  }

  let verifiedInterventionId: string | null = null;
  if (params.interventionId) {
    const linkedInv = await prisma.intervention.findFirst({
      where: {
        id: params.interventionId,
        caseId: careCase.id,
        tenantId: params.session.tenantId,
      },
      select: { id: true },
    });
    if (!linkedInv) throw new NotFoundError("Intervention", params.interventionId);
    verifiedInterventionId = linkedInv.id;
  }

  const normalizedType = normalizeCommunicationMessageType(params.purpose);
  const readingLevel = params.readingLevel ?? ReadingLevel.PLAIN;

  const commInput = {
    memberFirstName: careCase.member.firstName,
    preferredLanguage: careCase.member.preferredLanguage,
    channel: params.channel,
    purpose: normalizedType,
    readingLevel,
    specialty: careCase.referral.specialty,
    networkRequired: careCase.referral.networkRequired,
    providerName: careCase.matchedProvider?.name ?? null,
    appointmentDateText: careCase.appointments[0]
      ? new Date(careCase.appointments[0].scheduledStartAt).toLocaleString()
      : null,
  };
  const ai = getAIProvider();
  const draft = enforceCommunicationPolicy(
    await ai.generateMemberCommunication(commInput),
    {
      consentSms: careCase.member.consentSms,
      consentOutreach: careCase.member.consentOutreach,
    }
  );

  const isCustom = Boolean(params.customMessage?.trim());
  const messageText = params.customMessage?.trim() || draft.draftMessage;

  // Validate final content (including any human-edited customMessage) before delivery or persistence
  validateOutboundCommunication({
    body: messageText,
    subject: draft.subject,
    channel: params.channel,
    consentOutreach: careCase.member.consentOutreach,
    consentSms: careCase.member.consentSms,
    requireConsentForDelivery: params.sendImmediately ?? false,
  });

  const aiRec = await prisma.aIRecommendation.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: careCase.id,
      referralId: careCase.referralId,
      operation: AIOperation.GENERATE_COMMUNICATION,
      status: params.sendImmediately ? RecommendationStatus.APPROVED : RecommendationStatus.PENDING,
      providerName: draft.providerName,
      modelVersion: draft.modelVersion,
      promptVersion: draft.promptVersion ?? getPromptTemplate("GENERATE_COMMUNICATION").version,
      inputContext: {
        caseId: careCase.id,
        channel: params.channel,
        messageType: normalizedType,
        readingLevel,
        language: careCase.member.preferredLanguage,
      } as Prisma.InputJsonValue,
      outputPayload: draft as unknown as Prisma.InputJsonValue,
      resultingAction: params.sendImmediately ? "COMMUNICATION_SENT" : "COMMUNICATION_DRAFTED",
      facts: draft.facts as Prisma.InputJsonValue,
      inferences: draft.inferences as Prisma.InputJsonValue,
      recommendations: draft.recommendations as Prisma.InputJsonValue,
      confidence: draft.confidence,
      uncertainty: draft.uncertainty,
      evidenceSignals: draft.evidenceSignals as Prisma.InputJsonValue,
      humanReviewerId: params.sendImmediately ? params.session.userId : null,
      reviewedAt: params.sendImmediately ? new Date() : null,
      correlationId: params.correlationId,
    },
  });

  let deliveryStatus: DeliveryStatus = DeliveryStatus.DRAFT;
  let deliveryMode = "MOCK";
  let externalMessageId: string | null = null;
  let sentAt: Date | null = null;

  if (params.sendImmediately) {
    const dispatch = await commAdapter.sendMessage({
      channel: params.channel,
      language: careCase.member.preferredLanguage,
      subject: draft.subject,
      messageBody: messageText,
      consentVerified: params.channel === "SMS" ? careCase.member.consentSms : careCase.member.consentOutreach,
    });
    deliveryStatus = dispatch.deliveryStatus as DeliveryStatus;
    deliveryMode = dispatch.deliveryMode;
    externalMessageId = dispatch.externalMessageId ?? null;
    if (dispatch.dispatched) sentAt = new Date();
  }

  const consentRecord = careCase.member.consents.find(
    (c) => c.channel === (params.channel as CommunicationChannel) && c.granted
  );
  const recipientLabel = `${careCase.member.firstName} ${careCase.member.lastName} (${careCase.member.externalMemberId})`;
  const internalAiLabel = isCustom ? "HUMAN_AUTHORED" : "AI_GENERATED";

  const attempt = await prisma.communication.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: careCase.id,
      memberId: careCase.memberId,
      interventionId: verifiedInterventionId,
      consentId: consentRecord?.id ?? null,
      channel: params.channel as CommunicationChannel,
      messageType: normalizedType,
      templateKey: draft.templateKey,
      recipient: recipientLabel,
      direction: "OUTBOUND",
      language: careCase.member.preferredLanguage,
      readingLevel,
      draftedByAi: !isCustom,
      internalAiLabel,
      aiRecommendationId: aiRec.id,
      humanApprovedById: params.sendImmediately ? params.session.userId : null,
      content: messageText,
      messageSummary: `${normalizedType} (${readingLevel}) via ${params.channel} (${careCase.member.preferredLanguage})`,
      deliveryStatus,
      deliveryMode,
      validationPassed: true,
      externalMessageId,
      sentAt,
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: params.sendImmediately ? "COMMUNICATION_SENT" : "COMMUNICATION_DRAFTED",
    entityType: "Communication",
    entityId: attempt.id,
    correlationId: params.correlationId,
    summary: `Communication ${deliveryStatus} (${deliveryMode}) [${internalAiLabel}] ${normalizedType} via ${params.channel} for case ${careCase.id}`,
    metadata: {
      messageType: normalizedType,
      templateKey: draft.templateKey,
      readingLevel,
      internalAiLabel,
      deliveryMode,
      interventionId: verifiedInterventionId,
    },
  });

  return { attempt, draftMessage: messageText, trace: aiRec };
}

export async function scheduleAppointmentForCase(params: {
  session: SessionUser;
  caseId: string;
  providerId: string;
  slotId?: string;
  scheduledStartAt: Date;
  modality: "IN_PERSON" | "TELEHEALTH";
  initialStatus?: "REQUESTED" | "SCHEDULED";
  correlationId?: string;
}) {
  const careCase = await prisma.case.findFirst({
    where: { id: params.caseId, tenantId: params.session.tenantId },
    include: { member: true, referral: true },
  });
  if (!careCase) throw new NotFoundError("Case", params.caseId);

  const provider = await prisma.provider.findFirst({
    where: { id: params.providerId, tenantId: params.session.tenantId },
  });
  if (!provider) throw new NotFoundError("Provider", params.providerId);

  if (
    (!provider.acceptingNewPatients || provider.availabilitySource === "NOT_AVAILABLE") &&
    !params.slotId
  ) {
    throw new ValidationError(
      `Provider '${provider.name}' is currently NOT_AVAILABLE / not accepting new patients and cannot be scheduled.`
    );
  }

  let availabilitySource = provider.availabilitySource;

  if (params.slotId) {
    const slot = await providerRepository.reserveAvailability(
      params.session.tenantId,
      provider.id,
      params.slotId
    );
    availabilitySource = slot.source;
  }

  const bookingResp = await schedAdapter.bookSlot({
    providerNpi: provider.npi,
    memberExternalId: careCase.member.externalMemberId,
    slotStartAt: params.scheduledStartAt,
    modality: params.modality,
    source: availabilitySource === "VERIFIED_AVAILABILITY" ? "VERIFIED_AVAILABILITY" : "DIRECTORY_INFORMATION",
  });

  const resolvedApptStatus: AppointmentStatus =
    params.initialStatus === "REQUESTED"
      ? AppointmentStatus.REQUESTED
      : AppointmentStatus.SCHEDULED;

  const appointment = await prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.create({
      data: {
        tenantId: params.session.tenantId,
        caseId: careCase.id,
        memberId: careCase.memberId,
        providerId: provider.id,
        scheduledStartAt: params.scheduledStartAt,
        modality: params.modality,
        status: resolvedApptStatus,
        availabilitySourceAtBooking: availabilitySource,
      },
      include: { provider: true },
    });

    await tx.completionVerification.create({
      data: {
        tenantId: params.session.tenantId,
        caseId: careCase.id,
        appointmentId: appt.id,
        signalType: VerificationSignalType.APPOINTMENT_SCHEDULED,
        verified: true,
        verificationStatus: VerificationStatus.VERIFIED,
        confidence: 0.0,
        sourceSystem: "CARELOOP_SCHEDULING",
        evidenceNote: `${bookingResp.note} (Scheduling only — NOT care completion)`,
        verifiedById: params.session.userId,
      },
    });

    if (canTransitionCaseStatus(careCase.status, CaseStatus.APPOINTMENT_SCHEDULED)) {
      await tx.case.update({
        where: { id: careCase.id },
        data: {
          status: CaseStatus.APPOINTMENT_SCHEDULED,
          matchedProviderId: provider.id,
        },
      });
      await tx.workflowEvent.create({
        data: {
          tenantId: params.session.tenantId,
          caseId: careCase.id,
          eventType: WorkflowEventType.APPOINTMENT_SCHEDULED,
          fromStatus: careCase.status,
          toStatus: CaseStatus.APPOINTMENT_SCHEDULED,
          actorId: params.session.userId,
          actorRole: params.session.role,
          reason: `${resolvedApptStatus} ${params.modality} appointment with ${provider.name} (${availabilitySource})`,
        },
      });
    } else {
      await tx.case.update({
        where: { id: careCase.id },
        data: { matchedProviderId: provider.id },
      });
    }

    if (canTransitionReferralStatus(careCase.referral.status, ReferralStatus.APPOINTMENT_SCHEDULED)) {
      await tx.referral.update({
        where: { id: careCase.referralId },
        data: { status: ReferralStatus.APPOINTMENT_SCHEDULED },
      });
    }

    return appt;
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: `APPOINTMENT_${resolvedApptStatus}`,
    entityType: "Appointment",
    entityId: appointment.id,
    correlationId: params.correlationId,
    summary: `Appointment ${resolvedApptStatus} with ${provider.name} (${availabilitySource}) for case ${careCase.id}`,
  });

  return appointment;
}

export async function updateAppointmentStatus(params: {
  session: SessionUser;
  appointmentId: string;
  action:
    | "SEND_REMINDER"
    | "SCHEDULE"
    | "CONFIRM"
    | "RESCHEDULE"
    | "COMPLETE"
    | "NO_SHOW"
    | "CANCEL"
    | "MARK_UNKNOWN";
  channel?: "SMS" | "PHONE" | "EMAIL" | "PORTAL";
  rescheduledStartAt?: Date;
  modality?: "IN_PERSON" | "TELEHEALTH";
  slotId?: string;
  note?: string;
  correlationId?: string;
}) {
  const appt = await prisma.appointment.findFirst({
    where: { id: params.appointmentId, tenantId: params.session.tenantId },
    include: { careCase: true, provider: true, member: true },
  });
  if (!appt) throw new NotFoundError("Appointment", params.appointmentId);

  const now = new Date();
  let newApptStatus = appt.status;
  let newCaseStatus: CaseStatus | null = null;
  let signalType: VerificationSignalType | null = null;
  let signalConfidence = 0.0;
  let eventType: WorkflowEventType = WorkflowEventType.STATUS_TRANSITION;

  switch (params.action) {
    case "SEND_REMINDER": {
      const requestedChannel =
        params.channel ??
        ((appt.member.consentSms ? "SMS" : "PHONE") as "SMS" | "PHONE" | "EMAIL" | "PORTAL");
      const consentOk =
        requestedChannel === "PORTAL"
          ? true
          : requestedChannel === "SMS"
            ? appt.member.consentSms && appt.member.consentOutreach
            : appt.member.consentOutreach;

      const messageBody = `Appointment reminder: ${appt.provider.name} on ${appt.scheduledStartAt.toLocaleString()} (${appt.modality}).`;
      const dispatch = await commAdapter.sendMessage({
        channel: requestedChannel,
        language: appt.member.preferredLanguage,
        subject: "Appointment Reminder",
        messageBody,
        consentVerified: consentOk,
      });
      if (!dispatch.dispatched) {
        throw new ValidationError(dispatch.reason ?? "Reminder blocked due to missing member consent.");
      }

      await prisma.appointment.update({
        where: { id: appt.id },
        data: {
          reminderSentAt: now,
          reminderChannel: requestedChannel,
        },
      });
      await prisma.communication.create({
        data: {
          tenantId: params.session.tenantId,
          caseId: appt.caseId,
          memberId: appt.memberId,
          channel: requestedChannel as CommunicationChannel,
          messageType: CommunicationMessageType.APPOINTMENT_REMINDER,
          templateKey: "appointment_reminder.plain",
          recipient: `${appt.member.firstName} ${appt.member.lastName} (${appt.member.externalMemberId})`,
          direction: "OUTBOUND",
          language: appt.member.preferredLanguage,
          readingLevel: ReadingLevel.PLAIN,
          draftedByAi: false,
          internalAiLabel: "HUMAN_AUTHORED",
          content: messageBody,
          messageSummary: messageBody,
          deliveryStatus: dispatch.deliveryStatus as DeliveryStatus,
          deliveryMode: dispatch.deliveryMode,
          validationPassed: true,
          externalMessageId: dispatch.externalMessageId ?? null,
          sentAt: now,
        },
      });
      await prisma.notification.create({
        data: {
          tenantId: params.session.tenantId,
          caseId: appt.caseId,
          appointmentId: appt.id,
          channel: requestedChannel,
          notificationType: "APPOINTMENT_REMINDER",
          title: "Appointment Reminder Sent",
          message: `Reminder sent for ${appt.provider.name} appointment via ${requestedChannel}.`,
          status: NotificationStatus.SENT,
          sentAt: now,
        },
      });
      await recordAuditEvent({
        tenantId: params.session.tenantId,
        actorId: params.session.userId,
        actorEmail: params.session.email,
        actorRole: params.session.role,
        action: "APPOINTMENT_REMINDER_SENT",
        entityType: "Appointment",
        entityId: appt.id,
        correlationId: params.correlationId,
        summary: `Reminder dispatched via ${requestedChannel} for appointment ${appt.id}`,
      });
      return prisma.appointment.findUnique({ where: { id: appt.id }, include: { provider: true } });
    }

    case "SCHEDULE":
      newApptStatus = AppointmentStatus.SCHEDULED;
      newCaseStatus = CaseStatus.APPOINTMENT_SCHEDULED;
      signalType = VerificationSignalType.APPOINTMENT_SCHEDULED;
      signalConfidence = 0.0;
      eventType = WorkflowEventType.APPOINTMENT_SCHEDULED;
      break;
    case "CONFIRM":
      newApptStatus = AppointmentStatus.CONFIRMED;
      newCaseStatus = CaseStatus.APPOINTMENT_CONFIRMED;
      signalType = VerificationSignalType.APPOINTMENT_CONFIRMED;
      signalConfidence = 0.0;
      eventType = WorkflowEventType.APPOINTMENT_CONFIRMED;
      break;
    case "RESCHEDULE":
      newApptStatus = AppointmentStatus.RESCHEDULED;
      newCaseStatus = CaseStatus.APPOINTMENT_SCHEDULED;
      eventType = WorkflowEventType.STATUS_TRANSITION;
      break;
    case "COMPLETE":
      newApptStatus = AppointmentStatus.COMPLETED;
      newCaseStatus = CaseStatus.APPOINTMENT_COMPLETED;
      signalType = VerificationSignalType.APPOINTMENT_COMPLETED;
      signalConfidence = 0.92;
      eventType = WorkflowEventType.APPOINTMENT_COMPLETED;
      break;
    case "NO_SHOW":
      newApptStatus = AppointmentStatus.NO_SHOW;
      newCaseStatus = CaseStatus.REQUIRES_HUMAN_REVIEW;
      eventType = WorkflowEventType.APPOINTMENT_NO_SHOW;
      break;
    case "CANCEL":
      newApptStatus = AppointmentStatus.CANCELLED;
      newCaseStatus = CaseStatus.INTERVENTION_IN_PROGRESS;
      eventType = WorkflowEventType.STATUS_TRANSITION;
      break;
    case "MARK_UNKNOWN":
      newApptStatus = AppointmentStatus.UNKNOWN;
      newCaseStatus = CaseStatus.REQUIRES_HUMAN_REVIEW;
      eventType = WorkflowEventType.STATUS_TRANSITION;
      break;
  }

  assertAppointmentTransition(appt.status, newApptStatus);

  let replacementSlotSource = appt.provider.availabilitySource;
  if (params.action === "RESCHEDULE" && params.slotId) {
    const slot = await providerRepository.reserveAvailability(
      params.session.tenantId,
      appt.providerId,
      params.slotId
    );
    replacementSlotSource = slot.source;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const a = await tx.appointment.update({
      where: { id: appt.id },
      data: {
        status: newApptStatus,
        ...(params.action === "CONFIRM" ? { confirmedAt: now } : {}),
        ...(params.action === "COMPLETE" ? { completedAt: now } : {}),
        ...(params.action === "CANCEL" || params.action === "RESCHEDULE"
          ? { cancellationReason: params.note ?? `Marked ${newApptStatus}` }
          : {}),
      },
      include: { provider: true },
    });

    if (params.action === "RESCHEDULE" && params.rescheduledStartAt) {
      await tx.appointment.create({
        data: {
          tenantId: params.session.tenantId,
          caseId: appt.caseId,
          memberId: appt.memberId,
          providerId: appt.providerId,
          scheduledStartAt: params.rescheduledStartAt,
          modality: params.modality ?? appt.modality,
          status: AppointmentStatus.SCHEDULED,
          availabilitySourceAtBooking: replacementSlotSource,
        },
      });
    }

    if (params.action === "NO_SHOW") {
      await tx.member.update({
        where: { id: appt.memberId },
        data: { priorNoShowCount: { increment: 1 } },
      });
    }

    if (signalType) {
      await tx.completionVerification.create({
        data: {
          tenantId: params.session.tenantId,
          caseId: appt.caseId,
          appointmentId: appt.id,
          signalType,
          verified: true,
          verificationStatus: VerificationStatus.VERIFIED,
          confidence: signalConfidence,
          sourceSystem: "CARELOOP_APPOINTMENT_WORKFLOW",
          evidenceNote: params.note ?? `Appointment marked ${newApptStatus}`,
          verifiedById: params.session.userId,
          verifiedAt: now,
        },
      });
    }

    if (newCaseStatus && canTransitionCaseStatus(appt.careCase.status, newCaseStatus)) {
      await tx.case.update({
        where: { id: appt.caseId },
        data: {
          status: newCaseStatus,
          ...(params.action === "NO_SHOW" || params.action === "MARK_UNKNOWN"
            ? { humanReviewRequired: true }
            : {}),
          ...(params.action === "COMPLETE" && !appt.careCase.firstCompletedVisitAt
            ? { firstCompletedVisitAt: now }
            : {}),
        },
      });
      await tx.workflowEvent.create({
        data: {
          tenantId: params.session.tenantId,
          caseId: appt.caseId,
          eventType,
          fromStatus: appt.careCase.status,
          toStatus: newCaseStatus,
          actorId: params.session.userId,
          actorRole: params.session.role,
          reason: params.note ?? `Appointment ${params.action.toLowerCase()}`,
        },
      });
    }

    return a;
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: `APPOINTMENT_${params.action}`,
    entityType: "Appointment",
    entityId: appt.id,
    source: "APPOINTMENT_WORKFLOW",
    previousState: { status: appt.status, caseStatus: appt.careCase.status },
    newState: { status: newApptStatus, caseStatus: updated.status === newApptStatus && newCaseStatus ? newCaseStatus : appt.careCase.status },
    correlationId: params.correlationId,
    summary: `Appointment ${appt.id} transitioned to ${newApptStatus}`,
  });

  return updated;
}

export async function recordCompletionVerification(params: {
  session: SessionUser;
  caseId: string;
  appointmentId?: string;
  signalType: VerificationSignalType;
  sourceSystem: string;
  evidenceNote: string;
  verificationStatus?: VerificationStatus;
  confidence?: number;
  evidenceTimestamp?: Date;
  closeCaseAfterVerify?: boolean;
  verificationRules?: Partial<VerificationRulesConfig>;
  correlationId?: string;
}) {
  const [careCase, tenant, existingVerifications] = await Promise.all([
    prisma.case.findFirst({
      where: { id: params.caseId, tenantId: params.session.tenantId },
    }),
    prisma.tenant.findUnique({
      where: { id: params.session.tenantId },
      select: { settings: true },
    }),
    prisma.completionVerification.findMany({
      where: {
        caseId: params.caseId,
        tenantId: params.session.tenantId,
        verified: true,
        verificationStatus: VerificationStatus.VERIFIED,
      },
      select: { signalType: true, sourceSystem: true },
    }),
  ]);
  if (!careCase) throw new NotFoundError("Case", params.caseId);

  const rules = resolveVerificationRules(tenant?.settings, params.verificationRules);
  const evidenceTime = params.evidenceTimestamp ?? new Date();
  const evalResult = evaluateVerificationSignal({
    signalType: params.signalType,
    verificationStatus: params.verificationStatus,
    confidence: params.confidence,
    sourceSystem: params.sourceSystem,
    rules,
    existingVerifiedSources: existingVerifications,
  });

  const verification = await prisma.$transaction(async (tx) => {
    const v = await tx.completionVerification.create({
      data: {
        tenantId: params.session.tenantId,
        caseId: careCase.id,
        appointmentId: params.appointmentId ?? null,
        signalType: params.signalType,
        verified: evalResult.resolvedStatus === VerificationStatus.VERIFIED,
        verificationStatus: evalResult.resolvedStatus,
        confidence: evalResult.resolvedConfidence,
        sourceSystem: params.sourceSystem,
        evidenceNote: params.evidenceNote,
        verifiedById: params.session.userId,
        verifiedAt: evidenceTime,
      },
      include: {
        verifiedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (evalResult.provesCareCompleted) {
      if (params.appointmentId) {
        const appt = await tx.appointment.findFirst({
          where: { id: params.appointmentId, caseId: careCase.id, tenantId: params.session.tenantId },
        });
        if (appt && canTransitionAppointmentStatus(appt.status, AppointmentStatus.COMPLETED)) {
          await tx.appointment.update({
            where: { id: appt.id },
            data: { status: AppointmentStatus.COMPLETED, completedAt: evidenceTime },
          });
        }
      }

      let currentStatus = careCase.status;

      // Advance cleanly through APPOINTMENT_COMPLETED -> VERIFIED -> CLOSED if case is currently scheduled/confirmed
      if (
        (currentStatus === CaseStatus.APPOINTMENT_SCHEDULED ||
          currentStatus === CaseStatus.APPOINTMENT_CONFIRMED) &&
        canTransitionCaseStatus(currentStatus, CaseStatus.APPOINTMENT_COMPLETED)
      ) {
        await tx.workflowEvent.create({
          data: {
            tenantId: params.session.tenantId,
            caseId: careCase.id,
            eventType: WorkflowEventType.APPOINTMENT_COMPLETED,
            fromStatus: currentStatus,
            toStatus: CaseStatus.APPOINTMENT_COMPLETED,
            actorId: params.session.userId,
            actorRole: params.session.role,
            reason: `Visit completed evidenced by ${params.signalType} (${params.sourceSystem})`,
          },
        });
        currentStatus = CaseStatus.APPOINTMENT_COMPLETED;
      }

      if (canTransitionCaseStatus(currentStatus, CaseStatus.VERIFIED)) {
        await tx.workflowEvent.create({
          data: {
            tenantId: params.session.tenantId,
            caseId: careCase.id,
            eventType: WorkflowEventType.COMPLETION_VERIFIED,
            fromStatus: currentStatus,
            toStatus: CaseStatus.VERIFIED,
            actorId: params.session.userId,
            actorRole: params.session.role,
            reason: `Completion verified via ${params.signalType} (${params.sourceSystem})`,
          },
        });
        currentStatus = CaseStatus.VERIFIED;
      }

      if (params.closeCaseAfterVerify && currentStatus === CaseStatus.VERIFIED) {
        await tx.workflowEvent.create({
          data: {
            tenantId: params.session.tenantId,
            caseId: careCase.id,
            eventType: WorkflowEventType.CASE_CLOSED,
            fromStatus: CaseStatus.VERIFIED,
            toStatus: CaseStatus.CLOSED,
            actorId: params.session.userId,
            actorRole: params.session.role,
            reason: "Case closed after verified visit completion",
          },
        });
        currentStatus = CaseStatus.CLOSED;
      }

      await tx.case.update({
        where: { id: careCase.id },
        data: {
          firstCompletedVisitAt: careCase.firstCompletedVisitAt ?? evidenceTime,
          status: currentStatus,
          ...(currentStatus === CaseStatus.CLOSED
            ? { closedAt: evidenceTime, closureReason: "First behavioral-health visit verified" }
            : {}),
        },
      });

      await tx.referral.update({
        where: { id: careCase.referralId },
        data: { status: ReferralStatus.COMPLETED },
      });
    }

    return v;
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: evalResult.provesCareCompleted ? "COMPLETION_VERIFIED" : "VERIFICATION_SIGNAL_LOGGED",
    entityType: "CompletionVerification",
    entityId: verification.id,
    correlationId: params.correlationId,
    summary: `Recorded verification signal ${params.signalType} (${evalResult.resolvedStatus}, conf ${Math.round(
      evalResult.resolvedConfidence * 100
    )}%) from ${params.sourceSystem} on case ${careCase.id}`,
    metadata: {
      signalType: params.signalType,
      verificationStatus: evalResult.resolvedStatus,
      confidence: evalResult.resolvedConfidence,
      provesCareCompleted: evalResult.provesCareCompleted,
    },
  });

  return verification;
}

export async function addCaseNote(params: {
  session: SessionUser;
  caseId: string;
  category: string;
  content: string;
  correlationId?: string;
}) {
  const existing = await prisma.case.findFirst({
    where: { id: params.caseId, tenantId: params.session.tenantId },
  });
  if (!existing) throw new NotFoundError("Case", params.caseId);

  const note = await prisma.caseNote.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: existing.id,
      authorId: params.session.userId,
      category: params.category,
      content: params.content,
    },
    include: {
      author: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "CASE_NOTE_ADDED",
    entityType: "CaseNote",
    entityId: note.id,
    correlationId: params.correlationId,
    summary: `Added ${params.category} case note on case ${existing.id}`,
    metadata: { caseId: existing.id, category: params.category },
  });

  return note;
}

/**
 * Care Manager Workbench: add human-verified evidence to a case (audited).
 */
export async function addCaseEvidence(params: {
  session: SessionUser;
  caseId: string;
  sourceType: string;
  summary: string;
  payload?: Record<string, unknown>;
  correlationId?: string;
}) {
  const existing = await prisma.case.findFirst({
    where: { id: params.caseId, tenantId: params.session.tenantId },
  });
  if (!existing) throw new NotFoundError("Case", params.caseId);

  const payload = params.payload ?? { summary: params.summary, sourceType: params.sourceType };
  const payloadHash = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");

  const evidence = await prisma.evidence.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: existing.id,
      sourceType: params.sourceType,
      summary: params.summary,
      payloadHash,
      payload: payload as Prisma.InputJsonValue,
      capturedBy: params.session.email,
      capturedAt: new Date(),
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "HUMAN_EVIDENCE_ADDED",
    entityType: "Evidence",
    entityId: evidence.id,
    correlationId: params.correlationId,
    summary: `Care Manager added ${params.sourceType} evidence on case ${existing.id}`,
    metadata: { caseId: existing.id, sourceType: params.sourceType, payloadHash },
  });

  return evidence;
}

/**
 * Care Manager Workbench: override an AI recommendation / next-best-action (audited).
 */
export async function overrideAgentRecommendation(params: {
  session: SessionUser;
  caseId: string;
  recommendationId?: string;
  overrideAction: string;
  rationale: string;
  correlationId?: string;
}) {
  const existing = await prisma.case.findFirst({
    where: { id: params.caseId, tenantId: params.session.tenantId },
  });
  if (!existing) throw new NotFoundError("Case", params.caseId);

  let targetRecId = params.recommendationId;
  if (targetRecId) {
    await prisma.aIRecommendation.updateMany({
      where: {
        id: targetRecId,
        caseId: existing.id,
        tenantId: params.session.tenantId,
      },
      data: {
        status: RecommendationStatus.MODIFIED,
        resultingAction: `HUMAN_OVERRIDE: ${params.overrideAction}`,
        humanReviewerId: params.session.userId,
        reviewedAt: new Date(),
      },
    });
  } else {
    const latestRec = await prisma.aIRecommendation.findFirst({
      where: { caseId: existing.id, tenantId: params.session.tenantId },
      orderBy: { createdAt: "desc" },
    });
    if (latestRec) {
      targetRecId = latestRec.id;
      await prisma.aIRecommendation.update({
        where: { id: latestRec.id },
        data: {
          status: RecommendationStatus.MODIFIED,
          resultingAction: `HUMAN_OVERRIDE: ${params.overrideAction}`,
          humanReviewerId: params.session.userId,
          reviewedAt: new Date(),
        },
      });
    }
  }

  const note = await prisma.caseNote.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: existing.id,
      authorId: params.session.userId,
      category: "COORDINATION",
      content: `[Human Override — ${params.overrideAction}]: ${params.rationale}`,
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "HUMAN_OVERRIDE_RECORDED",
    entityType: targetRecId ? "AIRecommendation" : "Case",
    entityId: targetRecId ?? existing.id,
    correlationId: params.correlationId,
    summary: `Care Manager overrode agent recommendation on case ${existing.id}: ${params.overrideAction}`,
    metadata: {
      caseId: existing.id,
      recommendationId: targetRecId ?? null,
      overrideAction: params.overrideAction,
      rationale: params.rationale,
      caseNoteId: note.id,
    },
  });

  return { overridden: true, recommendationId: targetRecId ?? null, note };
}
