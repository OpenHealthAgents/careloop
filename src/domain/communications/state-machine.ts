import { DeliveryStatus } from "@prisma/client";
import { InvalidStateTransitionError } from "@/lib/errors";

export const ALLOWED_COMMUNICATION_TRANSITIONS: Record<DeliveryStatus, readonly DeliveryStatus[]> = {
  [DeliveryStatus.DRAFT]: [
    DeliveryStatus.APPROVED,
    DeliveryStatus.SENT,
    DeliveryStatus.FAILED,
  ],
  [DeliveryStatus.APPROVED]: [
    DeliveryStatus.SENT,
    DeliveryStatus.FAILED,
  ],
  [DeliveryStatus.SENT]: [
    DeliveryStatus.DELIVERED,
    DeliveryStatus.RESPONDED,
    DeliveryStatus.NO_RESPONSE,
    DeliveryStatus.FAILED,
  ],
  [DeliveryStatus.DELIVERED]: [
    DeliveryStatus.RESPONDED,
    DeliveryStatus.NO_RESPONSE,
  ],
  [DeliveryStatus.RESPONDED]: [],
  [DeliveryStatus.NO_RESPONSE]: [],
  [DeliveryStatus.FAILED]: [DeliveryStatus.DRAFT],
};

export function canTransitionCommunicationStatus(
  from: DeliveryStatus,
  to: DeliveryStatus
): boolean {
  return ALLOWED_COMMUNICATION_TRANSITIONS[from].includes(to);
}

export function assertCommunicationTransition(
  from: DeliveryStatus,
  to: DeliveryStatus
): void {
  if (!canTransitionCommunicationStatus(from, to)) {
    throw new InvalidStateTransitionError(
      from,
      to,
      `Allowed communication transitions from ${from}: ${ALLOWED_COMMUNICATION_TRANSITIONS[from].join(", ") || "none"}`
    );
  }
}
