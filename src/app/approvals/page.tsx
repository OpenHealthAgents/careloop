import React from "react";
import { AppShell } from "@/components/AppShell";
import { ApprovalsClient } from "@/components/ApprovalsClient";
import { requirePageSession } from "@/lib/auth/page-session";
import { permissionSetHas } from "@/lib/auth/rbac";
import { listTenantApprovals } from "@/services/approval-service";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const { session, permissions } = await requirePageSession("ai.review");
  const approvals = await listTenantApprovals(session);
  const canDecide = permissionSetHas(permissions, "ai.review");

  return (
    <AppShell
      user={session}
      permissions={permissions}
      title="Pending Approvals"
      subtitle="Human-in-the-loop approval gates for paused high-risk and policy-gated agent actions."
    >
      <ApprovalsClient initialApprovals={approvals} canDecide={canDecide} />
    </AppShell>
  );
}
