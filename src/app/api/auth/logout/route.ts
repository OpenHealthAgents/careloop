import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCorrelationId } from "@/lib/auth/request-context";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAuditEvent } from "@/services/audit-service";

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);

  if (session?.sid) {
    await prisma.userSession.updateMany({
      where: { id: session.sid, tenantId: session.tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await recordAuditEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "USER_LOGOUT",
      entityType: "UserSession",
      entityId: session.sid,
      correlationId,
      summary: "User signed out and revoked active session",
    });
  }

  const isHttps =
    request.headers.get("x-forwarded-proto") === "https" ||
    request.url.startsWith("https://");

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: 0,
  });
  return res;
}
