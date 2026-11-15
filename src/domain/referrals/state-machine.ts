import { ReferralStatus } from "@prisma/client";
import { InvalidStateTransitionError } from "@/lib/errors";

export const ALLOWED_REFERRAL_TRANSITIONS: Record<ReferralStatus, readonly ReferralStatus[]> = {
  RECEIVED: [ReferralStatus.TRIAGED, ReferralStatus.IN_CASE, ReferralStatus.CANCELLED],
  TRIAGED: [
    ReferralStatus.IN_CASE,
    ReferralStatus.APPOINTMENT_SCHEDULED,
    ReferralStatus.CLOSED_UNRESOLVED,
    ReferralStatus.CANCELLED,
  ],
  IN_CASE: [
    ReferralStatus.APPOINTMENT_SCHEDULED,
    ReferralStatus.COMPLETED,
    ReferralStatus.CLOSED_UNRESOLVED,
    ReferralStatus.CANCELLED,
  ],
  APPOINTMENT_SCHEDULED: [
    ReferralStatus.COMPLETED,
    ReferralStatus.IN_CASE,
    ReferralStatus.CLOSED_UNRESOLVED,
    ReferralStatus.CANCELLED,
  ],
  COMPLETED: [],
  CLOSED_UNRESOLVED: [ReferralStatus.IN_CASE],
  CANCELLED: [],
};

export function canTransitionReferralStatus(fromStatus: ReferralStatus, toStatus: ReferralStatus): boolean {
  if (fromStatus === toStatus) return false;
  return ALLOWED_REFERRAL_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

export function assertReferralTransition(fromStatus: ReferralStatus, toStatus: ReferralStatus): void {
  if (!canTransitionReferralStatus(fromStatus, toStatus)) {
    throw new InvalidStateTransitionError(fromStatus, toStatus);
  }
}
