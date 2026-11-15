import { AppointmentStatus, RecommendationStatus } from "@prisma/client";
import { InvalidStateTransitionError } from "@/lib/errors";

export const APPOINTMENT_STATUS_ORDER: readonly AppointmentStatus[] = [
  AppointmentStatus.REQUESTED,
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.RESCHEDULED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.UNKNOWN,
];

export const ALLOWED_APPOINTMENT_TRANSITIONS: Record<
  AppointmentStatus,
  readonly AppointmentStatus[]
> = {
  PROPOSED: [
    AppointmentStatus.REQUESTED,
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.UNKNOWN,
  ],
  REQUESTED: [
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.UNKNOWN,
  ],
  SCHEDULED: [
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.UNKNOWN,
  ],
  CONFIRMED: [
    AppointmentStatus.COMPLETED,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.UNKNOWN,
  ],
  RESCHEDULED: [
    AppointmentStatus.REQUESTED,
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.UNKNOWN,
  ],
  NO_SHOW: [
    AppointmentStatus.REQUESTED,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.UNKNOWN,
  ],
  CANCELLED: [AppointmentStatus.REQUESTED, AppointmentStatus.RESCHEDULED],
  UNKNOWN: [
    AppointmentStatus.REQUESTED,
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.RESCHEDULED,
  ],
  COMPLETED: [],
};

export function canTransitionAppointmentStatus(
  fromStatus: AppointmentStatus,
  toStatus: AppointmentStatus
): boolean {
  if (fromStatus === toStatus) return false;
  return ALLOWED_APPOINTMENT_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

export function assertAppointmentTransition(
  fromStatus: AppointmentStatus,
  toStatus: AppointmentStatus
): void {
  if (!canTransitionAppointmentStatus(fromStatus, toStatus)) {
    throw new InvalidStateTransitionError(
      fromStatus,
      toStatus,
      `Allowed next appointment states: ${ALLOWED_APPOINTMENT_TRANSITIONS[fromStatus]?.join(", ") || "none (terminal)"}`
    );
  }
}

export const ALLOWED_RECOMMENDATION_TRANSITIONS: Record<
  RecommendationStatus,
  readonly RecommendationStatus[]
> = {
  PENDING: [
    RecommendationStatus.APPROVED,
    RecommendationStatus.MODIFIED,
    RecommendationStatus.REJECTED,
    RecommendationStatus.EXPIRED,
    RecommendationStatus.SUPERSEDED,
  ],
  APPROVED: [RecommendationStatus.SUPERSEDED],
  MODIFIED: [RecommendationStatus.SUPERSEDED],
  REJECTED: [],
  EXPIRED: [],
  SUPERSEDED: [],
};

export function assertRecommendationTransition(
  fromStatus: RecommendationStatus,
  toStatus: RecommendationStatus
): void {
  if (
    fromStatus === toStatus ||
    !ALLOWED_RECOMMENDATION_TRANSITIONS[fromStatus]?.includes(toStatus)
  ) {
    throw new InvalidStateTransitionError(fromStatus, toStatus);
  }
}
