import { beforeAll, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { evaluatePilotStudy } from "@/services/pilot-service";

const mockCookieMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieMap.get(name);
      return value ? { name, value } : undefined;
    },
  }),
}));

import { GET as getPilotRoute, POST as postPilotRoute } from "@/app/api/pilot/route";

describe("Pilot Mode & Measurement Framework Integration Tests", () => {
  let horizonTenantId = "";
  let careManagerToken = "";

  beforeAll(async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    horizonTenantId = horizon.id;

    const cm = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizonTenantId, role: UserRole.CARE_MANAGER },
    });

    careManagerToken = createSessionToken({
      userId: cm.id,
      tenantId: horizon.id,
      tenantSlug: horizon.slug,
      email: cm.email,
      name: cm.name,
      role: cm.role,
    });
  });

  describe("evaluatePilotStudy Service", () => {
    it("evaluates a 10,000 member pilot cohort and generates complete comparative metrics and executive takeaways", () => {
      const result = evaluatePilotStudy({ totalPopulation: 10000, durationMonths: 6, seed: 101 });

      expect(result.config.targetPopulationSize).toBe(10000);
      expect(result.config.studyDurationMonths).toBe(6);
      expect(result.statisticalPower.isAdequatelyPowered).toBe(true);

      // Primary Endpoint
      expect(result.measurement.primaryEndpoint.interventionRatePct).toBeGreaterThan(
        result.measurement.primaryEndpoint.controlRatePct
      );
      expect(result.measurement.primaryEndpoint.isStatisticallySignificant).toBe(true);
      expect(result.measurement.primaryEndpoint.pValue).toBeLessThan(0.001);

      // Executive Takeaways
      expect(result.executiveTakeaway.headline).toContain("CareLoop achieved a");
      expect(result.executiveTakeaway.clinicalImpact).toContain("accelerated by");
      expect(result.executiveTakeaway.equityImpact).toBeTruthy();
      expect(result.executiveTakeaway.economicImpact).toContain("net ROI");
    });
  });

  describe("API Endpoints /api/pilot", () => {
    it("rejects unauthenticated requests with 401", async () => {
      mockCookieMap.clear();
      const req = new Request("http://localhost:3000/api/pilot");
      const res = await getPilotRoute(req);
      expect(res.status).toBe(401);
    });

    it("GET /api/pilot returns evaluated pilot measurement report for authenticated users", async () => {
      mockCookieMap.set(SESSION_COOKIE_NAME, careManagerToken);
      const req = new Request("http://localhost:3000/api/pilot?population=2000&duration=3&seed=77");
      const res = await getPilotRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.config.targetPopulationSize).toBe(2000);
      expect(json.config.studyDurationMonths).toBe(3);
      expect(
        json.measurement.arms.intervention.totalReferrals + json.measurement.arms.control.totalReferrals
      ).toBe(2000);
      expect(json.measurement.primaryEndpoint.absoluteLiftPctPoints).toBeGreaterThan(0);
    });

    it("POST /api/pilot returns customized pilot cohort evaluation", async () => {
      mockCookieMap.set(SESSION_COOKIE_NAME, careManagerToken);
      const req = new Request("http://localhost:3000/api/pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalPopulation: 1500, durationMonths: 6, seed: 99 }),
      });
      const res = await postPilotRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.config.targetPopulationSize).toBe(1500);
      expect(json.measurement.primaryEndpoint.isStatisticallySignificant).toBe(true);
    });
  });
});
