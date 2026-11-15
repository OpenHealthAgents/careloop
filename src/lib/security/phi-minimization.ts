const DIRECT_PHI_KEYS = new Set([
  "firstname",
  "lastname",
  "fullname",
  "membername",
  "patientname",
  "name",
  "email",
  "phone",
  "phonenumber",
  "mobile",
  "ssn",
  "socialsecuritynumber",
  "dob",
  "dateofbirth",
  "birthdate",
  "dobyear",
  "address",
  "street",
  "streetaddress",
  "zipcode",
  "postalcode",
  "externalmemberid",
  "memberid",
  "mrn",
  "medicaidid",
  "policyid",
  "password",
  "passwordhash",
  "apikey",
  "secret",
  "token",
]);

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_PATTERN = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;

function redactInlineIdentifiers(text: string): string {
  return text
    .replace(EMAIL_PATTERN, "[REDACTED_EMAIL]")
    .replace(PHONE_PATTERN, "[REDACTED_PHONE]")
    .replace(SSN_PATTERN, "[REDACTED_SSN]");
}

/**
 * Minimizes any payload before transmission to an LLM:
 * - Drops direct patient/member identifiers (names, DOB, SSN, email, phone, address, member IDs)
 * - Drops secrets/tokens/password fields
 * - Redacts inline email/phone/SSN patterns in remaining strings
 * Preserves only minimum necessary operational context.
 */
export function minimizePayloadForLLM<T>(payload: T): T {
  if (payload === null || payload === undefined) return payload;
  if (typeof payload === "string") {
    return redactInlineIdentifiers(payload) as unknown as T;
  }
  if (Array.isArray(payload)) {
    return payload.map((item) => minimizePayloadForLLM(item)) as unknown as T;
  }
  if (typeof payload === "object" && !(payload instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (DIRECT_PHI_KEYS.has(key.toLowerCase())) {
        continue;
      }
      out[key] = minimizePayloadForLLM(value);
    }
    return out as T;
  }
  return payload;
}

/**
 * Redacts credentials, bearer tokens, and secret environment values from log/error strings.
 */
export function redactSecrets(input: string): string {
  return input
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[REDACTED_API_KEY]")
    .replace(/(postgresql|postgres|mysql|redis):\/\/[^:\s]+:[^@\s]+@/gi, "$1://[REDACTED]:[REDACTED]@");
}
