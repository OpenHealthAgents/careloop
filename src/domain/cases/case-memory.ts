import { CaseStatus, EpistemicStatus, VerificationSignalType } from "@prisma/client";
import { redactSensitiveFields, sanitizeAuditText } from "@/lib/logger";
import { buildCaseGoal } from "./state-machine";

const DISALLOWED_TRANSCRIPT_KEYS = new Set([
  "transcript",
  "llmtranscript",
  "rawtranscript",
  "chathistory",
  "conversationhistory",
  "messages",
  "rawllmresponse",
  "rawresponse",
  "systemprompt",
]);

export interface CaseMemoryToolCall {
  tool: string;
  parameters: Record<string, unknown>;
  authorization: {
    actorId: string | null;
    actorRole: string | null;
    humanApproved: boolean;
  };
  result: string;
  timestamp: string;
}

export interface StructuredCaseMemory {
  case_id: string;
  goal: string;
  current_state: CaseStatus;
  canonical_storage_policy: "STRUCTURED_RELATIONAL_ONLY_NO_RAW_LLM_TRANSCRIPTS";
  member_facts: {
    preferences: {
      preferred_modality: string | null;
      preferred_time_window: string | null;
    };
    communication_preferences: {
      preferred_channel: string;
      digital_access_level: string;
    };
    language: string;
    geographic_constraints: {
      geography: string;
      urbanicity: string;
    };
    known_access_constraints: {
      transportation_access: string;
      prior_no_show_count: number;
      digital_access_level: string;
    };
    consent_status: {
      consent_outreach: boolean;
      consent_sms: boolean;
      records: Array<{
        consent_type: string;
        granted: boolean;
        channel: string | null;
        recorded_at: string;
      }>;
    };
  };
  referral_facts: {
    referral_type: string;
    behavioral_health_need: string;
    network_required: string;
    referral_date: string;
    originating_organization: string;
    urgency: string | null;
    referral_status: string;
    eligibility_verified: string;
  };
  barrier_observations: Array<{
    barrier: string;
    category: string;
    epistemic_status: EpistemicStatus | string;
    confidence: number | null;
    evidence: string[];
    source: string;
    timestamp: string;
  }>;
  actions: Array<{
    action: string;
    actor: string;
    timestamp: string;
    result: string;
  }>;
  tool_calls: CaseMemoryToolCall[];
  human_interactions: Array<{
    task: string;
    assigned_user: string | null;
    decision: string;
    resolution: string;
    timestamp: string;
  }>;
  outcome_evidence: {
    appointment: Array<{
      id: string;
      status: string;
      provider_name: string;
      scheduled_start_at: string;
      availability_source: string;
    }>;
    provider_confirmation: Array<{ verified: boolean; status: string; timestamp: string; source: string }>;
    claim_signal: Array<{ verified: boolean; status: string; timestamp: string; source: string }>;
    member_confirmation: Array<{ verified: boolean; status: string; timestamp: string; source: string }>;
    other_verified_signal: Array<{
      signal_type: VerificationSignalType | string;
      verified: boolean;
      status: string;
      timestamp: string;
      source: string;
    }>;
  };
}

/**
 * Strips unrestricted LLM conversation transcripts and redacts sensitive PHI/secrets
 * from any structured tool-call parameters exposed in Case Memory.
 */
