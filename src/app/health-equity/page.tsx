import React from "react";
import { AppShell } from "@/components/AppShell";
import { HealthEquityClient } from "@/components/HealthEquityClient";
import { requirePageSession } from "@/lib/auth/page-session";
import { getHealthEquityAnalytics } from "@/services/analytics-service";

export const dynamic = "force-dynamic";

export default async function HealthEquityPage() {
  const { session, permissions } = await requirePageSession("equity.read");
  const equity = await getHealthEquityAnalytics(session.tenantId);

  return (
    <AppShell
      user={session}
      permissions={permissions}
      title="Health Equity"
      subtitle="Cohort disparity monitoring, time-to-care gaps, barrier prevalence, intervention lift, and sample-size safeguards."
    >
      <HealthEquityClient initialData={JSON.parse(JSON.stringify(equity))} />
    </AppShell>
  );
}
