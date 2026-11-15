import { beforeAll, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { createSessionToken, SESSION_COOKIE_NAME, SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getPayerRoiAnalytics } from "@/services/analytics-service";

const mockCookieMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieMap.get(name);
      return value ? { name, value } : undefined;
    },
  }),
}));

import { GET as getRoiRoute, POST as postRoiRoute } from "@/app/api/analytics/roi/route";

describe("Payer ROI & Value Realization API Integration Tests", () => {
  let horizonTenantId = "";
  let adminSession: SessionUser;
  let adminToken = "";

  beforeAll(async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    horizonTenantId = horizon.id;

    const admin = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizonTenantId, role: UserRole.ADMIN },
    });

    adminSession = {
      userId: admin.id,
      tenantId: horizon.id,
      tenantSlug: horizon.slug,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    adminToken = await createSessionToken(adminSession);
  });

  it("calculates real payer ROI from seeded database records via service", async () => {
    const report = await getPayerRoiAnalytics(horizonTenantId);

    expect(report.totalReferralsEvaluated).toBeGreaterThan(0);
    expect(report.overallCompletionRatePct).toBeGreaterThan(0);
    expect(report.staffHoursSaved).toBeGreaterThan(0);
    expect(report.careManagerCapacityMultiplier).toBe(4.4);
    expect(report.hedisScorecard).toBeDefined();
    expect(report.cmsHealthEquityIndex).toBeDefined();
  });

  it("enforces authentication on GET /api/analytics/roi (401)", async () => {
    mockCookieMap.clear();
    const req = new Request("http://localhost/api/analytics/roi");
    const res = await getRoiRoute(req);
    expect(res.status).toBe(401);
  });

  it("returns value realization report on GET and accepts custom assumptions on POST", async () => {
    mockCookieMap.set(SESSION_COOKIE_NAME, adminToken);

    // GET endpoint
    const getReq = new Request("http://localhost/api/analytics/roi");
    const getRes = await getRoiRoute(getReq);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.totalReferralsEvaluated).toBeGreaterThan(0);
    expect(getData.careManagerCapacityMultiplier).toBe(4.4);

    // POST endpoint with custom regional assumptions
    const postReq = new Request("http://localhost/api/analytics/roi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        costPerPsychiatricEdVisit: 2200,
        costPerInpatientPsychiatricStay: 16500,
      }),
    });
    const postRes = await postRoiRoute(postReq);
    expect(postRes.status).toBe(200);
    const postData = await postRes.json();
    expect(postData.actuarialAssumptionsUsed.costPerPsychiatricEdVisit).toBe(2200);
    expect(postData.actuarialAssumptionsUsed.costPerInpatientPsychiatricStay).toBe(16500);
  });
});
