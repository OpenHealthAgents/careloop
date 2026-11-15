import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { middleware } from "@/middleware";

const mockCookieMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieMap.get(name);
      return value ? { name, value } : undefined;
    },
  }),
}));

import { GET as getHealth } from "@/app/api/health/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { GET as meRoute } from "@/app/api/auth/me/route";
import { GET as getDashboard } from "@/app/api/dashboard/route";
import { GET as getAuditLogs } from "@/app/api/audit-logs/route";
import { POST as ingestReferrals } from "@/app/api/referrals/ingest/route";
import { GET as getEquity } from "@/app/api/analytics/equity/route";
import { GET as getUsers } from "@/app/api/users/route";
import { GET as getCaseById } from "@/app/api/cases/[id]/route";
import { POST as createProvider } from "@/app/api/providers/route";

describe("Authentication, Middleware, Server-Side RBAC & Tenant Isolation", () => {
  it("GET /api/health returns 200 ok with connected database", async () => {
    const res = await getHealth();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("connected");
  });

  it("middleware blocks unauthenticated API requests (401) and redirects protected pages to /login", async () => {
    const apiRes = await middleware(new NextRequest("http://localhost:3000/api/cases"));
    expect(apiRes.status).toBe(401);

    const pageRes = await middleware(new NextRequest("http://localhost:3000/worklist"));
    expect(pageRes.status).toBe(307);
    expect(pageRes.headers.get("location")).toContain("/login");

    const publicLogin = await middleware(new NextRequest("http://localhost:3000/login"));
    expect(publicLogin.status).toBe(200);
  });

  it("supports login -> DB-backed session -> logout revocation", async () => {
    mockCookieMap.clear();
    const loginRes = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "care.manager@careloop.demo",
          password: "CareLoopDemo2026!",
          tenantSlug: "horizon-bh",
        }),
      })
    );
    expect(loginRes.status).toBe(200);
    const cookieVal = loginRes.cookies.get(SESSION_COOKIE_NAME)?.value;
    expect(cookieVal).toBeTruthy();

    mockCookieMap.set(SESSION_COOKIE_NAME, cookieVal!);
    const meRes = await meRoute();
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.user.role).toBe("CARE_MANAGER");
    expect(meBody.user.permissions).toContain("cases.manage");

    // Logout revokes the DB UserSession
    const logoutRes = await logoutRoute(new Request("http://localhost/api/auth/logout", { method: "POST" }));
    expect(logoutRes.status).toBe(200);

    // Reusing the old cookie token after logout MUST fail with 401
    const meAfterLogout = await meRoute();
    expect(meAfterLogout.status).toBe(401);
  });

  it("rejects unauthenticated dashboard requests with 401", async () => {
    mockCookieMap.clear();
    const res = await getDashboard(new Request("http://localhost/api/dashboard"));
    expect(res.status).toBe(401);
  });

  it("enforces RBAC at the API boundary across roles (403 Forbidden)", async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    const execUser = await prisma.user.findFirstOrThrow({
      where: { tenantId: tenant.id, role: UserRole.EXECUTIVE_READ_ONLY },
    });
    const opsUser = await prisma.user.findFirstOrThrow({
      where: { tenantId: tenant.id, role: UserRole.OPERATIONS },
    });
    const equityUser = await prisma.user.findFirstOrThrow({
      where: { tenantId: tenant.id, role: UserRole.HEALTH_EQUITY },
    });

    // 1. EXECUTIVE_READ_ONLY
    mockCookieMap.set(
      SESSION_COOKIE_NAME,
      createSessionToken({
        userId: execUser.id,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        email: execUser.email,
        name: execUser.name,
        role: execUser.role,
      })
    );
    expect((await getDashboard(new Request("http://localhost/api/dashboard"))).status).toBe(200);
    expect((await getEquity(new Request("http://localhost/api/analytics/equity"))).status).toBe(200);
    expect((await getAuditLogs(new Request("http://localhost/api/audit-logs"))).status).toBe(403);
    expect((await getUsers(new Request("http://localhost/api/users"))).status).toBe(403);
    expect(
      (
        await ingestReferrals(
          new Request("http://localhost/api/referrals/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileName: "test.csv", csvText: "a,b\n1,2" }),
          })
        )
      ).status
    ).toBe(403);

    // 2. HEALTH_EQUITY cannot manage providers or users
    mockCookieMap.set(
      SESSION_COOKIE_NAME,
      createSessionToken({
        userId: equityUser.id,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        email: equityUser.email,
        name: equityUser.name,
        role: equityUser.role,
      })
    );
    expect((await getEquity(new Request("http://localhost/api/analytics/equity"))).status).toBe(200);
    expect(
      (
        await createProvider(
          new Request("http://localhost/api/providers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          })
        )
      ).status
    ).toBe(403);

    // 3. OPERATIONS cannot list/manage users or view audit logs
    mockCookieMap.set(
      SESSION_COOKIE_NAME,
      createSessionToken({
        userId: opsUser.id,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        email: opsUser.email,
        name: opsUser.name,
        role: opsUser.role,
      })
    );
    expect((await getUsers(new Request("http://localhost/api/users"))).status).toBe(403);
    expect((await getAuditLogs(new Request("http://localhost/api/audit-logs"))).status).toBe(403);
  });

  it("blocks cross-tenant access even for an authenticated ADMIN of another tenant", async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    const pacific = await prisma.tenant.findUniqueOrThrow({ where: { slug: "pacific-medicare" } });
    const pacificAdmin = await prisma.user.findFirstOrThrow({
      where: { tenantId: pacific.id, role: UserRole.ADMIN },
    });
    const horizonCase = await prisma.case.findFirstOrThrow({ where: { tenantId: horizon.id } });

    mockCookieMap.set(
      SESSION_COOKIE_NAME,
      createSessionToken({
        userId: pacificAdmin.id,
        tenantId: pacific.id,
        tenantSlug: pacific.slug,
        email: pacificAdmin.email,
        name: pacificAdmin.name,
        role: pacificAdmin.role,
      })
    );

    const res = await getCaseById(new Request(`http://localhost/api/cases/${horizonCase.id}`), {
      params: Promise.resolve({ id: horizonCase.id }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 ValidationError for malformed CSV ingestion payload when authorized", async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    const adminUser = await prisma.user.findFirstOrThrow({
      where: { tenantId: tenant.id, role: UserRole.ADMIN },
    });

    mockCookieMap.set(
      SESSION_COOKIE_NAME,
      createSessionToken({
        userId: adminUser.id,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
      })
    );

    const res = await ingestReferrals(
      new Request("http://localhost/api/referrals/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: "empty.csv", csvText: "short" }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
