import { BarrierCategory, CommunicationMessageType, ReadingLevel } from "@prisma/client";
import { ProviderCandidate, ProviderMatchInput } from "@/domain/matching/provider-matcher";
import {
  CalculateRiskResult,
  ClassifyBarrierResult,
  GenerateCommunicationResult,
  MatchProviderResult,
  RecommendInterventionResult,
  SummarizeCaseResult,
} from "./schemas";

/**
 * Operational input for AI assessment.
 * NOTE: Protected characteristics (e.g., race/ethnicity) are intentionally EXCLUDED
 * from AI risk & barrier inputs to prevent discriminatory individual scoring.
 */
export interface ReferralAssessmentInput {
  referralId: string;
  referralDate: Date;
  behavioralHealthNeed: string;
  specialty: string;
  urgency: string;
  geography: string;
  networkRequired: string;
  preferredLanguage: string;
  eligibilityVerified: string;
  referringProviderName?: string | null;
  operationalNotes?: string | null;
  member: {
    urbanicity: string;
    coverageType: string;
    eligibilityStatus: string;
    preferredContactChannel: string;
    digitalAccessLevel: string;
    transportationAccess: string;
    priorNoShowCount: number;
    priorFailedReferralsCount?: number;
    historicalEngagementRate: number | null;
  };
  matchingProvidersCount: number;
  inNetworkProvidersCount?: number;
  languageConcordantProvidersCount: number;
  verifiedAvailableSlotsCount: number;
  minDirectoryWaitDays: number | null;
}

export interface RecommendInterventionInput {
  caseId: string;
  primaryBarrierCategory: BarrierCategory;
  primaryBarrierCode: string;
  riskTier: string;
  preferredLanguage: string;
  digitalAccessLevel: string;
  transportationAccess: string;
  consentSms: boolean;
  verifiedAvailableSlotsCount: number;
  languageConcordantProvidersCount: number;
  priorNoShowCount?: number;
  eligibilityVerified?: string;
}

export interface SummarizeCaseInput {
  caseId: string;
  status: string;
  referralNeed: string;
  specialty: string;
  referralDate: Date;
  riskTier: string;
  priorityScore: number;
  barriers: Array<{
    category: BarrierCategory;
    subBarrier: string;
    epistemicStatus: string;
    confirmedByHuman: boolean;
  }>;
  interventions: Array<{
    type: string;
    status: string;
    outcome: string | null;
  }>;
  appointmentsCount: number;
  latestAppointmentStatus: string | null;
  outreachCount: number;
  verificationsCount: number;
}

export interface GenerateCommunicationInput {
  memberFirstName: string;
  preferredLanguage: string;
  channel: "SMS" | "PHONE" | "EMAIL" | "PORTAL";
  purpose:
    | CommunicationMessageType
    | "INITIAL_OUTREACH"
    | "SCHEDULING_ASSIST"
    | "APPOINTMENT_REMINDER"
    | "MISSED_VISIT_FOLLOWUP"
    | "COVERAGE_CLARIFICATION";
  readingLevel?: ReadingLevel;
  specialty: string;
  networkRequired?: string;
  providerCount?: number;
  availableThisWeekCount?: number;
  providerName?: string | null;
  appointmentDateText?: string | null;
  barrierSubCategory?: string | null;
}

export interface MatchProviderAIInput {
  caseId: string;
  criteria: ProviderMatchInput;
  candidates: ProviderCandidate[];
}

export interface AIProvider {
  readonly name: string;
  readonly modelVersion: string;

  classifyBarrier(input: ReferralAssessmentInput): Promise<ClassifyBarrierResult>;
  calculateRisk(input: ReferralAssessmentInput): Promise<CalculateRiskResult>;
  recommendIntervention(input: RecommendInterventionInput): Promise<RecommendInterventionResult>;
  summarizeCase(input: SummarizeCaseInput): Promise<SummarizeCaseResult>;
  generateMemberCommunication(
    input: GenerateCommunicationInput
  ): Promise<GenerateCommunicationResult>;
  matchProvider(input: MatchProviderAIInput): Promise<MatchProviderResult>;
}
