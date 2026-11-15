import React from "react";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { requirePageSession } from "@/lib/auth/page-session";
import { listAuditLogs } from "@/services/audit-service";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const { session, permissions } = await requirePageSession("audit.read");
  const logs = await listAuditLogs(session.tenantId, { limit: 150 });

  return (
    <AppShell
      user={session}
      permissions={permissions}
      title="Audit Log"
      subtitle="PHI-minimized immutable-style history of authentication, workflow transitions, AI reviews, and verifications."
    >
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
        <ShieldCheck className="h-4 w-4 text-teal-700" />
        <span>
          Audit logs store operational action summaries, actor roles, and correlation IDs—sensitive
          PHI fields are automatically redacted.
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Actor & Role</th>
              <th className="px-4 py-3">Summary & State Transition</th>
              <th className="px-4 py-3">Correlation ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-2.5">
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                    {log.source}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono font-semibold text-slate-800">
                  {log.action}
                </td>
                <td className="px-4 py-2.5 text-slate-700">
                  {log.entityType} <span className="font-mono text-slate-400">({log.entityId.slice(0, 10)})</span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="font-medium text-slate-900">{log.actorEmail ?? "SYSTEM"}</div>
                  <div className="text-slate-400">{log.actorRole ?? "SYSTEM"}</div>
                </td>
                <td className="px-4 py-2.5 text-slate-700">
                  <div>{log.summary}</div>
                  {(log.previousState || log.newState) && (
                    <div className="mt-1 font-mono text-[11px] text-slate-500">
                      {log.previousState ? JSON.stringify(log.previousState) : "—"} →{" "}
                      {log.newState ? JSON.stringify(log.newState) : "—"}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">
                  {log.correlationId ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
