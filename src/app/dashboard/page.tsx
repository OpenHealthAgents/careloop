import React from "react";
import Link from "next/link";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ExecutiveDashboardClient } from "@/components/ExecutiveDashboardClient";
import { requirePageSession } from "@/lib/auth/page-session";
import { getDashboardAnalytics } from "@/services/analytics-service";

export const dynamic = "force-dynamic";

export default async function ExecutiveDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ forbidden?: string }>;
}) {
  const { session, permissions } = await requirePageSession("dashboard.read");
  const params = await searchParams;
  const data = await getDashboardAnalytics(session.tenantId);

  return (
    <AppShell
      user={session}
      permissions={permissions}
      title="Executive Dashboard"
      subtitle="Behavioral-health referral execution from referral receipt to verified first completed visit."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/health-equity"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Equity &amp; Learning
          </Link>
          <Link
            href="/worklist?riskTier=HIGH"
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600"
          >
            Open High-Risk Worklist
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      }
    >
      {params.forbidden === "1" && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          Your current role ({session.role}) does not have permission to view that page.
        </div>
      )}

      <ExecutiveDashboardClient initialData={JSON.parse(JSON.stringify(data))} />
    </AppShell>
  );
}
