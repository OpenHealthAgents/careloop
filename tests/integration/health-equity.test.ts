import { beforeAll, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const mockCookieMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieMap.get(name);
      return value ? { name, value } : undefined;
    },
  }),
}));

import { GET as getEquityRoute } from "@/app/api/analytics/equity/route";

describe("Health Equity API Integration — Cohort Comparison, Insights & Sample Caution", () => {
  let equityToken = "";

  beforeAll(async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    const equityUser = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizon.id, role: UserRole.HEALTH_EQUITY },
    });
    equityToken = createSessionToken({
      userId: equityUser.id,
      tenantId: horizon.id,
      tenantSlug: horizon.slug,
      email: equityUser.email,
      name: equityUser.name,
      role: equityUser.role,
    });
  });

  it("returns cohort comparisons, sample-size caution flags, and answers to all 6 equity questions", async () => {
    mockCookieMap.set(SESSION_COOKIE_NAME, equityToken);

    const res = await getEquityRoute(
      new Request(
        "http://localhost/api/analytics/equity?compareA=preferredLanguage::Spanish&compareB=preferredLanguage::English"
      )
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.minReliableCohortSize).toBe(5);
    expect(body.insights.lowestCompletionCohorts.length).toBeGreaterThanOrEqual(1);
    expect(body.insights.mostCommonBarriers.length).toBeGreaterThanOrEqual(1);
    expect(body.comparison.cohortA.cohort).toBe("Spanish");
    expect(body.comparison.cohortB.cohort).toBe("English");
    expect(typeof body.comparison.deltas.completionRateDiffPctPts).toBe("number");
    expect(body.comparison.deltas).toHaveProperty("avgTimeToAppointmentDiffDays");
    expect(body.byLanguage[0]).toHaveProperty("avgTimeToAppointmentDays");

    // Privacy protections & no individual-level PHI exposed
    expect(body.privacyProtections).toBeTruthy();
    expect(body.privacyProtections.individualLevelDataExposed).toBe(false);
    expect(body.privacyProtections.minCohortSize).toBe(5);

    // Disparity monitoring for access, completion, time-to-care, and intervention success
    expect(body.disparityMonitoring).toBeTruthy();
    expect(body.disparityMonitoring.disparityInAccess).toBeTruthy();
    expect(body.disparityMonitoring.disparityInCompletion).toBeTruthy();
    expect(body.disparityMonitoring.disparityInTimeToCare).toBeTruthy();
    expect(body.disparityMonitoring.disparityInInterventionSuccess).toBeTruthy();
  });
});
