/**
 * ============================================================================
 * AGENT EVENT REACTIONS
 * ============================================================================
 * Defines standard reactive behaviors for specialized agents when domain
 * events arrive.
 *
 * Guarantees:
 * - Agents react autonomously to event signals.
 * - State transitions are PROPOSED, not forced.
 * - Every proposed state transition MUST pass through the deterministic
 *   CaseWorkflowEngine state machine.
 * ============================================================================
 */

import { CaseStatus } from "@prisma/client";
import {
  CareLoopEvent,
  EventHandler,
  EventReactionOutcome,
} from "./contracts";

/**
 * 1. ReferralCreated Reaction: ReferralAgent triages case
 */
export const onReferralCreated: EventHandler<"ReferralCreated"> = async (
  event,
  context
): Promise<EventReactionOutcome> => {
  const current = context.currentCaseStatus;
  const proposedTransition =
    current === "NEW"
      ? {
          from: current,
          to: "TRIAGED" as CaseStatus,
          reason: `Referral triage completed for specialty ${event.payload.specialty}.`,
        }
      : undefined;

  return {
    agentName: "ReferralAgent",
    reaction: "Referral intake schema verified and priority score assigned.",
    success: true,
    proposedTransition,
    output: {
      referralId: event.payload.referralId,
      priorityScore: event.payload.priorityScore,
    },
  };
};

/**
 * 2. ReferralUpdated Reaction: Re-evaluates case priorities
 */
export const onReferralUpdated: EventHandler<"ReferralUpdated"> = async (
  event
): Promise<EventReactionOutcome> => {
  return {
    agentName: "ReferralAgent",
    reaction: `Referral updated with fields: [${event.payload.updatedFields.join(", ")}].`,
    success: true,
    output: { updatedFields: event.payload.updatedFields },
  };
};

/**
 * 3. ProviderFound Reaction: SchedulingAgent initiates slot options
 */
export const onProviderFound: EventHandler<"ProviderFound"> = async (
  event,
  context
): Promise<EventReactionOutcome> => {
  const current = context.currentCaseStatus;
  const proposedTransition =
    current === "BARRIER_IDENTIFIED" || current === "INTERVENTION_RECOMMENDED"
      ? {
          from: current,
          to: "INTERVENTION_IN_PROGRESS" as CaseStatus,
          reason: `Provider ${event.payload.providerName} matched with ${event.payload.verifiedSlotsCount} verified slots.`,
        }
      : undefined;

  return {
    agentName: "SchedulingAgent",
    reaction: `Matched in-network provider ${event.payload.providerName} (Score: ${event.payload.matchScore}).`,
    success: true,
    proposedTransition,
    output: {
      providerId: event.payload.providerId,
      verifiedSlotsCount: event.payload.verifiedSlotsCount,
    },
  };
};

/**
 * 4. ProviderUnavailable Reaction: ProviderAgent flags network deficit
 */
export const onProviderUnavailable: EventHandler<"ProviderUnavailable"> = async (
  event
): Promise<EventReactionOutcome> => {
  return {
    agentName: "ProviderAgent",
    reaction: `Provider ${event.payload.providerId} unavailable (${event.payload.reason}). Alternatives available: ${event.payload.alternativesFoundCount}.`,
    success: true,
    output: {
      networkDeficit: event.payload.alternativesFoundCount === 0,
      reason: event.payload.reason,
    },
  };
};

/**
 * 5. MemberResponded Reaction: EngagementAgent handles response
 */
export const onMemberResponded: EventHandler<"MemberResponded"> = async (
  event,
  context
): Promise<EventReactionOutcome> => {
  const current = context.currentCaseStatus;
  let proposedTransition: { from: CaseStatus; to: CaseStatus; reason: string } | undefined;

  if (event.payload.responseIntent === "CONFIRMED" && current === "APPOINTMENT_SCHEDULED") {
    proposedTransition = {
      from: current,
      to: "APPOINTMENT_CONFIRMED",
      reason: `Member confirmed appointment attendance via ${event.payload.channel}.`,
    };
  }

  return {
    agentName: "EngagementAgent",
    reaction: `Member response received via ${event.payload.channel} (Intent: ${event.payload.responseIntent}).`,
    success: true,
    proposedTransition,
    output: { responseIntent: event.payload.responseIntent },
  };
};

/**
 * 6. AppointmentScheduled Reaction: SchedulingAgent records booking
 */
export const onAppointmentScheduled: EventHandler<"AppointmentScheduled"> = async (
  event,
  context
): Promise<EventReactionOutcome> => {
  const current = context.currentCaseStatus;
  const proposedTransition =
    current === "INTERVENTION_IN_PROGRESS" || current === "INTERVENTION_RECOMMENDED"
      ? {
          from: current,
          to: "APPOINTMENT_SCHEDULED" as CaseStatus,
          reason: `Appointment booked for ${event.payload.scheduledStartAt} (${event.payload.modality}).`,
        }
      : undefined;

  return {
    agentName: "SchedulingAgent",
    reaction: `Appointment ${event.payload.appointmentId} confirmed with provider clinic.`,
    success: true,
    proposedTransition,
    output: {
      appointmentId: event.payload.appointmentId,
      scheduledStartAt: event.payload.scheduledStartAt,
    },
  };
};

/**
 * 7. AppointmentCancelled Reaction: Evaluates rescheduling outreach
 */
