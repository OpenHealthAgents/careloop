import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { createAgentServiceIdentity } from "@/lib/auth/agent-identity";
import { verifySessionTokenEdge } from "@/lib/auth/edge-token";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { hasPermission, PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";
import { getConfig } from "@/lib/config";
import { AuthorizationError } from "@/lib/errors";

describe("RBAC Authorization, Password Hashing & Session Security", () => {
  it("hashes and verifies passwords using salted scrypt", () => {
    const hash = hashPassword("CareLoopDemo2026!");
    expect(hash).toContain(":");
    expect(verifyPassword("CareLoopDemo2026!", hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("signs and verifies session tokens in both Node and Edge WebCrypto and rejects tampered tokens", async () => {
    const token = createSessionToken({
      sid: "sess-1",
      userId: "user-1",
      tenantId: "tenant-1",
      tenantSlug: "horizon-bh",
      email: "care.manager@careloop.demo",
      name: "Maya",
      role: UserRole.CARE_MANAGER,
    });
    const decoded = verifySessionToken(token);
    expect(decoded?.userId).toBe("user-1");
    expect(decoded?.role).toBe(UserRole.CARE_MANAGER);

    const edgeDecoded = await verifySessionTokenEdge(token, getConfig().AUTH_SECRET);
    expect(edgeDecoded?.userId).toBe("user-1");
    expect(edgeDecoded?.tenantId).toBe("tenant-1");

    const tampered = `${token.slice(0, -3)}xxx`;
    expect(verifySessionToken(tampered)).toBeNull();
    expect(await verifySessionTokenEdge(tampered, getConfig().AUTH_SECRET)).toBeNull();
  });

  it("enforces least-privilege dot-notation permissions across all 5 CareLoop roles", () => {
    // ADMIN has audit.read, users.manage, tenant.manage
    expect(hasPermission(UserRole.ADMIN, PERMISSIONS.AUDIT_READ)).toBe(true);
    expect(hasPermission(UserRole.ADMIN, PERMISSIONS.USERS_MANAGE)).toBe(true);
    expect(hasPermission(UserRole.ADMIN, PERMISSIONS.TENANT_MANAGE)).toBe(true);

    // CARE_MANAGER can approve interventions and escalate, but cannot read audit logs or manage users/tenants
    expect(hasPermission(UserRole.CARE_MANAGER, PERMISSIONS.INTERVENTIONS_APPROVE)).toBe(true);
    expect(hasPermission(UserRole.CARE_MANAGER, PERMISSIONS.CASES_ESCALATE)).toBe(true);
    expect(hasPermission(UserRole.CARE_MANAGER, PERMISSIONS.AUDIT_READ)).toBe(false);
    expect(hasPermission(UserRole.CARE_MANAGER, PERMISSIONS.USERS_MANAGE)).toBe(false);

    // HEALTH_EQUITY can read equity & analytics, cannot mutate cases or referrals
    expect(hasPermission(UserRole.HEALTH_EQUITY, PERMISSIONS.EQUITY_READ)).toBe(true);
    expect(() =>
      requirePermission({ role: UserRole.HEALTH_EQUITY }, PERMISSIONS.CASES_MANAGE)
    ).toThrow(AuthorizationError);
    expect(() =>
      requirePermission({ role: UserRole.HEALTH_EQUITY }, PERMISSIONS.REFERRALS_MANAGE)
    ).toThrow(AuthorizationError);

    // OPERATIONS can ingest referrals, manage providers and appointments, cannot approve interventions or manage users
    expect(hasPermission(UserRole.OPERATIONS, PERMISSIONS.REFERRALS_MANAGE)).toBe(true);
    expect(hasPermission(UserRole.OPERATIONS, PERMISSIONS.PROVIDERS_MANAGE)).toBe(true);
    expect(hasPermission(UserRole.OPERATIONS, PERMISSIONS.APPOINTMENTS_MANAGE)).toBe(true);
    expect(hasPermission(UserRole.OPERATIONS, PERMISSIONS.INTERVENTIONS_APPROVE)).toBe(false);
    expect(hasPermission(UserRole.OPERATIONS, PERMISSIONS.USERS_MANAGE)).toBe(false);

    // EXECUTIVE_READ_ONLY cannot mutate any record
    expect(hasPermission(UserRole.EXECUTIVE_READ_ONLY, PERMISSIONS.DASHBOARD_READ)).toBe(true);
    expect(hasPermission(UserRole.EXECUTIVE_READ_ONLY, PERMISSIONS.EQUITY_READ)).toBe(true);
    expect(() =>
      requirePermission({ role: UserRole.EXECUTIVE_READ_ONLY }, PERMISSIONS.REFERRALS_MANAGE)
    ).toThrow(AuthorizationError);
    expect(() =>
      requirePermission({ role: UserRole.EXECUTIVE_READ_ONLY }, PERMISSIONS.COMPLETION_VERIFY)
    ).toThrow(AuthorizationError);
    expect(() =>
      requirePermission({ role: UserRole.EXECUTIVE_READ_ONLY }, PERMISSIONS.USERS_MANAGE)
    ).toThrow(AuthorizationError);

    // EXECUTIVE alias has read-only analytics & case visibility
    expect(hasPermission("EXECUTIVE", PERMISSIONS.ANALYTICS_READ)).toBe(true);
    expect(hasPermission("EXECUTIVE", PERMISSIONS.CASES_WRITE)).toBe(false);
  });

  it("enforces AGENT_SERVICE least-privilege identities and scoped tool permissions", () => {
    // AGENT_SERVICE never inherits admin, audit, or human approval permissions
    expect(hasPermission(UserRole.AGENT_SERVICE, PERMISSIONS.AGENT_RUN)).toBe(true);
    expect(hasPermission(UserRole.AGENT_SERVICE, PERMISSIONS.CASES_WRITE)).toBe(true);
    expect(hasPermission(UserRole.AGENT_SERVICE, PERMISSIONS.ADMIN_MANAGE)).toBe(false);
    expect(hasPermission(UserRole.AGENT_SERVICE, PERMISSIONS.USERS_MANAGE)).toBe(false);
    expect(hasPermission(UserRole.AGENT_SERVICE, PERMISSIONS.TENANT_MANAGE)).toBe(false);
    expect(hasPermission(UserRole.AGENT_SERVICE, PERMISSIONS.AUDIT_READ)).toBe(false);
    expect(hasPermission(UserRole.AGENT_SERVICE, PERMISSIONS.AGENT_APPROVE)).toBe(false);

    // Attempting to grant privileged permissions to an agent service identity is rejected
    expect(() =>
      createAgentServiceIdentity({
        serviceId: "orchestrator-1",
        serviceName: "Case Orchestrator",
        tenantId: "tenant-1",
        tenantSlug: "horizon-bh",
        scopedPermissions: [PERMISSIONS.CASES_READ, PERMISSIONS.ADMIN_MANAGE],
      })
    ).toThrow(AuthorizationError);

    expect(() =>
      createAgentServiceIdentity({
        serviceId: "orchestrator-1",
        serviceName: "Case Orchestrator",
        tenantId: "tenant-1",
        tenantSlug: "horizon-bh",
        scopedPermissions: [PERMISSIONS.AGENT_APPROVE],
      })
    ).toThrow(AuthorizationError);

    // Scoped agent identity can execute only its granted subset of permissions
    const scopedAgent = createAgentServiceIdentity({
      serviceId: "provider-matcher",
      serviceName: "Provider Matcher Agent",
      tenantId: "tenant-1",
      tenantSlug: "horizon-bh",
      scopedPermissions: [PERMISSIONS.CASES_READ, PERMISSIONS.PROVIDER_READ, PERMISSIONS.AGENT_RUN],
    });

    expect(scopedAgent.isServiceIdentity).toBe(true);
    expect(scopedAgent.role).toBe(UserRole.AGENT_SERVICE);
    expect(() => requirePermission(scopedAgent, PERMISSIONS.PROVIDER_READ)).not.toThrow();
    expect(() => requirePermission(scopedAgent, PERMISSIONS.APPOINTMENTS_WRITE)).toThrow(
      AuthorizationError
    );
  });
});
