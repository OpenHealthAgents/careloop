import { getConfig } from "@/lib/config";
import { AuthorizationError, ValidationError } from "@/lib/errors";

export const SECURITY_TRANSPORT_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
};

/**
 * Enforces encryption in transit (HTTPS) for external vendor endpoints.
 * Localhost HTTP is permitted only in non-production environments.
 */
export function assertSecureTransportUrl(rawUrl: string, label = "External endpoint"): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ValidationError(`${label} URL is invalid.`);
  }

  const isLocalhost =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1";

  const config = getConfig();
  if (parsed.protocol !== "https:") {
    if (config.NODE_ENV === "production" || !isLocalhost) {
      throw new ValidationError(
        `${label} must use HTTPS encryption in transit (received '${parsed.protocol}').`
      );
    }
  }

  return parsed;
}

/**
 * Enforces vendor/BAA boundary before transmitting any operational context
 * to an external AI/LLM vendor.
 */
export function assertVendorBaaBoundary(options?: {
  vendorName?: string;
  baaAttested?: boolean;
  enforceAlways?: boolean;
}): void {
  const config = getConfig();
  const vendor = options?.vendorName ?? config.AI_VENDOR_NAME;
  const baaAttested = options?.baaAttested ?? config.AI_BAA_EXECUTED;
  const shouldEnforce = Boolean(options?.enforceAlways) || config.NODE_ENV === "production";

  if (shouldEnforce && !baaAttested) {
    throw new AuthorizationError(
      `Vendor/BAA boundary violation: external AI transmission to '${vendor}' is blocked without an attested Business Associate Agreement (AI_BAA_EXECUTED=true).`
    );
  }
}
