import { UserRole } from "@prisma/client";
import { AuthorizationError } from "@/lib/errors";

export const PERMISSIONS = {
  DASHBOARD_READ: "dashboard.read",
  REFERRALS_READ: "referrals.read",
  REFERRALS_MANAGE: "referrals.manage",
  MEMBERS_READ: "members.read",
  MEMBER_READ: "member.read",
  MEMBERS_MANAGE: "members.manage",
  MEMBER_COMMUNICATION: "member.communication",
  CASES_READ: "cases.read",
  CASES_WRITE: "cases.write",
  CASES_ASSIGN: "cases.assign",
  CASES_MANAGE: "cases.manage",
  CASES_ESCALATE: "cases.escalate",
  AI_RUN: "ai.run",
  AGENT_RUN: "agent.run",
  AI_REVIEW: "ai.review",
  AGENT_APPROVE: "agent.approve",
  INTERVENTIONS_READ: "interventions.read",
  INTERVENTIONS_APPROVE: "interventions.approve",
  INTERVENTIONS_EXECUTE: "interventions.execute",
  OUTREACH_SEND: "outreach.send",
  PROVIDERS_READ: "providers.read",
  PROVIDER_READ: "provider.read",
  PROVIDERS_MANAGE: "providers.manage",
  APPOINTMENTS_READ: "appointments.read",
  APPOINTMENTS_WRITE: "appointments.write",
  APPOINTMENTS_MANAGE: "appointments.manage",
  COMPLETION_VERIFY: "completion.verify",
  ANALYTICS_READ: "analytics.read",
  EQUITY_READ: "equity.read",
  AUDIT_READ: "audit.read",
  SETTINGS_READ: "settings.read",
  TENANT_MANAGE: "tenant.manage",
  USERS_MANAGE: "users.manage",
  ADMIN_MANAGE: "admin.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/**
 * Role permission matrix.
 * UI components and server handlers check explicit Permissions—never hard-coded role names.
 * Custom roles can be registered here or via the Role table without touching call sites.
 */
export const ROLE_PERMISSIONS: Record<string, ReadonlySet<Permission>> = {
  [UserRole.ADMIN]: new Set(ALL_PERMISSIONS),
  [UserRole.CARE_MANAGER]: new Set<Permission>([
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.REFERRALS_READ,
    PERMISSIONS.REFERRALS_MANAGE,
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.MEMBER_READ,
    PERMISSIONS.MEMBERS_MANAGE,
    PERMISSIONS.MEMBER_COMMUNICATION,
    PERMISSIONS.CASES_READ,
    PERMISSIONS.CASES_WRITE,
    PERMISSIONS.CASES_ASSIGN,
    PERMISSIONS.CASES_MANAGE,
    PERMISSIONS.CASES_ESCALATE,
    PERMISSIONS.AI_RUN,
    PERMISSIONS.AGENT_RUN,
    PERMISSIONS.AI_REVIEW,
    PERMISSIONS.AGENT_APPROVE,
    PERMISSIONS.INTERVENTIONS_READ,
    PERMISSIONS.INTERVENTIONS_APPROVE,
    PERMISSIONS.INTERVENTIONS_EXECUTE,
    PERMISSIONS.OUTREACH_SEND,
    PERMISSIONS.PROVIDERS_READ,
    PERMISSIONS.PROVIDER_READ,
    PERMISSIONS.APPOINTMENTS_READ,
    PERMISSIONS.APPOINTMENTS_WRITE,
    PERMISSIONS.APPOINTMENTS_MANAGE,
    PERMISSIONS.COMPLETION_VERIFY,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.EQUITY_READ,
    PERMISSIONS.SETTINGS_READ,
  ]),
  [UserRole.HEALTH_EQUITY]: new Set<Permission>([
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.REFERRALS_READ,
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.MEMBER_READ,
    PERMISSIONS.CASES_READ,
    PERMISSIONS.INTERVENTIONS_READ,
    PERMISSIONS.PROVIDERS_READ,
    PERMISSIONS.PROVIDER_READ,
    PERMISSIONS.APPOINTMENTS_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.EQUITY_READ,
    PERMISSIONS.SETTINGS_READ,
  ]),
  [UserRole.OPERATIONS]: new Set<Permission>([
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.REFERRALS_READ,
    PERMISSIONS.REFERRALS_MANAGE,
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.MEMBER_READ,
    PERMISSIONS.MEMBER_COMMUNICATION,
    PERMISSIONS.CASES_READ,
    PERMISSIONS.CASES_WRITE,
    PERMISSIONS.CASES_ASSIGN,
    PERMISSIONS.CASES_MANAGE,
    PERMISSIONS.AI_RUN,
    PERMISSIONS.AGENT_RUN,
    PERMISSIONS.INTERVENTIONS_READ,
    PERMISSIONS.INTERVENTIONS_EXECUTE,
    PERMISSIONS.OUTREACH_SEND,
    PERMISSIONS.PROVIDERS_READ,
    PERMISSIONS.PROVIDER_READ,
    PERMISSIONS.PROVIDERS_MANAGE,
    PERMISSIONS.APPOINTMENTS_READ,
    PERMISSIONS.APPOINTMENTS_WRITE,
    PERMISSIONS.APPOINTMENTS_MANAGE,
    PERMISSIONS.COMPLETION_VERIFY,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.SETTINGS_READ,
  ]),
  [UserRole.EXECUTIVE_READ_ONLY]: new Set<Permission>([
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.EQUITY_READ,
    PERMISSIONS.REFERRALS_READ,
    PERMISSIONS.CASES_READ,
    PERMISSIONS.PROVIDERS_READ,
    PERMISSIONS.PROVIDER_READ,
    PERMISSIONS.INTERVENTIONS_READ,
    PERMISSIONS.APPOINTMENTS_READ,
    PERMISSIONS.SETTINGS_READ,
  ]),
  EXECUTIVE: new Set<Permission>([
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.EQUITY_READ,
    PERMISSIONS.REFERRALS_READ,
    PERMISSIONS.CASES_READ,
    PERMISSIONS.PROVIDERS_READ,
    PERMISSIONS.PROVIDER_READ,
    PERMISSIONS.INTERVENTIONS_READ,
    PERMISSIONS.APPOINTMENTS_READ,
    PERMISSIONS.SETTINGS_READ,
  ]),
  // Service identity for autonomous agents: strictly least-privilege,
  // never inherits ADMIN, audit.read, or human approval permissions.
  [UserRole.AGENT_SERVICE]: new Set<Permission>([
    PERMISSIONS.REFERRALS_READ,
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.MEMBER_READ,
    PERMISSIONS.MEMBER_COMMUNICATION,
    PERMISSIONS.CASES_READ,
    PERMISSIONS.CASES_WRITE,
    PERMISSIONS.CASES_ESCALATE,
    PERMISSIONS.AI_RUN,
    PERMISSIONS.AGENT_RUN,
    PERMISSIONS.INTERVENTIONS_READ,
    PERMISSIONS.INTERVENTIONS_EXECUTE,
    PERMISSIONS.OUTREACH_SEND,
    PERMISSIONS.PROVIDERS_READ,
    PERMISSIONS.PROVIDER_READ,
    PERMISSIONS.APPOINTMENTS_READ,
    PERMISSIONS.APPOINTMENTS_WRITE,
    PERMISSIONS.APPOINTMENTS_MANAGE,
    PERMISSIONS.COMPLETION_VERIFY,
  ]),
};

export const ROLE_LABELS: Record<UserRole, { label: string; description: string }> = {
  ADMIN: {
    label: "Platform Administrator",
    description:
      "Full access to tenant configuration, user management, audit logs, and all coordination workflows.",
  },
  CARE_MANAGER: {
    label: "Care Manager",
    description:
      "Owns barrier verification, AI recommendation approval, escalations, scheduling, and completion verification.",
  },
  HEALTH_EQUITY: {
    label: "Health Equity Analyst",
    description:
      "Monitors population disparities, barrier patterns, time-to-care gaps, and intervention equity.",
  },
  OPERATIONS: {
    label: "Operations Coordinator",
    description:
      "Manages referral ingestion, outreach execution, provider availability updates, and appointments.",
  },
  EXECUTIVE_READ_ONLY: {
    label: "Executive (Read-Only)",
    description:
      "Views executive KPIs, conversion funnels, analytics, and equity outcomes without mutating records.",
  },
  AGENT_SERVICE: {
    label: "Agent Service Identity",
    description:
      "Scoped non-human service identity for CareLoop agents; executes only explicitly granted tool permissions and never inherits admin or human approval rights.",
  },
};

export function getPermissionsForRole(role: string, customRoleCode?: string | null): Permission[] {
  const key = customRoleCode && ROLE_PERMISSIONS[customRoleCode] ? customRoleCode : role;
  const set = ROLE_PERMISSIONS[key];
  return set ? Array.from(set) : [];
}

export function hasPermission(
  role: string,
  permission: Permission,
  customRoleCode?: string | null,
  scopedPermissions?: readonly Permission[]
): boolean {
  const key = customRoleCode && ROLE_PERMISSIONS[customRoleCode] ? customRoleCode : role;
  const set = ROLE_PERMISSIONS[key];
  if (!set || !set.has(permission)) {
    return false;
  }
  if (scopedPermissions && !scopedPermissions.includes(permission)) {
    return false;
  }
  return true;
}

export function permissionSetHas(
  permissions: readonly Permission[],
  permission: Permission
): boolean {
  return permissions.includes(permission);
}

export function requirePermission(
  user: {
    role: string;
    customRoleCode?: string | null;
    scopedPermissions?: readonly Permission[];
  },
  permission: Permission
): void {
  if (!hasPermission(user.role, permission, user.customRoleCode, user.scopedPermissions)) {
    throw new AuthorizationError(`Role ${user.role} lacks required permission: ${permission}`);
  }
}
