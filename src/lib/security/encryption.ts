import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getConfig } from "@/lib/config";
import { ValidationError } from "@/lib/errors";

const ENVELOPE_PREFIX = "v1";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

function deriveEncryptionKey(overrideKey?: string): Buffer {
  const config = getConfig();
  const rawMaterial = overrideKey ?? config.PHI_ENCRYPTION_KEY ?? config.AUTH_SECRET;
  if (!rawMaterial || rawMaterial.length < 16) {
    throw new ValidationError("Encryption key material is missing or too short.");
  }
  return createHash("sha256").update(rawMaterial, "utf8").digest();
}

/**
 * Encrypts sensitive PHI/secret strings at rest using AES-256-GCM
 * with a random 96-bit IV and 128-bit authentication tag.
 */
export function encryptAtRest(plaintext: string, overrideKey?: string): string {
  const key = deriveEncryptionKey(overrideKey);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENVELOPE_PREFIX,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

/**
 * Decrypts and authenticates an AES-256-GCM envelope produced by `encryptAtRest`.
 * Throws ValidationError if the envelope is malformed or tampered with.
 */
export function decryptAtRest(envelope: string, overrideKey?: string): string {
  const parts = envelope.split(":");
  if (parts.length !== 4 || parts[0] !== ENVELOPE_PREFIX) {
    throw new ValidationError("Invalid encrypted envelope format.");
  }

  const [, ivB64, tagB64, cipherB64] = parts;
  const iv = Buffer.from(ivB64, "base64url");
  const authTag = Buffer.from(tagB64, "base64url");
  const ciphertext = Buffer.from(cipherB64, "base64url");

  if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new ValidationError("Invalid encrypted envelope parameters.");
  }

  const key = deriveEncryptionKey(overrideKey);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    throw new ValidationError("Encrypted payload failed authentication or key check.");
  }
}
