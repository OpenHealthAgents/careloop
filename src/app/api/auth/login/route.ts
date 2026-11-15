import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import { getPermissionsForRole } from "@/lib/auth/rbac";
import { getCorrelationId, toErrorResponse } from "@/lib/auth/request-context";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AuthenticationError } from "@/lib/errors";
import { recordAuditEvent } from "@/services/audit-service";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().default("horizon-bh"),
});

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    const body = LoginSchema.parse(await request.json());

    const tenant = await prisma.tenant.findUnique({ where: { slug: body.tenantSlug } });
    if (!tenant) {
      throw new AuthenticationError("Invalid credentials");
    }

    const user = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: body.email.toLowerCase(),
        },
      },
    });

    if (!user || !user.active || !verifyPassword(body.password, user.passwordHash)) {
      await recordAuditEvent({
        tenantId: tenant.id,
        actorId: user?.id ?? null,
        actorEmail: body.email.toLowerCase(),
        actorRole: user?.role ?? "ANONYMOUS",
        action: "USER_LOGIN_FAILED",
        entityType: "UserSession",
        entityId: user?.id ?? "UNKNOWN",
        source: "AUTH",
        correlationId,
        summary: `Failed sign-in attempt (${!user ? "unknown_account" : !user.active ? "inactive_account" : "invalid_password"})`,
        metadata: {
          reason: !user ? "unknown_account" : !user.active ? "inactive_account" : "invalid_password",
        },
      });
      throw new AuthenticationError("Invalid email or password");
    }

    const tenantSettings = (tenant.settings as Record<string, unknown>) ?? {};
    const maxAgeHoursRaw = Number(tenantSettings.sessionMaxAgeHours ?? 12);
    const maxAgeHours = Number.isFinite(maxAgeHoursRaw) && maxAgeHoursRaw >= 1 && maxAgeHoursRaw <= 24 ? maxAgeHoursRaw : 12;
    const ttlSeconds = 60 * 60 * maxAgeHours;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const dbSession = await prisma.userSession.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        expiresAt,
        userAgent: request.headers.get("user-agent")?.slice(0, 200) ?? null,
      },
    });

    const token = createSessionToken(
      {
        sid: dbSession.id,
        userId: user.id,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        email: user.email,
        name: user.name,
        role: user.role,
        customRoleCode: user.customRoleCode,
      },
      ttlSeconds
    );

    await recordAuditEvent({
      tenantId: tenant.id,
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: "USER_LOGIN",
      entityType: "UserSession",
      entityId: dbSession.id,
      source: "AUTH",
      newState: { sessionId: dbSession.id, role: user.role, ttlSeconds },
      correlationId,
      summary: `User signed in with role ${user.role}`,
    });

    const res = NextResponse.json({
      user: {
        userId: user.id,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: getPermissionsForRole(user.role, user.customRoleCode),
      },
    });

    const isHttps =
      request.headers.get("x-forwarded-proto") === "https" ||
      request.url.startsWith("https://");

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: ttlSeconds,
    });

    return res;
  } catch (err) {
    return toErrorResponse(err, correlationId);
  }
}