export function sanitizeToolParameters(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const redacted = redactSensitiveFields(input) as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(redacted)) {
    if (DISALLOWED_TRANSCRIPT_KEYS.has(key.toLowerCase())) {
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

function toIsoString(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export interface CaseMemorySourceRecord {
  id: string;
  goal?: string | null;
  status: CaseStatus;
  assignedTo?: { id: string; name: string; role: string } | null;
  member: {
    preferredLanguage: string;
    geography: string;
    urbanicity: string;
    preferredContactChannel: string;
    preferredTimeWindow?: string | null;
    preferredModality?: string | null;
    digitalAccessLevel: string;
    transportationAccess: string;
    priorNoShowCount: number;
    consentOutreach: boolean;
    consentSms: boolean;
    consents?: Array<{
      purpose: string;
      granted: boolean;
      channel: string | null;
      grantedAt: Date | string;
    }>;
  };
  referral: {
    specialty: string;
    behavioralHealthNeed: string;
    networkRequired: string;
    referralDate: Date | string;
    sourceSystem: string;
    referringProviderName?: string | null;
    urgency: string;
    status: string;
    eligibilityVerified: string;
  };
  barriers: Array<{
    category: string;
    subBarrier: string;
    epistemicStatus: EpistemicStatus | string;
    confidence: number | null;
    evidenceSignals: unknown;
    source: string;
    confirmedByHuman: boolean;
    confirmedById: string | null;
    reviewStatus: string;
    reviewNotes: string | null;
    reviewedAt: Date | string | null;
    detectedAt: Date | string;
  }>;
  aiRecommendations: Array<{
    operation: string;
    status: string;
    providerName: string;
    modelVersion: string;
    inputContext: unknown;
    resultingAction: string | null;
    humanReviewerId: string | null;
    humanReviewer?: { id: string; name: string; role: string } | null;
    reviewedAt: Date | string | null;
    createdAt: Date | string;
  }>;
  interventions: Array<{
    type: string;
    status: string;
    executionMode: string;
    assignedOwnerId: string | null;
    assignedOwner?: { id: string; name: string; role: string } | null;
    approvedAt: Date | string | null;
    notes: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    outcomes?: Array<{ outcomeStatus: string; barriersResolved: boolean; recordedAt: Date | string }>;
  }>;
  appointments: Array<{
    id: string;
    status: string;
    scheduledStartAt: Date | string;
    availabilitySourceAtBooking: string;
    provider: { name: string };
  }>;
  verifications: Array<{
    signalType: VerificationSignalType | string;
    verified: boolean;
    verificationStatus?: string;
    sourceSystem: string;
    verifiedAt: Date | string;
  }>;
  workflowEvents: Array<{
    eventType: string;
    fromStatus: CaseStatus | null;
    toStatus: CaseStatus;
    actorId: string | null;
    actorRole: string | null;
    reason: string | null;
    createdAt: Date | string;
  }>;
  caseNotes: Array<{
    category: string;
    content: string;
    author?: { id: string; name: string; role: string } | null;
    createdAt: Date | string;
  }>;
  auditEvents?: Array<{
    action: string;
    actorId: string | null;
    actorRole: string | null;
    source: string;
    summary: string;
    createdAt: Date | string;
  }>;
}

/**
 * Compiles structured, redacted Case Memory directly from normalized relational entities.
 * Never persists or returns unrestricted raw LLM conversation transcripts.
 */
export function buildCaseMemory(careCase: CaseMemorySourceRecord): StructuredCaseMemory {
  const actions: StructuredCaseMemory["actions"] = [
    ...careCase.workflowEvents.map((ev) => ({
      action: ev.eventType,
      actor: ev.actorRole ? `${ev.actorRole}${ev.actorId ? ` (${ev.actorId})` : ""}` : "SYSTEM",
      timestamp: toIsoString(ev.createdAt),
      result: ev.reason
        ? sanitizeAuditText(ev.reason)
        : `${ev.fromStatus ?? "INIT"} -> ${ev.toStatus}`,
    })),
    ...careCase.interventions.map((inv) => ({
      action: `INTERVENTION:${inv.type}`,
      actor: inv.assignedOwner?.name ?? inv.executionMode,
      timestamp: toIsoString(inv.updatedAt),
      result: inv.outcomes?.[0]?.outcomeStatus ?? inv.status,
    })),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const toolCalls: CaseMemoryToolCall[] = [
    ...careCase.aiRecommendations.map((rec) => ({
      tool: `ai.${rec.operation.toLowerCase()}`,
      parameters: sanitizeToolParameters(rec.inputContext),
      authorization: {
        actorId: rec.humanReviewerId,
        actorRole: rec.humanReviewer?.role ?? null,
        humanApproved: rec.status === "ACCEPTED" || rec.status === "MODIFIED",
      },
      result: rec.resultingAction ?? rec.status,
      timestamp: toIsoString(rec.createdAt),
    })),
    ...(careCase.auditEvents ?? [])
      .filter((a) => a.source !== "ACCESS_LOG")
      .map((a) => ({
        tool: `workflow.${a.action.toLowerCase()}`,
        parameters: { source: a.source },
        authorization: {
          actorId: a.actorId,
          actorRole: a.actorRole,
          humanApproved: Boolean(a.actorId),
        },
        result: sanitizeAuditText(a.summary),
        timestamp: toIsoString(a.createdAt),
      })),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const humanInteractions: StructuredCaseMemory["human_interactions"] = [
    ...careCase.barriers
      .filter((b) => b.confirmedByHuman || b.reviewedAt)
      .map((b) => ({
        task: `Barrier Review: ${b.category} (${b.subBarrier})`,
        assigned_user: b.confirmedById,
        decision: b.reviewStatus,
        resolution: b.reviewNotes ? sanitizeAuditText(b.reviewNotes) : String(b.epistemicStatus),
        timestamp: toIsoString(b.reviewedAt ?? b.detectedAt),
      })),
    ...careCase.interventions
      .filter((i) => i.approvedAt || i.notes || i.status === "REJECTED" || i.status === "APPROVED" || i.status === "MODIFIED")
      .map((i) => ({
        task: `Intervention Gate: ${i.type}`,
        assigned_user: i.assignedOwner?.name ?? i.assignedOwnerId,
        decision: i.status,
        resolution: i.notes
          ? sanitizeAuditText(i.notes)
          : i.outcomes?.[0]?.outcomeStatus ?? i.status,
        timestamp: toIsoString(i.updatedAt),
      })),
    ...careCase.caseNotes.map((n) => ({
      task: `Case Note (${n.category})`,
      assigned_user: n.author?.name ?? null,
      decision: "DOCUMENTED",
      resolution: sanitizeAuditText(n.content),
      timestamp: toIsoString(n.createdAt),
    })),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const mapSignal = (v: CaseMemorySourceRecord["verifications"][number]) => ({
    verified: v.verified,
    status: v.verificationStatus ?? (v.verified ? "VERIFIED" : "INSUFFICIENT_EVIDENCE"),
    timestamp: toIsoString(v.verifiedAt),
    source: v.sourceSystem,
  });

  return {
    case_id: careCase.id,
    goal: careCase.goal?.trim() || buildCaseGoal({ specialty: careCase.referral.specialty }),
    current_state: careCase.status,
    canonical_storage_policy: "STRUCTURED_RELATIONAL_ONLY_NO_RAW_LLM_TRANSCRIPTS",
    member_facts: {
      preferences: {
        preferred_modality: careCase.member.preferredModality ?? null,
        preferred_time_window: careCase.member.preferredTimeWindow ?? null,
      },
      communication_preferences: {
        preferred_channel: careCase.member.preferredContactChannel,
        digital_access_level: careCase.member.digitalAccessLevel,
      },
      language: careCase.member.preferredLanguage,
      geographic_constraints: {
        geography: careCase.member.geography,
        urbanicity: careCase.member.urbanicity,
      },
      known_access_constraints: {
        transportation_access: careCase.member.transportationAccess,
        prior_no_show_count: careCase.member.priorNoShowCount,
        digital_access_level: careCase.member.digitalAccessLevel,
      },
      consent_status: {
        consent_outreach: careCase.member.consentOutreach,
        consent_sms: careCase.member.consentSms,
        records: (careCase.member.consents ?? []).map((c) => ({
          consent_type: c.purpose,
          granted: c.granted,
          channel: c.channel,
          recorded_at: toIsoString(c.grantedAt),
        })),
      },
    },
    referral_facts: {
      referral_type: careCase.referral.specialty,
      behavioral_health_need: careCase.referral.behavioralHealthNeed,
      network_required: careCase.referral.networkRequired,
      referral_date: toIsoString(careCase.referral.referralDate),
      originating_organization:
        careCase.referral.referringProviderName?.trim() || careCase.referral.sourceSystem,
      urgency: careCase.referral.urgency || null,
      referral_status: careCase.referral.status,
      eligibility_verified: careCase.referral.eligibilityVerified,
    },
    barrier_observations: careCase.barriers.map((b) => ({
      barrier: `${b.category}: ${b.subBarrier}`,
      category: b.category,
      epistemic_status: b.epistemicStatus,
      confidence: b.confidence,
      evidence: Array.isArray(b.evidenceSignals)
        ? b.evidenceSignals.filter((s): s is string => typeof s === "string")
        : [],
      source: b.source,
      timestamp: toIsoString(b.detectedAt),
    })),
    actions,
    tool_calls: toolCalls,
    human_interactions: humanInteractions,
    outcome_evidence: {
      appointment: careCase.appointments.map((a) => ({
        id: a.id,
        status: a.status,
        provider_name: a.provider.name,
        scheduled_start_at: toIsoString(a.scheduledStartAt),
        availability_source: a.availabilitySourceAtBooking,
      })),
      provider_confirmation: careCase.verifications
        .filter((v) => v.signalType === "PROVIDER_CONFIRMATION")
        .map(mapSignal),
      claim_signal: careCase.verifications
        .filter((v) => v.signalType === "CLAIM_RECEIVED")
        .map(mapSignal),
      member_confirmation: careCase.verifications
        .filter((v) => v.signalType === "MEMBER_CONFIRMATION")
        .map(mapSignal),
      other_verified_signal: careCase.verifications
        .filter(
          (v) =>
            v.signalType !== "PROVIDER_CONFIRMATION" &&
            v.signalType !== "CLAIM_RECEIVED" &&
            v.signalType !== "MEMBER_CONFIRMATION"
        )
        .map((v) => ({
          signal_type: v.signalType,
          ...mapSignal(v),
        })),
    },
  };
}
