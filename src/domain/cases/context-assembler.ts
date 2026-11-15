import { createHash } from "crypto";
import { CaseStatus } from "@prisma/client";
import { sanitizeAuditText } from "@/lib/logger";
import { buildCaseGoal } from "./state-machine";

export const CASE_CONTEXT_VERSION = "careloop.case_context.v1";

export interface MemberContext {
  preferredLanguage: string;
  urbanicity: string;
  preferredChannel: string;
  digitalAccessLevel: string;
  transportationAccess: string;
  consentOutreach: boolean;
  consentSms: boolean;
  priorNoShowCount: number;
}

export interface ReferralContext {
  specialty: string;
  behavioralHealthNeed: string;
  urgency: string;
  networkRequired: string;
  eligibilityVerified: string;
  matchedProviderId: string | null;
  verifiedAvailableSlotsCount: number;
}

export interface BarrierContextItem {
  category: string;
  subBarrier: string;
  epistemicStatus: string;
  confirmedByHuman: boolean;
  resolved: boolean;
  confidence: number | null;
  relevanceScore: number;
  evidenceRefs: string[];
}

export type BarrierContext = BarrierContextItem[];

export interface ActionHistoryItem {
  type: string;
  status: string;
  outcome: string | null;
  timestamp: string;
  relevanceScore: number;
}

export type ActionHistory = ActionHistoryItem[];

export interface EvidenceReference {
  refId: string;
  sourceType: string;
  verified: boolean;
  timestamp: string;
  summary: string;
}

export interface EvidenceContext {
  hasRiskAssessment: boolean;
  hasScheduledAppointment: boolean;
  hasConfirmedAppointment: boolean;
  hasCompletedAppointment: boolean;
  hasVerifiedVisit: boolean;
  evidenceRefs: EvidenceReference[];
}

export interface HumanTaskContext {
  pendingBarrierConfirmations: number;
  pendingInterventionApprovals: number;
  openEscalations: number;
  awaitingCompletionVerification: boolean;
}

export interface PolicyContext {
  riskTier: string;
  priorityScore: number;
  consentOutreach: boolean;
  consentSms: boolean;
  humanReviewRequired: boolean;
}

export interface CaseContext {
  contextVersion: string;
  contextHash: string;
  caseId: string;
  goal: string;
  currentState: CaseStatus;
  member: MemberContext;
  referral: ReferralContext;
  barriers: BarrierContext;
  actionHistory: ActionHistory;
  evidence: EvidenceContext;
  humanTasks: HumanTaskContext;
  policy: PolicyContext;
}

export interface ContextAssemblerSource {
  id: string;
  goal?: string | null;
  status: CaseStatus;
  riskLevel?: string | null;
  priorityScore?: number | null;
  humanReviewRequired?: boolean;
  matchedProviderId?: string | null;
  firstCompletedVisitAt?: Date | string | null;
  // Direct PHI fields intentionally ignored (never forwarded to LLM context)
  member: {
    firstName?: string;
    lastName?: string;
    email?: string | null;
    phone?: string | null;
    dob?: Date | string | null;
    ssn?: string | null;
    preferredLanguage: string;
    urbanicity: string;
    preferredContactChannel?: string;
    digitalAccessLevel: string;
    transportationAccess: string;
    consentOutreach: boolean;
    consentSms: boolean;
    priorNoShowCount: number;
  };
  referral: {
    behavioralHealthNeed: string;
    specialty: string;
    urgency: string;
    networkRequired: string;
    eligibilityVerified: string;
  };
  verifiedAvailableSlotsCount?: number;
  riskAssessments?: Array<{ riskLevel: string; score: number }>;
  barriers?: Array<{
    id?: string;
    category: string;
    subBarrier: string;
    epistemicStatus: string;
    confirmedByHuman: boolean;
    resolved: boolean;
    confidence?: number | null;
    evidenceSignals?: unknown;
  }>;
  interventions?: Array<{
    id?: string;
    type: string;
    status: string;
    createdAt?: Date | string;
    outcomes?: Array<{ outcomeStatus: string }>;
  }>;
  appointments?: Array<{
    id: string;
    status: string;
    scheduledStartAt?: Date | string;
  }>;
  verifications?: Array<{
    id: string;
    signalType?: string;
    verified: boolean;
    verificationStatus?: string;
    verifiedAt?: Date | string | null;
  }>;
}

