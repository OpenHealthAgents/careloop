import React from "react";
import { INTEGRATION_ADAPTER_REGISTRY } from "@/adapters/dev-adapters";
import { AppShell } from "@/components/AppShell";
import { SettingsClient } from "@/components/SettingsClient";
import { UserManagementClient } from "@/components/UserManagementClient";
import { requirePageSession } from "@/lib/auth/page-session";
import { getPermissionsForRole, hasPermission, PERMISSIONS, ROLE_LABELS } from "@/lib/auth/rbac";
import { getConfig } from "@/lib/config";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { session, permissions } = await requirePageSession(PERMISSIONS.SETTINGS_READ);
  const canManage = hasPermission(session.role, PERMISSIONS.TENANT_MANAGE, session.customRoleCode);
  const canManageUsers = hasPermission(session.role, PERMISSIONS.USERS_MANAGE, session.customRoleCode);
  const config = getConfig();

  const [tenant, users] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: session.tenantId } }),
    prisma.user.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true, name: true, email: true, role: true, active: true },
      orderBy: { role: "asc" },
    }),
  ]);

  return (
    <AppShell
      user={session}
      permissions={permissions}
      title="Settings"
      subtitle="Tenant configuration, AI provider abstraction, RBAC role matrix, and integration adapter registry."
    >
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900">
              Tenant Operational Configuration ({tenant?.name})
            </h2>
            <p className="mt-0.5 mb-4 text-xs text-slate-500">
              Plan Type: {tenant?.planType} • Slug: {tenant?.slug}
            </p>
            <SettingsClient
              initialSettings={(tenant?.settings as Record<string, any>) ?? {}}
              canManage={canManage}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900">AI Provider Abstraction</h2>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-slate-500">Provider Mode</dt>
                <dd className="font-mono font-semibold text-teal-800">{config.AI_PROVIDER_MODE}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Model / Rules Version</dt>
                <dd className="font-mono text-slate-800">{config.AI_MODEL_NAME}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Schema Validation</dt>
                <dd className="font-semibold text-emerald-700">Strict Zod Envelope Enabled</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Architecture Posture</dt>
                <dd className="text-slate-700">HIPAA-aligned controls (non-certified MVP)</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Integration Adapters */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-900">
            External Integration Adapter Registry
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Clean adapter interfaces allow Claims, Eligibility, FHIR R4, HL7 v2, and EHR scheduling
            connectors to plug in without altering CareLoop domain logic.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {INTEGRATION_ADAPTER_REGISTRY.map((a) => (
              <div key={a.key} className="rounded-lg border border-slate-200 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{a.name}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      a.status === "MVP_ACTIVE"
                        ? "bg-emerald-50 text-emerald-800"
                        : a.status === "STUB_ADAPTER"
                          ? "bg-sky-50 text-sky-800"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                <div className="mt-1 text-[11px] font-medium text-slate-500">{a.category}</div>
                <p className="mt-1 text-slate-600">{a.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RBAC Role Matrix & Users */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-900">
            Role-Based Access Control (RBAC) & Tenant Users
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(ROLE_LABELS).map(([role, meta]) => (
              <div key={role} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="font-semibold text-slate-900">{meta.label}</div>
                <div className="font-mono text-[11px] text-teal-700">{role}</div>
                <p className="mt-1 text-slate-600">{meta.description}</p>
                <div className="mt-2 text-[11px] text-slate-500">
                  {getPermissionsForRole(role).length} granted permissions
                </div>
              </div>
            ))}
          </div>

          <UserManagementClient
            users={JSON.parse(JSON.stringify(users))}
            canManageUsers={canManageUsers}
          />
        </div>
      </div>
    </AppShell>
  );
}
