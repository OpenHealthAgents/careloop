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

import { GET as getDemoRoute } from "@/app/api/demo/route";
import { GET as getDemoScenarioRoute } from "@/app/api/demo/scenario/route";

describe("Demo Environment Showcase Integration Tests", () => {
  let horizonTenantId = "";
  let cmToken = "";

  beforeAll(async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    horizonTenantId = horizon.id;

    const cm = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizonTenantId, role: UserRole.CARE_MANAGER },
    });

    cmToken = createSessionToken({
      userId: cm.id,
      tenantId: horizon.id,
      tenantSlug: horizon.slug,
      email: cm.email,
      name: cm.name,
      role: cm.role,
    });
  });

  describe("GET /api/demo", () => {
    it("rejects unauthorized access when session token is missing", async () => {
      mockCookieMap.clear();
      const req = new Request("http://localhost:3000/api/demo");
      const res = await getDemoRoute(req);
      expect(res.status).toBe(401);
    });

    it("serves synthetic population summary and multi-stakeholder briefs for authenticated requests", async () => {
      mockCookieMap.set(SESSION_COOKIE_NAME, cmToken);
      const req = new Request("http://localhost:3000/api/demo?seed=2026&count=2000");
      const res = await getDemoRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.environment).toBe("CareLoop Demo & Evaluation Lab");
      expect(json.seed).toBe(2026);
      expect(json.syntheticPopulationSize).toBe(2000);
      expect(json.summary.totalMembers).toBe(2000);
      expect(json.summary.verifiedCompletionsCount).toBeGreaterThan(1200);
      expect(json.sampleMembers).toHaveLength(10);
      expect(json.guarantees.zeroRealPhi).toBe(true);

      // Verify all 5 stakeholder briefs are included in API response
      expect(json.stakeholderBriefs).toHaveProperty("payerExecutives");
      expect(json.stakeholderBriefs).toHaveProperty("careManagers");
      expect(json.stakeholderBriefs).toHaveProperty("healthEquityLeaders");
      expect(json.stakeholderBriefs).toHaveProperty("investors");
      expect(json.stakeholderBriefs).toHaveProperty("healthcareOperators");
    });
  });

  describe("GET /api/demo/scenario", () => {
    it("rejects unauthorized access when session token is missing", async () => {
      mockCookieMap.clear();
      const req = new Request("http://localhost:3000/api/demo/scenario");
      const res = await getDemoScenarioRoute(req);
      expect(res.status).toBe(401);
    });

    it("serves the complete 11-step execution timeline and healthcare baseline comparison", async () => {
      mockCookieMap.set(SESSION_COOKIE_NAME, cmToken);
      const req = new Request("http://localhost:3000/api/demo/scenario");
      const res = await getDemoScenarioRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.scenario.scenarioId).toBe("demo-showcase-01");
      expect(json.scenario.timeline).toHaveLength(11);
      expect(json.executionStats.totalSteps).toBe(11);
      expect(json.executionStats.totalTokens).toBeLessThanOrEqual(800);
      expect(json.executionStats.totalComputeCostUSD).toBeLessThan(0.001);
      expect(json.executionStats.totalDaysToCare).toBe(5);
      expect(json.executionStats.traditionalCareDaysToAppointment).toBe(48);
      expect(json.executionStats.careLoopCareManagerAdminMinutes).toBe(8);
      expect(json.executionStats.traditionalCareManagerAdminMinutes).toBe(240);
      expect(json.guarantees.tamperEvidentAuditTrail).toBe(true);
    });
  });
});
