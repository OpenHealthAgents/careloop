/**
 * PHI-aware structured logger.
 * Strips sensitive member attributes so PHI never leaks into application logs.
 */

const PHI_REDACT_KEYS = new Set([
  "firstname",
  "lastname",
  "fullname",
  "membername",
  "patientname",
  "dob",
  "dateofbirth",
  "dobyear",
  "ssn",
  "phone",
  "phonenumber",
  "email",
  "address",
  "street",
  "zip",
  "zipcode",
  "password",
  "passwordhash",
  "token",
  "secret",
  "authorization",
  "cookie",
  "raceethnicitycohort",
  "clinicalnotes",
  "operationalnotes",
  "evidencenote",
  "rawpayload",
  "messagesummary",
  "memberresponsesummary",
  "draftmessage",
  "content",
  "homeaddress",
]);

export function sanitizeAuditText(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]")
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g, "[REDACTED_PHONE]");
}

export function redactSensitiveFields(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveFields(item));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (PHI_REDACT_KEYS.has(k.toLowerCase())) {
        out[k] = "[REDACTED_PHI_OR_SECRET]";
      } else {
        out[k] = redactSensitiveFields(v);
      }
    }
    return out;
  }
  return value;
}

export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  event: string;
  correlationId?: string;
  tenantId?: string;
  actorId?: string;
  meta?: Record<string, unknown>;
}

const LEVEL_WEIGHT: Record<LogEntry["level"], number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function currentMinLevel(): number {
  const lvl = (process.env.LOG_LEVEL ?? "info").toLowerCase() as LogEntry["level"];
  return LEVEL_WEIGHT[lvl] ?? 20;
}

function writeLog(entry: LogEntry): void {
  if (LEVEL_WEIGHT[entry.level] < currentMinLevel()) return;
  const sanitized: LogEntry = {
    ...entry,
    meta: entry.meta ? (redactSensitiveFields(entry.meta) as Record<string, unknown>) : undefined,
  };
  const line = JSON.stringify(sanitized);
  if (entry.level === "error") {
    console.error(line);
  } else if (entry.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug(event: string, meta?: Record<string, unknown>, context?: { correlationId?: string; tenantId?: string; actorId?: string }) {
    writeLog({ timestamp: new Date().toISOString(), level: "debug", event, ...context, meta });
  },
  info(event: string, meta?: Record<string, unknown>, context?: { correlationId?: string; tenantId?: string; actorId?: string }) {
    writeLog({ timestamp: new Date().toISOString(), level: "info", event, ...context, meta });
  },
  warn(event: string, meta?: Record<string, unknown>, context?: { correlationId?: string; tenantId?: string; actorId?: string }) {
    writeLog({ timestamp: new Date().toISOString(), level: "warn", event, ...context, meta });
  },
  error(event: string, meta?: Record<string, unknown>, context?: { correlationId?: string; tenantId?: string; actorId?: string }) {
    writeLog({ timestamp: new Date().toISOString(), level: "error", event, ...context, meta });
  },
};
