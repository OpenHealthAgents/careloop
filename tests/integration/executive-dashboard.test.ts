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

import { GET as getDashboardRoute } from "@/app/api/dashboard/route";

describe("Executive Dashboard API Integration — Filters, Reconciliation & Tenant Isolation", () => {
  let execToken = "";
  let pacificToken = "";

  beforeAll(async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    const pacific = await prisma.tenant.findUniqueOrThrow({ where: { slug: "pacific-medicare" } });

    const exec = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizon.id, role: UserRole.EXECUTIVE_READ_ONLY },
    });
    const pacExec = await prisma.user.findFirstOrThrow({
      where: { tenantId: pacific.id, role: UserRole.ADMIN },
    });

    execToken = createSessionToken({
      userId: exec.id,
      tenantId: horizon.id,
      tenantSlug: horizon.slug,
      email: exec.email,
      name: exec.name,
      role: exec.role,
    });
    pacificToken = createSessionToken({
      userId: pacExec.id,
      tenantId: pacific.id,
      tenantSlug: pacific.slug,
      email: pacExec.email,
      name: pacExec.name,
      role: pacExec.role,
    });
  });

  it("returns complete executive KPIs reconcilable to source rows and supports multi-dimensional filters", async () => {
    mockCookieMap.set(SESSION_COOKIE_NAME, execToken);

    const baseRes = await getDashboardRoute(new Request("http://localhost/api/dashboard"));
    expect(baseRes.status).toBe(200);
    const base = await baseRes.json();

    expect(base.northStar).toBeTruthy();
    expect(base.volume.referralsReceived).toBe(base.reconciliationRows.length);
    expect(typeof base.kpis.activeCasesCount).toBe("number");
    expect(base.efficiency).toHaveProperty("medianTimeToCareDays");
    expect(typeof base.outcomes.unableToReachRatePct).toBe("number");
    expect(typeof base.outcomes.escalationRatePct).toBe("number");
    expect(base.conversion.referralsToAppointments.denominator).toBe(base.volume.referralsReceived);
    expect(base.filterOptions.geographies.length).toBeGreaterThanOrEqual(1);

    // Agentic metrics & governance objective
    expect(base.agenticMetrics).toBeTruthy();
    expect(typeof base.agenticMetrics.agentRuns).toBe("number");
    expect(typeof base.agenticMetrics.successfulRuns).toBe("number");
    expect(typeof base.agenticMetrics.humanHandoffs).toBe("number");
    expect(typeof base.agenticMetrics.approvalRatePct).toBe("number");
    expect(typeof base.agenticMetrics.toolFailureRatePct).toBe("number");
    expect(typeof base.agenticMetrics.averageActionsPerCase).toBe("number");
    expect(typeof base.agenticMetrics.averageTimePerCaseSec).toBe("number");
    expect(typeof base.agenticMetrics.automationRatePct).toBe("number");
    expect(base.agenticMetrics.objective).toContain("equitable care execution");

    // Filtered by population cohort (preferredLanguage = Spanish)
    const filteredRes = await getDashboardRoute(
      new Request(
        "http://localhost/api/dashboard?populationDimension=preferredLanguage&cohortValue=Spanish"
      )
    );
    expect(filteredRes.status).toBe(200);
    const filtered = await filteredRes.json();
    expect(filtered.volume.referralsReceived).toBe(filtered.reconciliationRows.length);
    expect(
      filtered.reconciliationRows.every(
        (r: { preferredLanguage: string }) => r.preferredLanguage === "Spanish"
      )
    ).toBe(true);

    // Pacific tenant isolation
    mockCookieMap.set(SESSION_COOKIE_NAME, pacificToken);
    const pacRes = await getDashboardRoute(new Request("http://localhost/api/dashboard"));
    expect(pacRes.status).toBe(200);
    const pac = await pacRes.json();
    expect(pac.reconciliationRows.length).toBeGreaterThanOrEqual(1);
    const horizonIds = new Set(base.reconciliationRows.map((r: { caseId: string }) => r.caseId));
    expect(pac.reconciliationRows.some((r: { caseId: string }) => horizonIds.has(r.caseId))).toBe(
      false
    );
  });
});
