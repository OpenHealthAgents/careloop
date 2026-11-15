/**
 * ============================================================================
 * DETERMINISTIC VALIDATORS (ZERO-AI CODE)
 * ============================================================================
 * Handles simple validations completely deterministically:
 * - Phone numbers (E.164 and 10-digit North American Numbering Plan)
 * - Emails (RFC standard format)
 * - NPI (10-digit National Provider Identifier with CMS Luhn algorithm)
 * - Appointment Date Windows (ISO-8601 validation, monotonic ordering, non-past)
 * - Member Consent (Outreach, SMS channel validation)
 * - State Machine Transitions (Deterministic state rules)
 *
 * Cost: $0.00 | Tokens: 0 | Latency: < 1ms
 * ============================================================================
 */

import { CaseStatus } from "@prisma/client";
import {
  canTransitionCaseStatus,
  getAllowedNextCaseStatuses,
  validateAgentProposedTransition,
} from "@/domain/cases/state-machine";

export interface ValidationResult<T = unknown> {
  isValid: boolean;
  normalized?: T;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Deterministically validates and normalizes North American and E.164 phone numbers.
 */
export function validatePhoneNumber(rawPhone: unknown): ValidationResult<string> {
  if (typeof rawPhone !== "string" || !rawPhone.trim()) {
    return {
      isValid: false,
      errorCode: "INVALID_PHONE_EMPTY",
      errorMessage: "Phone number is empty or not a string.",
    };
  }

  const digits = rawPhone.replace(/\D/g, "");
  // Standard US/NANP: 10 digits or 11 digits starting with 1
  if (digits.length === 10) {
    // Area codes and exchange codes cannot start with 0 or 1 in NANP
    if (digits[0] === "0" || digits[0] === "1" || digits[3] === "0" || digits[3] === "1") {
      return {
        isValid: false,
        errorCode: "INVALID_PHONE_NANP_AREA_CODE",
        errorMessage: "Invalid North American area or exchange code.",
      };
    }
    return {
      isValid: true,
      normalized: `+1${digits}`,
    };
  } else if (digits.length === 11 && digits.startsWith("1")) {
    const local = digits.slice(1);
    if (local[0] === "0" || local[0] === "1" || local[3] === "0" || local[3] === "1") {
      return {
        isValid: false,
        errorCode: "INVALID_PHONE_NANP_AREA_CODE",
        errorMessage: "Invalid North American area or exchange code.",
      };
    }
    return {
      isValid: true,
      normalized: `+${digits}`,
    };
  }

  return {
    isValid: false,
    errorCode: "INVALID_PHONE_LENGTH",
    errorMessage: `Phone number contains ${digits.length} digits; expected 10 or 11 digits.`,
  };
}

/**
 * Deterministically validates email addresses without regex backtracking risks.
 */
export function validateEmail(rawEmail: unknown): ValidationResult<string> {
  if (typeof rawEmail !== "string" || !rawEmail.trim()) {
    return {
      isValid: false,
      errorCode: "INVALID_EMAIL_EMPTY",
      errorMessage: "Email is empty or not a string.",
    };
  }

  const trimmed = rawEmail.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  if (!emailRegex.test(trimmed) || trimmed.length > 254) {
    return {
      isValid: false,
      errorCode: "INVALID_EMAIL_FORMAT",
      errorMessage: "Provided email does not match standard RFC format.",
    };
  }

  return {
    isValid: true,
    normalized: trimmed,
  };
}

/**
 * Deterministically validates a 10-digit National Provider Identifier (NPI)
 * using the official CMS Luhn algorithm with the "80840" US health identifier prefix.
 *
 * CMS specification:
 * Prepend 24 (from prefix 80840) to the 9-digit base, then calculate Luhn checksum.
 */
export function validateNPI(rawNPI: unknown): ValidationResult<string> {
  if (typeof rawNPI !== "string" && typeof rawNPI !== "number") {
    return {
      isValid: false,
      errorCode: "INVALID_NPI_TYPE",
      errorMessage: "NPI must be a 10-digit string or number.",
    };
  }

  const npiStr = String(rawNPI).trim();
  if (!/^\d{10}$/.test(npiStr)) {
    return {
      isValid: false,
      errorCode: "INVALID_NPI_LENGTH",
      errorMessage: "NPI must be exactly 10 digits.",
    };
  }

  // NPIs start with 1, 2, 3, or 4 for individual or organization providers
  if (!["1", "2", "3", "4"].includes(npiStr[0])) {
    return {
      isValid: false,
      errorCode: "INVALID_NPI_PREFIX",
      errorMessage: "NPI must begin with a recognized provider digit (1-4).",
    };
  }

  // CMS Luhn Check Digit Verification
  // The full identifier under ISO standard is "80840" + 10-digit NPI.
  // The prefix "80840" converts into a constant offset of 24.
  const digits = "80840" + npiStr;
  let sum = 0;
  let double = false;

  // Process digits right-to-left
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }

