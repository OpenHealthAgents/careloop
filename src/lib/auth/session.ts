import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { UserRole } from "@prisma/client";
import { getConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import type { Permission } from "./rbac";

export const SESSION_COOKIE_NAME = "careloop_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export interface SessionUser {
  sid?: string;
  userId: string;
  tenantId: string;
  tenantSlug: string;
  email: string;
  name: string;
  role: UserRole;
  customRoleCode?: string | null;
  isServiceIdentity?: boolean;
  scopedPermissions?: Permission[];
  exp: number;
}

function signPayload(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function createSessionToken(
  user: Omit<SessionUser, "exp">,
  ttlSeconds = SESSION_TTL_SECONDS
): string {
  const config = getConfig();
  const payload: SessionUser = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(payloadB64, config.AUTH_SECRET);
  return `${payloadB64}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, providedSig] = parts;
  if (!payloadB64 || !providedSig) return null;

  const config = getConfig();
  const expectedSig = signPayload(payloadB64, config.AUTH_SECRET);
  const providedBuf = Buffer.from(providedSig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(providedBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as SessionUser;
    if (!parsed.userId || !parsed.tenantId || !parsed.role || !parsed.exp) return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getCurrentSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const verified = verifySessionToken(token);
  if (!verified) return null;

  // When a DB-backed session ID is present, verify it is unrevoked and user is active.
  if (verified.sid) {
    const dbSession = await prisma.userSession.findUnique({
      where: { id: verified.sid },
      include: {
        user: {
          select: { id: true, tenantId: true, active: true, role: true, customRoleCode: true },
        },
      },
    });
    if (
      !dbSession ||
      dbSession.revokedAt !== null ||
      dbSession.expiresAt <= new Date() ||
      !dbSession.user.active ||
      dbSession.user.tenantId !== verified.tenantId
    ) {
      return null;
    }
    return {
      ...verified,
      role: dbSession.user.role,
      customRoleCode: dbSession.user.customRoleCode,
    };
  }

  return verified;
}