export interface AssembleCaseContextOptions {
  maxBarriers?: number;
  maxActions?: number;
  maxEvidenceRefs?: number;
  includeResolvedBarriers?: boolean;
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function scoreBarrierRelevance(b: NonNullable<ContextAssemblerSource["barriers"]>[number]): number {
  let score = 0;
  if (!b.resolved) score += 50;
  if (b.confirmedByHuman || b.epistemicStatus === "FACT") score += 25;
  if (typeof b.confidence === "number") score += Math.round(b.confidence * 20);
  if (b.category === "UNKNOWN") score += 10;
  return score;
}

function scoreActionRelevance(
  i: NonNullable<ContextAssemblerSource["interventions"]>[number]
): number {
  let score = 10;
  if (i.status === "RECOMMENDED" || i.status === "IN_PROGRESS") score += 40;
  if (i.status === "FAILED") score += 30;
  const ts = i.createdAt ? new Date(i.createdAt).getTime() : 0;
  if (ts > 0) score += Math.min(20, Math.floor(ts / 1e11));
  return score;
}

export class CaseContextAssembler {
  assemble(
    source: ContextAssemblerSource,
    options: AssembleCaseContextOptions = {}
  ): CaseContext {
    const maxBarriers = options.maxBarriers ?? 5;
    const maxActions = options.maxActions ?? 8;
    const maxEvidenceRefs = options.maxEvidenceRefs ?? 8;
    const includeResolvedBarriers = options.includeResolvedBarriers ?? false;

    const rawBarriers = source.barriers ?? [];
    const filteredBarriers = includeResolvedBarriers
      ? rawBarriers
      : rawBarriers.filter((b) => !b.resolved);

    const rankedBarriers: BarrierContext = filteredBarriers
      .map((b) => {
        const signals = Array.isArray(b.evidenceSignals)
          ? b.evidenceSignals
              .filter((s): s is string => typeof s === "string")
              .slice(0, 4)
              .map((s) => sanitizeAuditText(s))
          : [];
        return {
          category: b.category,
          subBarrier: sanitizeAuditText(b.subBarrier),
          epistemicStatus: b.epistemicStatus,
          confirmedByHuman: b.confirmedByHuman,
          resolved: b.resolved,
          confidence: b.confidence ?? null,
          relevanceScore: scoreBarrierRelevance(b),
          evidenceRefs: signals,
        };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxBarriers);

    const rankedActions: ActionHistory = (source.interventions ?? [])
      .map((i) => ({
        type: i.type,
        status: i.status,
        outcome: i.outcomes?.[0]?.outcomeStatus ?? null,
        timestamp: toIso(i.createdAt),
        relevanceScore: scoreActionRelevance(i),
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxActions);

    const appointments = source.appointments ?? [];
    const verifications = source.verifications ?? [];

    const hasVerifiedVisit =
      Boolean(source.firstCompletedVisitAt) ||
      verifications.some((v) => v.verified && (v.verificationStatus ?? "VERIFIED") === "VERIFIED");

    const evidenceRefs: EvidenceReference[] = [
      ...verifications.map((v) => ({
        refId: `verification:${v.id}`,
        sourceType: v.signalType ?? "VERIFICATION",
        verified: v.verified,
        timestamp: toIso(v.verifiedAt),
        summary: sanitizeAuditText(
          `Verification ${v.signalType ?? "SIGNAL"} (${v.verificationStatus ?? (v.verified ? "VERIFIED" : "PENDING")})`
        ),
      })),
      ...appointments.map((a) => ({
        refId: `appointment:${a.id}`,
        sourceType: "APPOINTMENT",
        verified: a.status === "CONFIRMED" || a.status === "COMPLETED",
        timestamp: toIso(a.scheduledStartAt),
        summary: `Appointment status ${a.status}`,
      })),
    ]
      .sort((a, b) => Number(b.verified) - Number(a.verified))
      .slice(0, maxEvidenceRefs);

    const latestRisk = source.riskAssessments?.[0];
    const riskTier = String(source.riskLevel ?? latestRisk?.riskLevel ?? "MEDIUM");
    const priorityScore = source.priorityScore ?? latestRisk?.score ?? 50;

    const pendingBarrierConfirmations = rawBarriers.filter(
      (b) => b.epistemicStatus !== "FACT" && !b.confirmedByHuman && !b.resolved
    ).length;
    const pendingInterventionApprovals = (source.interventions ?? []).filter(
      (i) => i.status === "RECOMMENDED"
    ).length;

    const corePayload = {
      contextVersion: CASE_CONTEXT_VERSION,
      caseId: source.id,
      goal: source.goal?.trim() || buildCaseGoal({ specialty: source.referral.specialty }),
      currentState: source.status,
      member: {
        preferredLanguage: source.member.preferredLanguage,
        urbanicity: source.member.urbanicity,
        preferredChannel: source.member.preferredContactChannel ?? "PHONE",
        digitalAccessLevel: source.member.digitalAccessLevel,
        transportationAccess: source.member.transportationAccess,
        consentOutreach: source.member.consentOutreach,
        consentSms: source.member.consentSms,
        priorNoShowCount: source.member.priorNoShowCount,
      },
      referral: {
        specialty: source.referral.specialty,
        behavioralHealthNeed: sanitizeAuditText(source.referral.behavioralHealthNeed),
        urgency: source.referral.urgency,
        networkRequired: source.referral.networkRequired,
        eligibilityVerified: source.referral.eligibilityVerified,
        matchedProviderId: source.matchedProviderId ?? null,
        verifiedAvailableSlotsCount: source.verifiedAvailableSlotsCount ?? 0,
      },
      barriers: rankedBarriers,
      actionHistory: rankedActions,
      evidence: {
        hasRiskAssessment: Boolean(source.riskLevel || latestRisk),
        hasScheduledAppointment: appointments.some((a) => a.status === "SCHEDULED"),
        hasConfirmedAppointment: appointments.some((a) => a.status === "CONFIRMED"),
        hasCompletedAppointment: appointments.some((a) => a.status === "COMPLETED"),
        hasVerifiedVisit,
        evidenceRefs,
      },
      humanTasks: {
        pendingBarrierConfirmations,
        pendingInterventionApprovals,
        openEscalations: source.status === "ESCALATED" ? 1 : 0,
        awaitingCompletionVerification:
          appointments.some((a) => a.status === "COMPLETED") && !hasVerifiedVisit,
      },
      policy: {
        riskTier,
        priorityScore,
        consentOutreach: source.member.consentOutreach,
        consentSms: source.member.consentSms,
        humanReviewRequired: Boolean(source.humanReviewRequired),
      },
    };

    const contextHash = createHash("sha256")
      .update(JSON.stringify(corePayload))
      .digest("hex");

    return {
      ...corePayload,
      contextHash,
    };
  }
}

export const caseContextAssembler = new CaseContextAssembler();
