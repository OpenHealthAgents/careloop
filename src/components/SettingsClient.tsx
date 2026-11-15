"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export function SettingsClient({
  initialSettings,
  canManage,
}: {
  initialSettings: Record<string, any>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [escalationRiskThreshold, setThreshold] = useState<number>(
    Number(initialSettings.escalationRiskThreshold ?? 75)
  );
  const [autoTriageOnIngest, setAutoTriage] = useState<boolean>(
    Boolean(initialSettings.autoTriageOnIngest ?? true)
  );
  const [auditLogRetentionDays, setAuditRetention] = useState<number>(
    Number(initialSettings.auditLogRetentionDays ?? 2555)
  );
  const [clinicalOperationalRetentionDays, setOperationalRetention] = useState<number>(
    Number(initialSettings.clinicalOperationalRetentionDays ?? 2555)
  );
  const [aiTraceRetentionDays, setAiRetention] = useState<number>(
    Number(initialSettings.aiTraceRetentionDays ?? 1095)
  );
  const [sessionMaxAgeHours, setSessionMaxAgeHours] = useState<number>(
    Number(initialSettings.sessionMaxAgeHours ?? 12)
  );
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        escalationRiskThreshold,
        autoTriageOnIngest,
        auditLogRetentionDays,
        clinicalOperationalRetentionDays,
        aiTraceRetentionDays,
        sessionMaxAgeHours,
      }),
    });
    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Human Escalation Risk Threshold (0–100)
          </label>
          <input
            type="number"
            min={40}
            max={95}
            disabled={!canManage}
            value={escalationRiskThreshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-100"
          />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input
            id="autoTriage"
            type="checkbox"
            disabled={!canManage}
            checked={autoTriageOnIngest}
            onChange={(e) => setAutoTriage(e.target.checked)}
          />
          <label htmlFor="autoTriage" className="text-xs font-medium text-slate-700">
            Auto-run AI risk & barrier assessment on CSV referral ingestion
          </label>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Audit Log Retention (days, 365–3650)
          </label>
          <input
            type="number"
            min={365}
            max={3650}
            disabled={!canManage}
            value={auditLogRetentionDays}
            onChange={(e) => setAuditRetention(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-100"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Case & Operational Record Retention (days, 365–3650)
          </label>
          <input
            type="number"
            min={365}
            max={3650}
            disabled={!canManage}
            value={clinicalOperationalRetentionDays}
            onChange={(e) => setOperationalRetention(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-100"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700">
            AI Trace & Execution Log Retention (days, 90–3650)
          </label>
          <input
            type="number"
            min={90}
            max={3650}
            disabled={!canManage}
            value={aiTraceRetentionDays}
            onChange={(e) => setAiRetention(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-100"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Max Session Lifetime (hours, 1–24)
          </label>
          <input
            type="number"
            min={1}
            max={24}
            disabled={!canManage}
            value={sessionMaxAgeHours}
            onChange={(e) => setSessionMaxAgeHours(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-100"
          />
        </div>
      </div>

      {canManage && (
        <button
          type="submit"
          className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-600"
        >
          Save Tenant Configuration
        </button>
      )}
      {saved && <span className="ml-3 text-xs font-medium text-emerald-700">Settings saved.</span>}
    </form>
  );
}
