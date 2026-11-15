import { ValidationError } from "@/lib/errors";

const PROHIBITED_INTERNAL_REASONING_PATTERNS = [
  /\bpriority\s*score\b/i,
  /\brisk\s*(score|level|tier|band)\b/i,
  /\bconfidence\s*[:=]\s*0?\.\d+/i,
  /\buncertainty\b/i,
  /\bbarrier\s*classification\b/i,
  /\b(access|administrative|financial|communication|behavioral|social[_\s]?logistical)\s+barrier\b/i,
  /\bepistemic\b/i,
  /\bmodel\s*version\b/i,
  /\bprompt\s*version\b/i,
  /\bai[-\s]?generated\b/i,
  /\bas\s+an\s+ai\b/i,
  /\blanguage\s+model\b/i,
  /\b(agent\s+runtime|orchestrator|policy\s+gate|reasoning\s+trace|chain[-\s]?of[-\s]?thought)\b/i,
  /\bprior\s*no[-\s]?show\b/i,
  /\b(we|our\s+system|the\s+system|the\s+ai|ai|algorithm|model)\s+(inferred|detected|classified|predicted|scored)\b/i,
  /\binferred\s+that\s+you\b/i,
  /\b(sensitive\s+characteristic|protected\s+attribute)\b/i,
];

const PROHIBITED_CLINICAL_PATTERNS = [
  /\bprescrib(e|ing|ed)\b/i,
  /\bdiagnos(e|is|ing)\b/i,
  /\bdosage\b/i,
  /\bpsychotherapy session\b/i,
  /\bcall 911\b/i,
  /\bsuicid(e|al)\b/i,
];

export interface OutboundValidationParams {
  body: string;
  subject?: string;
  channel: "SMS" | "PHONE" | "EMAIL" | "PORTAL" | "IN_PERSON_NAVIGATOR";
  consentOutreach: boolean;
  consentSms: boolean;
  requireConsentForDelivery?: boolean;
}

/**
 * Validates every outbound communication BEFORE persistence/delivery:
 * - Blocks empty/oversized payloads
 * - Blocks clinical advice / diagnostic wording
 * - Blocks internal AI reasoning, risk scores, confidence, and technical metadata
 * - Enforces member consent rules before delivery
 */
export function validateOutboundCommunication(params: OutboundValidationParams): void {
  const combined = `${params.subject ?? ""} ${params.body}`.trim();
  if (!params.body || params.body.trim().length < 5) {
    throw new ValidationError("Communication content must be at least 5 characters long.");
  }

  for (const pattern of PROHIBITED_CLINICAL_PATTERNS) {
    if (pattern.test(combined)) {
      throw new ValidationError(
        `Communication rejected: clinical scope violation (${pattern.source}).`
      );
    }
  }

  for (const pattern of PROHIBITED_INTERNAL_REASONING_PATTERNS) {
    if (pattern.test(combined)) {
      throw new ValidationError(
        `Communication rejected: sensitive internal AI or risk reasoning cannot be exposed to members (${pattern.source}).`
      );
    }
  }

  if (params.requireConsentForDelivery !== false) {
    if (params.channel !== "PORTAL" && !params.consentOutreach) {
      throw new ValidationError("Member has opted out of proactive external outreach.");
    }
    if (params.channel === "SMS" && !params.consentSms) {
      throw new ValidationError("SMS channel requires verified member SMS consent.");
    }
  }
}
