import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AvailabilitySource, UserRole } from "@prisma/client";
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

import { POST as searchProviders } from "@/app/api/providers/search/route";
import { POST as addAvailability } from "@/app/api/providers/[id]/availability/route";

describe("Provider Search & Availability Integration (PostgreSQL + RBAC + Tenant Isolation)", () => {
  let horizonTenantId = "";
  let pacificTenantId = "";
  let createdSlotId = "";
  let directoryProviderId = "";
  let opsToken = "";
  let pacificAdminToken = "";
  let equityToken = "";

  beforeAll(async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    const pacific = await prisma.tenant.findUniqueOrThrow({ where: { slug: "pacific-medicare" } });
    horizonTenantId = horizon.id;
    pacificTenantId = pacific.id;

    const ops = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizonTenantId, role: UserRole.OPERATIONS },
    });
    const equity = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizonTenantId, role: UserRole.HEALTH_EQUITY },
    });
    const pacAdmin = await prisma.user.findFirstOrThrow({
      where: { tenantId: pacificTenantId, role: UserRole.ADMIN },
    });

    opsToken = createSessionToken({
      userId: ops.id,
      tenantId: horizonTenantId,
      tenantSlug: horizon.slug,
      email: ops.email,
      name: ops.name,
      role: ops.role,
    });
    equityToken = createSessionToken({
      userId: equity.id,
      tenantId: horizonTenantId,
      tenantSlug: horizon.slug,
      email: equity.email,
      name: equity.name,
      role: equity.role,
    });
    pacificAdminToken = createSessionToken({
      userId: pacAdmin.id,
      tenantId: pacificTenantId,
      tenantSlug: pacific.slug,
      email: pacAdmin.email,
      name: pacAdmin.name,
      role: pacAdmin.role,
    });

    const dirProv = await prisma.provider.findFirstOrThrow({
      where: { tenantId: horizonTenantId, availabilitySource: AvailabilitySource.DIRECTORY_INFORMATION },
    });
    directoryProviderId = dirProv.id;
  });

  afterAll(async () => {
    if (createdSlotId) {
      await prisma.providerAvailability.deleteMany({ where: { id: createdSlotId } });
      // Restore directoryProviderId back to DIRECTORY_INFORMATION
      await prisma.provider.update({
        where: { id: directoryProviderId },
        data: {
          availabilitySource: AvailabilitySource.DIRECTORY_INFORMATION,
          nextVerifiedSlotAt: null,
          availabilityLastVerifiedAt: new Date(Date.now() - 21 * 86400000),
        },
      });
    }
  });

  it("searches and ranks providers with VERIFIED AVAILABILITY filter and blocks cross-tenant slot creation", async () => {
    mockCookieMap.set(SESSION_COOKIE_NAME, opsToken);

    const searchRes = await searchProviders(
      new Request("http://localhost/api/providers/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specialty: "Outpatient Behavioral Health",
          network: "Horizon Medicaid",
          geography: "Central Metro",
          language: "Spanish",
          preferredModality: "TELEHEALTH",
          verifiedOnly: true,
        }),
      })
    );
    expect(searchRes.status).toBe(200);
    const searchBody = await searchRes.json();
    expect(searchBody.matches.length).toBeGreaterThanOrEqual(1);
    expect(
      searchBody.matches.every((m: any) => m.availabilityLabel === "VERIFIED AVAILABILITY")
    ).toBe(true);

    // HEALTH_EQUITY cannot add provider availability (403)
    mockCookieMap.set(SESSION_COOKIE_NAME, equityToken);
    const forbiddenRes = await addAvailability(
      new Request(`http://localhost/api/providers/${directoryProviderId}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotStartAt: new Date(Date.now() + 3 * 86400000).toISOString(),
          modality: "TELEHEALTH",
        }),
      }),
      { params: Promise.resolve({ id: directoryProviderId }) }
    );
    expect(forbiddenRes.status).toBe(403);

    // Cross-tenant ADMIN cannot add availability to Horizon provider (404)
    mockCookieMap.set(SESSION_COOKIE_NAME, pacificAdminToken);
    const crossTenantRes = await addAvailability(
      new Request(`http://localhost/api/providers/${directoryProviderId}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotStartAt: new Date(Date.now() + 3 * 86400000).toISOString(),
          modality: "TELEHEALTH",
        }),
      }),
      { params: Promise.resolve({ id: directoryProviderId }) }
    );
    expect(crossTenantRes.status).toBe(404);

    // Authorized OPERATIONS user can add verified slot
    mockCookieMap.set(SESSION_COOKIE_NAME, opsToken);
    const createSlotRes = await addAvailability(
      new Request(`http://localhost/api/providers/${directoryProviderId}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotStartAt: new Date(Date.now() + 3 * 86400000).toISOString(),
          modality: "TELEHEALTH",
          source: "VERIFIED_AVAILABILITY",
        }),
      }),
      { params: Promise.resolve({ id: directoryProviderId }) }
    );
    expect(createSlotRes.status).toBe(201);
    const slotBody = await createSlotRes.json();
    createdSlotId = slotBody.availability.id;
  });
});
