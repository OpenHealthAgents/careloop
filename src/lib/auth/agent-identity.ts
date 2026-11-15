import { UserRole } from "@prisma/client";
import { AuthorizationError } from "@/lib/errors";
import { getPermissionsForRole, Permission, PERMISSIONS } from "./rbac";
import type { SessionUser } from "./session";

const PROHIBITED_AGENT_PERMISSIONS = new Set<Permission>([
  PERMISSIONS.ADMIN_MANAGE,
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.TENANT_MANAGE,
  PERMISSIONS.AUDIT_READ,
  PERMISSIONS.AGENT_APPROVE,
  PERMISSIONS.INTERVENTIONS_APPROVE,
  PERMISSIONS.AI_REVIEW,
]);

export interface CreateAgentServiceIdentityParams {
  serviceId: string;
  serviceName: string;
  tenantId: string;
  tenantSlug: string;
  scopedPermissions?: Permission[];
  ttlSeconds?: number;
}

/**
 * Creates a least-privilege service identity for CareLoop agents.
 * - Always runs under UserRole.AGENT_SERVICE (never inherits ADMIN).
 * - Rejects any attempt to grant administrator, audit, or human-approval permissions.
 * - Restricts tool execution to the intersection of AGENT_SERVICE role and scopedPermissions.
 */
export function createAgentServiceIdentity(
  params: CreateAgentServiceIdentityParams
): SessionUser {
  const allowedAgentRolePerms = new Set(getPermissionsForRole(UserRole.AGENT_SERVICE));
  const requested = params.scopedPermissions ?? Array.from(allowedAgentRolePerms);

  for (const perm of requested) {
    if (PROHIBITED_AGENT_PERMISSIONS.has(perm)) {
      throw new AuthorizationError(
        `Agent service identity '${params.serviceId}' cannot be granted privileged permission: ${perm}`
      );
    }
    if (!allowedAgentRolePerms.has(perm)) {
      throw new AuthorizationError(
        `Agent service identity '${params.serviceId}' requested permission outside AGENT_SERVICE scope: ${perm}`
      );
    }
  }

  return {
    userId: `agent:${params.serviceId}`,
    tenantId: params.tenantId,
    tenantSlug: params.tenantSlug,
    email: `${params.serviceId}@agent.careloop.internal`,
    name: params.serviceName,
    role: UserRole.AGENT_SERVICE,
    isServiceIdentity: true,
    scopedPermissions: Array.from(new Set(requested)),
    exp: Math.floor(Date.now() / 1000) + (params.ttlSeconds ?? 300),
  };
}
