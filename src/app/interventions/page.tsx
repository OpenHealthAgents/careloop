import React from "react";
import { AppShell } from "@/components/AppShell";
import { InterventionsClient } from "@/components/InterventionsClient";
import { requirePageSession } from "@/lib/auth/page-session";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function InterventionsPage() {
  const { session, permissions } = await requirePageSession("interventions.read");
  const canApprove = hasPermission(session.role, "interventions.approve", session.customRoleCode);
  const canExecute = hasPermission(session.role, "interventions.execute", session.customRoleCode);

  const interventions = await prisma.intervention.findMany({
    where: { tenantId: session.tenantId },
    include: {
      careCase: {
        include: {
          member: true,
          referral: true,
        },
      },
      assignedOwner: { select: { id: true, name: true, role: true } },
      outcomes: {
        orderBy: { recordedAt: "desc" },
        include: {
          recordedBy: { select: { id: true, name: true, role: true } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { recommendedAt: "desc" }],
  });

  return (
    <AppShell
      user={session}
      permissions={permissions}
      title="Interventions"
      subtitle="Barrier-mapped intervention recommendations, AUTOMATED vs HUMAN_ASSISTED vs HUMAN_ONLY classification, human approval gates, and outcome tracking."
    >
      <InterventionsClient
        interventions={JSON.parse(JSON.stringify(interventions))}
        canApprove={canApprove}
        canExecute={canExecute}
      />
    </AppShell>
  );
}
