import { beforeAll, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { evaluateMultiArmExperiment } from "@/services/experimentation-service";

const mockCookieMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieMap.get(name);
      return value ? { name, value } : undefined;
    },
  }),
}));

import {
  GET as getPilotExperimentsRoute,
  POST as postPilotExperimentsRoute,
} from "@/app/api/pilot/experiments/route";

describe("Agentic Pilot Experimentation Integration Tests", () => {
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

  describe("Service Layer: evaluateMultiArmExperiment", () => {
    it("runs 4-arm comparative experiment and generates rankings and trade-off analysis", () => {
      const result = evaluateMultiArmExperiment({ totalPopulation: 2000, durationMonths: 6, seed: 42 });

      expect(result.report.metadata.totalEligiblePopulation).toBe(2000);
      expect(result.report.arms.INTERVENTION_A).toBeDefined();
      expect(result.report.arms.INTERVENTION_B).toBeDefined();
      expect(result.report.arms.HUMAN_ASSISTED).toBeDefined();
      expect(result.report.arms.USUAL_CARE).toBeDefined();

      // Check trade-off analysis
      expect(result.tradeOffAnalysis.autonomousVsHuman).toContain("Intervention A achieves");
      expect(result.tradeOffAnalysis.modalitiesComparison).toContain("Intervention B");
      expect(result.tradeOffAnalysis.executiveRecommendation).toContain("Recommend tiered hybrid routing");

      // Check rankings
      expect(result.report.armRankings.highestCompletion).toBeDefined();
      expect(result.report.armRankings.fastestTimeToCare).toBeDefined();
      expect(result.report.armRankings.lowestCostPerCompleted).toBeDefined();
    });
  });

  describe("API Endpoint /api/pilot/experiments", () => {
    it("rejects unauthenticated requests with 401", async () => {
      mockCookieMap.clear();
      const req = new Request("http://localhost:3000/api/pilot/experiments");
      const res = await getPilotExperimentsRoute(req);
      expect(res.status).toBe(401);
    });

    it("GET /api/pilot/experiments returns 4-arm comparative metrics for authenticated user", async () => {
      mockCookieMap.set(SESSION_COOKIE_NAME, careManagerToken);
      const req = new Request("http://localhost:3000/api/pilot/experiments?population=1200&duration=6&seed=55");
      const res = await getPilotExperimentsRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.report.metadata.totalEligiblePopulation).toBe(1200);
      expect(json.report.arms.INTERVENTION_A.completion.isStatisticallySignificant).toBe(true);
      expect(json.tradeOffAnalysis.executiveRecommendation).toBeTruthy();
    });

    it("POST /api/pilot/experiments supports custom arm weighting and returns valid evaluation", async () => {
      mockCookieMap.set(SESSION_COOKIE_NAME, careManagerToken);
      const req = new Request("http://localhost:3000/api/pilot/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalPopulation: 1000,
          durationMonths: 3,
          seed: 77,
          armWeights: {
            INTERVENTION_A: 2,
            INTERVENTION_B: 2,
            HUMAN_ASSISTED: 1,
            USUAL_CARE: 1,
          },
        }),
      });

      const res = await postPilotExperimentsRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.report.metadata.totalEligiblePopulation).toBe(1000);
      expect(json.report.arms.INTERVENTION_A.totalReferrals).toBeGreaterThan(
        json.report.arms.HUMAN_ASSISTED.totalReferrals
      );
    });
  });
});
