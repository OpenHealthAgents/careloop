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

import { GET as getFounderDemoRoute } from "@/app/api/demo/founder/route";

describe("Founder Demo Mode Integration Tests", () => {
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

  it("rejects unauthenticated requests with 401", async () => {
    mockCookieMap.clear();
    const req = new Request("http://localhost:3000/api/demo/founder");
    const res = await getFounderDemoRoute(req);
    expect(res.status).toBe(401);
  });

  it("serves full 7-scene founder demonstration payload for authenticated care managers", async () => {
    mockCookieMap.set(SESSION_COOKIE_NAME, cmToken);
    const req = new Request("http://localhost:3000/api/demo/founder?batchSize=600");
    const res = await getFounderDemoRoute(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.environment).toBe("CareLoop Founder Demo Lab");
    expect(json.demo.overview.title).toContain("Founder Demonstration Script");
    expect(json.demo.scenes).toHaveLength(7);
    expect(json.demo.summaryKpis.totalReferralsIngested).toBe(600);
    expect(json.guarantees.scriptedFounderNarrative).toBe(true);
    expect(json.guarantees.zeroRealPhi).toBe(true);
  });

  it("filters to a specific scene when requested via query parameter", async () => {
    mockCookieMap.set(SESSION_COOKIE_NAME, cmToken);

    // Test Scene 3: Agent Execution
    const reqScene3 = new Request("http://localhost:3000/api/demo/founder?scene=agent_execution");
    const resScene3 = await getFounderDemoRoute(reqScene3);
    expect(resScene3.status).toBe(200);
    const jsonScene3 = await resScene3.json();
    expect(jsonScene3.scene.id).toBe("agent_execution");
    expect(jsonScene3.scene.liveData.caseId).toBe("CASE-8821");
    expect(jsonScene3.scene.liveData.goal).toBeDefined();
    expect(jsonScene3.scene.liveData.tool).toBeDefined();

    // Test Scene 4: Human Intervention
    const reqScene4 = new Request("http://localhost:3000/api/demo/founder?scene=human_intervention");
    const resScene4 = await getFounderDemoRoute(reqScene4);
    expect(resScene4.status).toBe(200);
    const jsonScene4 = await resScene4.json();
    expect(jsonScene4.scene.id).toBe("human_intervention");
    expect(jsonScene4.scene.liveData.encounteredPolicy.verdict).toBe("REQUIRE_HUMAN_APPROVAL");
    expect(jsonScene4.scene.liveData.careManagerWorkbench).toBeDefined();
  });
});