  if (sum % 10 !== 0) {
    return {
      isValid: false,
      errorCode: "INVALID_NPI_CHECKSUM",
      errorMessage: "NPI failed official CMS Luhn checksum algorithm.",
    };
  }

  return {
    isValid: true,
    normalized: npiStr,
  };
}

/**
 * Deterministically validates appointment slot date windows:
 * - Valid ISO-8601 strings or Date objects
 * - Start time strictly precedes end time
 * - Optionally checks that appointment is not in the past
 */
export function validateDateWindow(
  startTime: unknown,
  endTime: unknown,
  options: { allowPast?: boolean; minimumDurationMinutes?: number } = {}
): ValidationResult<{ start: Date; end: Date }> {
  const start = startTime instanceof Date ? startTime : new Date(String(startTime));
  const end = endTime instanceof Date ? endTime : new Date(String(endTime));

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      isValid: false,
      errorCode: "INVALID_DATE_FORMAT",
      errorMessage: "Start time or end time is not a valid ISO date.",
    };
  }

  if (end.getTime() <= start.getTime()) {
    return {
      isValid: false,
      errorCode: "INVALID_DATE_ORDER",
      errorMessage: "Appointment end time must be strictly after start time.",
    };
  }

  const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  const minDuration = options.minimumDurationMinutes ?? 10;
  if (durationMinutes < minDuration) {
    return {
      isValid: false,
      errorCode: "INVALID_APPOINTMENT_DURATION",
      errorMessage: `Appointment duration (${durationMinutes}m) is less than required minimum (${minDuration}m).`,
    };
  }

  if (!options.allowPast && start.getTime() < Date.now() - 60000) {
    return {
      isValid: false,
      errorCode: "APPOINTMENT_IN_PAST",
      errorMessage: "Cannot schedule or validate appointment in the past.",
    };
  }

  return {
    isValid: true,
    normalized: { start, end },
  };
}

/**
 * Deterministically validates member communication consent.
 */
export function validateMemberCommunicationConsent(params: {
  consentOutreach: boolean;
  consentSms: boolean;
  channel: string;
}): ValidationResult<{ channel: string }> {
  const channel = params.channel.toUpperCase();

  if (!params.consentOutreach) {
    return {
      isValid: false,
      errorCode: "CONSENT_OUTREACH_DENIED",
      errorMessage: "Member outreach consent is not granted. External outreach is blocked.",
    };
  }

  if (channel === "SMS" && !params.consentSms) {
    return {
      isValid: false,
      errorCode: "CONSENT_SMS_DENIED",
      errorMessage: "SMS consent is false; messages must be routed to Phone, Portal, or Email.",
    };
  }

  return {
    isValid: true,
    normalized: { channel },
  };
}

/**
 * Deterministically validates case state machine transitions.
 */
export function validateStateMachineTransition(
  fromStatus: string,
  toStatus: string
): ValidationResult<{ from: CaseStatus; to: CaseStatus }> {
  const from = fromStatus as CaseStatus;
  const to = toStatus as CaseStatus;

  if (!canTransitionCaseStatus(from, to)) {
    const allowed = getAllowedNextCaseStatuses(from);
    return {
      isValid: false,
      errorCode: "INVALID_STATE_TRANSITION",
      errorMessage: `Illegal transition from ${from} to ${to}. Allowed states: [${allowed.join(", ")}].`,
    };
  }

  try {
    validateAgentProposedTransition(from, to);
    return {
      isValid: true,
      normalized: { from, to },
    };
  } catch (err) {
    return {
      isValid: false,
      errorCode: "ILLEGAL_AGENT_TRANSITION",
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}