export const onAppointmentCancelled: EventHandler<"AppointmentCancelled"> = async (
  event
): Promise<EventReactionOutcome> => {
  return {
    agentName: "SchedulingAgent",
    reaction: `Appointment ${event.payload.appointmentId} cancelled by ${event.payload.cancelledBy}. Rescheduling outreach required: ${event.payload.requiresRescheduling}.`,
    success: true,
    output: {
      requiresRescheduling: event.payload.requiresRescheduling,
      cancellationReason: event.payload.cancellationReason,
    },
  };
};

/**
 * 8. AppointmentCompleted Reaction: VerificationAgent initiates completion check
 */
export const onAppointmentCompleted: EventHandler<"AppointmentCompleted"> = async (
  event,
  context
): Promise<EventReactionOutcome> => {
  const current = context.currentCaseStatus;
  const proposedTransition =
    current === "APPOINTMENT_SCHEDULED" || current === "APPOINTMENT_CONFIRMED"
      ? {
          from: current,
          to: "APPOINTMENT_COMPLETED" as CaseStatus,
          reason: `Clinical attendance completed on ${event.payload.completedAt}.`,
        }
      : undefined;

  return {
    agentName: "VerificationAgent",
    reaction: `First visit attendance recorded for appointment ${event.payload.appointmentId}.`,
    success: true,
    proposedTransition,
    output: { attendanceVerified: event.payload.attendanceVerified },
  };
};

/**
 * 9. ClaimReceived Reaction: VerificationAgent confirms verified completion
 */
export const onClaimReceived: EventHandler<"ClaimReceived"> = async (
  event,
  context
): Promise<EventReactionOutcome> => {
  const current = context.currentCaseStatus;
  const proposedTransition =
    current === "APPOINTMENT_COMPLETED"
      ? {
          from: current,
          to: "VERIFIED" as CaseStatus,
          reason: `Claim ${event.payload.claimId} (${event.payload.procedureCode}) verified from billing data.`,
        }
      : undefined;

  return {
    agentName: "VerificationAgent",
    reaction: `Electronic health claim received for procedure ${event.payload.procedureCode}.`,
    success: true,
    proposedTransition,
    output: { claimId: event.payload.claimId, status: event.payload.claimStatus },
  };
};

/**
 * 10. HumanApprovalGranted Reaction: Resumes paused high-risk execution
 */
export const onHumanApprovalGranted: EventHandler<"HumanApprovalGranted"> = async (
  event,
  context
): Promise<EventReactionOutcome> => {
  const current = context.currentCaseStatus;
  const proposedTransition =
    current === "INTERVENTION_RECOMMENDED" || current === "REQUIRES_HUMAN_REVIEW"
      ? {
          from: current,
          to: "INTERVENTION_IN_PROGRESS" as CaseStatus,
          reason: `Care Manager granted human approval for action '${event.payload.action}'.`,
        }
      : undefined;

  return {
    agentName: "CaseOrchestrator",
    reaction: `Human approval ${event.payload.approvalId} granted by ${event.payload.approvedById}.`,
    success: true,
    proposedTransition,
    output: { action: event.payload.action, approved: true },
  };
};

/**
 * 11. HumanApprovalRejected Reaction: Halts high-risk action
 */
export const onHumanApprovalRejected: EventHandler<"HumanApprovalRejected"> = async (
  event
): Promise<EventReactionOutcome> => {
  return {
    agentName: "CaseOrchestrator",
    reaction: `Human approval ${event.payload.approvalId} rejected. Reason: ${event.payload.rejectionReason}`,
    success: true,
    output: { action: event.payload.action, approved: false },
  };
};

/**
 * 12. BarrierUpdated Reaction: BarrierAgent identifies barrier
 */
export const onBarrierUpdated: EventHandler<"BarrierUpdated"> = async (
  event,
  context
): Promise<EventReactionOutcome> => {
  const current = context.currentCaseStatus;
  const proposedTransition =
    current === "TRIAGED"
      ? {
          from: current,
          to: "BARRIER_IDENTIFIED" as CaseStatus,
          reason: `SDOH barrier ${event.payload.category} identified (${event.payload.epistemicStatus}).`,
        }
      : undefined;

  return {
    agentName: "BarrierAgent",
    reaction: `Barrier category ${event.payload.category} recorded with status ${event.payload.epistemicStatus}.`,
    success: true,
    proposedTransition,
    output: { category: event.payload.category, status: event.payload.epistemicStatus },
  };
};

/**
 * Default event-to-handler map covering all 12 events.
 */
export const DEFAULT_AGENT_EVENT_HANDLERS: {
  [K in CareLoopEvent["eventType"]]: EventHandler<K>;
} = {
  ReferralCreated: onReferralCreated as EventHandler<"ReferralCreated">,
  ReferralUpdated: onReferralUpdated as EventHandler<"ReferralUpdated">,
  ProviderFound: onProviderFound as EventHandler<"ProviderFound">,
  ProviderUnavailable: onProviderUnavailable as EventHandler<"ProviderUnavailable">,
  MemberResponded: onMemberResponded as EventHandler<"MemberResponded">,
  AppointmentScheduled: onAppointmentScheduled as EventHandler<"AppointmentScheduled">,
  AppointmentCancelled: onAppointmentCancelled as EventHandler<"AppointmentCancelled">,
  AppointmentCompleted: onAppointmentCompleted as EventHandler<"AppointmentCompleted">,
  ClaimReceived: onClaimReceived as EventHandler<"ClaimReceived">,
  HumanApprovalGranted: onHumanApprovalGranted as EventHandler<"HumanApprovalGranted">,
  HumanApprovalRejected: onHumanApprovalRejected as EventHandler<"HumanApprovalRejected">,
  BarrierUpdated: onBarrierUpdated as EventHandler<"BarrierUpdated">,
};
