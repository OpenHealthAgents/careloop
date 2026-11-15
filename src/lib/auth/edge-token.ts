/**
 * Edge-compatible HMAC-SHA256 session token verification using Web Crypto.
 * Used by Next.js middleware before route handlers execute.
 */

export const SESSION_COOKIE_NAME = "careloop_session";

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64Url.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function verifySessionTokenEdge(
  token: string | undefined | null,
  secret: string
): Promise<{ userId: string; tenantId: string; role: string; exp: number } | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  try {
    const encoder = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = base64UrlToUint8Array(sigB64);
    const valid = await globalThis.crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes.buffer as ArrayBuffer,
      encoder.encode(payloadB64)
    );
    if (!valid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlToUint8Array(payloadB64));
    const parsed = JSON.parse(payloadJson) as {
      userId?: string;
      tenantId?: string;
      role?: string;
      exp?: number;
    };
    if (!parsed.userId || !parsed.tenantId || !parsed.role || !parsed.exp) return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      userId: parsed.userId,
      tenantId: parsed.tenantId,
      role: parsed.role,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}
