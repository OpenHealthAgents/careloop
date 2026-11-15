"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, Lock, ShieldAlert, UserCheck } from "lucide-react";

const DEMO_ACCOUNTS = [
  {
    email: "care.manager@careloop.demo",
    role: "CARE_MANAGER",
    label: "Care Manager",
    description: "Approve AI recommendations, confirm barriers, manage escalations, schedule & verify visits.",
  },
  {
    email: "admin@careloop.demo",
    role: "ADMIN",
    label: "Platform Administrator",
    description: "Full access including Audit Logs, Tenant Settings, RBAC Matrix, and all case workflows.",
  },
  {
    email: "equity.analyst@careloop.demo",
    role: "HEALTH_EQUITY",
    label: "Health Equity Analyst",
    description: "Monitor cohort completion disparities, language/geography gaps, and intervention equity.",
  },
  {
    email: "ops@careloop.demo",
    role: "OPERATIONS",
    label: "Operations Coordinator",
    description: "Ingest referral CSV batches, coordinate outreach, update provider slots and appointments.",
  },
  {
    email: "exec@careloop.demo",
    role: "EXECUTIVE_READ_ONLY",
    label: "Executive (Read-Only)",
    description: "View Executive Dashboard KPIs, conversion funnel, analytics, and equity outcomes (no edits).",
  },
];

export function LoginClient({ demoModeEnabled }: { demoModeEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState(demoModeEnabled ? "care.manager@careloop.demo" : "");
  const [password, setPassword] = useState(demoModeEnabled ? "CareLoopDemo2026!" : "");
  const [tenantSlug, setTenantSlug] = useState("horizon-bh");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn(targetEmail: string, targetPassword: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: targetEmail,
          password: targetPassword,
          tenantSlug: tenantSlug.trim() || "horizon-bh",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Sign in failed");
        return;
      }
      const targetNext =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next") || "/dashboard"
          : "/dashboard";
      router.push(targetNext);
      router.refresh();
    } catch {
      setError("Network error while signing in");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    signIn(email, password);
  }

  return (
    <div className="min-h-screen bg-slate-900 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-white">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">CareLoop</h1>
              <p className="text-sm text-slate-400">
                Turning healthcare recommendations into completed care.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs text-slate-300">
            Organization Tenant: <span className="font-mono font-semibold text-teal-300">{tenantSlug}</span>
          </div>
        </div>

        <div className={`grid gap-8 ${demoModeEnabled ? "lg:grid-cols-12" : "max-w-md mx-auto"}`}>
          {/* Standard Login Form */}
          <div className={`rounded-xl border border-slate-800 bg-slate-950/60 p-6 ${demoModeEnabled ? "lg:col-span-5" : ""}`}>
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <Lock className="h-4 w-4 text-teal-400" />
              Sign In
            </div>

            {error && (
              <div
                role="alert"
                className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/50 p-3 text-sm text-rose-200"
              >
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Tenant Slug</label>
                <input
                  type="text"
                  required
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Work Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign In"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/60 p-3.5 text-xs text-slate-400">
              <div className="font-semibold text-slate-300">Scope Notice</div>
              <p className="mt-1 leading-relaxed">
                CareLoop coordinates behavioral-health referral execution. It does not diagnose,
                prescribe, provide psychotherapy, or handle emergencies.
              </p>
            </div>
          </div>

          {/* One-Click Demo Role Switcher (strictly gated on demoModeEnabled) */}
          {demoModeEnabled && (
            <div className="lg:col-span-7">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <UserCheck className="h-4 w-4 text-teal-400" />
                  Demo Role Quick Sign-In (Password: <code className="text-teal-300">CareLoopDemo2026!</code>)
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {DEMO_ACCOUNTS.map((acct) => (
                  <button
                    key={acct.email}
                    type="button"
                    disabled={loading}
                    onClick={() => signIn(acct.email, "CareLoopDemo2026!")}
                    className="group flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-800/40 p-4 text-left transition hover:border-teal-500/60 hover:bg-slate-800"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white">{acct.label}</span>
                        <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-teal-300">
                          {acct.role}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                        {acct.description}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                      <span className="truncate font-mono text-[11px] text-slate-400">
                        {acct.email}
                      </span>
                      <span className="font-semibold text-teal-400 group-hover:translate-x-0.5 transition">
                        Sign in →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
