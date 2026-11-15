/**
 * ============================================================================
 * EVENT-DRIVEN EXECUTION CONTRACTS
 * ============================================================================
 * Defines the 12 core healthcare coordination events:
 * 1. ReferralCreated
 * 2. ReferralUpdated
 * 3. ProviderFound
 * 4. ProviderUnavailable
 * 5. MemberResponded
 * 6. AppointmentScheduled
 * 7. AppointmentCancelled
 * 8. AppointmentCompleted
 * 9. ClaimReceived
 * 10. HumanApprovalGranted
 * 11. HumanApprovalRejected
 * 12. BarrierUpdated
 *
 * Guarantees:
 * - Idempotency: Duplicate events are detected and safely suppressed.
 * - Reactive Agents: Agents can subscribe and react to domain events.
 * - Deterministic Transitions: All resulting state changes pass through
 *   the mathematical state machine.
 * ============================================================================
 */

import { CaseStatus } from "@prisma/client";
import { SessionUser } from "@/lib/auth/session";

export type CareLoopEventType =
  | "ReferralCreated"
  | "ReferralUpdated"
  | "ProviderFound"
  | "ProviderUnavailable"
  | "MemberResponded"
  | "AppointmentScheduled"
  | "AppointmentCancelled"
  | "AppointmentCompleted"
  | "ClaimReceived"
  | "HumanApprovalGranted"
  | "HumanApprovalRejected"
  | "BarrierUpdated";

// ----------------------------------------------------------------------------
// Typed Event Payloads for All 12 Events
// ----------------------------------------------------------------------------

export interface ReferralCreatedPayload {
  referralId: string;
  memberId: string;
  specialty: string;
  urgency: string;
  behavioralHealthNeed?: string;
  priorityScore: number;
  referringProviderName?: string;
  operationalNotes?: string;
}

export interface ReferralUpdatedPayload {
  referralId: string;
  memberId: string;
  updatedFields: string[];
  previousValues?: Record<string, unknown>;
  newValues: Record<string, unknown>;
}

export interface ProviderFoundPayload {
  providerId: string;
  providerName: string;
  specialty: string;
  matchScore: number;
  verifiedSlotsCount: number;
  acceptingNewPatients: boolean;
  distanceMiles?: number;
}

export interface ProviderUnavailablePayload {
  providerId: string;
  providerName?: string;
  specialty: string;
  reason: "NO_SLOTS" | "NETWORK_EXIT" | "SPECIALTY_MISMATCH" | "UNREACHABLE";
  alternativesFoundCount: number;
}

export interface MemberRespondedPayload {
  memberId: string;
  channel: "SMS" | "PORTAL" | "PHONE" | "EMAIL" | "IN_PERSON_NAVIGATOR";
  responseIntent:
    | "CONFIRMED"
    | "RESCHEDULE_REQUEST"
    | "DECLINED"
    | "BARRIER_REPORTED"
    | "GENERAL_QUERY"
    | "OPT_OUT";
  bodySnippet?: string;
  reportedBarrierCategory?: string;
}

export interface AppointmentScheduledPayload {
  appointmentId: string;
  providerId: string;
  slotId?: string;
  scheduledStartAt: string;
  modality: "IN_PERSON" | "TELEHEALTH";
  bookingConfirmationCode?: string;
}

export interface AppointmentCancelledPayload {
  appointmentId: string;
  providerId: string;
  cancelledBy: "MEMBER" | "PROVIDER" | "CARE_MANAGER" | "SYSTEM";
  cancellationReason?: string;
  requiresRescheduling: boolean;
}

export interface AppointmentCompletedPayload {
  appointmentId: string;
  providerId: string;
  completedAt: string;
  clinicAttestationId?: string;
  attendanceVerified: boolean;
}

export interface ClaimReceivedPayload {
  claimId: string;
  procedureCode: string;
  serviceDate: string;
  providerNpi: string;
  claimStatus: "PAID" | "SUBMITTED" | "ADJUDICATED";
  paidAmount?: number;
}

export interface HumanApprovalGrantedPayload {
  approvalId: string;
  action: string;
  approvedById: string;
  approvedAt: string;
  comments?: string;
  targetPayload?: Record<string, unknown>;
}

export interface HumanApprovalRejectedPayload {
  approvalId: string;
  action: string;
  rejectedById: string;
  rejectedAt: string;
  rejectionReason: string;
}

export interface BarrierUpdatedPayload {
  barrierId?: string;
  category: string;
  previousCategory?: string;
  subBarrier?: string;
  epistemicStatus: "HYPOTHESIZED" | "INFERRED" | "CONFIRMED" | "RESOLVED";
  confirmedByHuman?: boolean;
  resolutionNotes?: string;
}

export type EventPayloadMap = {
  ReferralCreated: ReferralCreatedPayload;
  ReferralUpdated: ReferralUpdatedPayload;
  ProviderFound: ProviderFoundPayload;
  ProviderUnavailable: ProviderUnavailablePayload;
  MemberResponded: MemberRespondedPayload;
  AppointmentScheduled: AppointmentScheduledPayload;
  AppointmentCancelled: AppointmentCancelledPayload;
  AppointmentCompleted: AppointmentCompletedPayload;
  ClaimReceived: ClaimReceivedPayload;
  HumanApprovalGranted: HumanApprovalGrantedPayload;
  HumanApprovalRejected: HumanApprovalRejectedPayload;
  BarrierUpdated: BarrierUpdatedPayload;
};

// ----------------------------------------------------------------------------
// Base Event Envelope
// ----------------------------------------------------------------------------

export interface EventActor {
  type: "AGENT" | "HUMAN" | "SYSTEM";
  id?: string;
  role?: string;
}

export interface CareLoopEvent<TType extends CareLoopEventType = CareLoopEventType> {
  eventId: string;
  eventType: TType;
  /** Idempotency key ensuring at-most-once execution of side-effects */
  idempotencyKey: string;
  tenantId: string;
  caseId: string;
  timestamp: Date;
  correlationId: string;
  actor: EventActor;
  payload: EventPayloadMap[TType];
}

// ----------------------------------------------------------------------------
// Execution & Reaction Results
// ----------------------------------------------------------------------------

export type EventHandlingStatus = "PROCESSED" | "DUPLICATE_IGNORED" | "FAILED";

export interface EventReactionOutcome {
  agentName: string;
  reaction: string;
  success: boolean;
  proposedTransition?: {
    from: CaseStatus;
    to: CaseStatus;
    reason: string;
  };
  output?: unknown;
  error?: string;
}

export interface EventProcessingResult {
  eventId: string;
  eventType: CareLoopEventType;
  idempotencyKey: string;
  status: EventHandlingStatus;
  caseId: string;
  replayed: boolean;
  deterministicStateTransition?: {
    applied: boolean;
    from: CaseStatus;
    to: CaseStatus;
    reason: string;
  };
  reactions: readonly EventReactionOutcome[];
  processedAt: Date;
  error?: string;
}

// ----------------------------------------------------------------------------
// Handler & Subscription Interfaces
// ----------------------------------------------------------------------------

export interface EventHandlerContext {
  session?: SessionUser;
  correlationId: string;
  currentCaseStatus: CaseStatus;
}

export type EventHandler<TType extends CareLoopEventType = CareLoopEventType> = (
  event: CareLoopEvent<TType>,
  context: EventHandlerContext
) => Promise<EventReactionOutcome>;
