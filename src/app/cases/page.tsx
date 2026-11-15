import React from "react";
import { AppShell } from "@/components/AppShell";
import { CasesClient } from "@/components/CasesClient";
import { requirePageSession } from "@/lib/auth/page-session";
import { caseRepository } from "@/repositories/case-repository";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const { session, permissions } = await requirePageSession("cases.read");
  const cases = await caseRepository.listByTenant(session.tenantId);

  return (
    <AppShell
      user={session}
      permissions={permissions}
      title="Cases"
      subtitle="End-to-end behavioral-health care coordination cases across all 14 lifecycle and exception states."
    >
      <CasesClient cases={JSON.parse(JSON.stringify(cases))} />
    </AppShell>
  );
}
