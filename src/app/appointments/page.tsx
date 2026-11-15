import React from "react";
import { AppShell } from "@/components/AppShell";
import { AppointmentsClient } from "@/components/AppointmentsClient";
import { requirePageSession } from "@/lib/auth/page-session";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  const { session, permissions } = await requirePageSession("appointments.read");
  const canManage = hasPermission(session.role, "appointments.manage", session.customRoleCode);

  const appointments = await prisma.appointment.findMany({
    where: { tenantId: session.tenantId },
    include: {
      member: true,
      provider: true,
      careCase: { include: { referral: true } },
      verifications: {
        orderBy: { verifiedAt: "desc" },
        include: {
          verifiedBy: { select: { id: true, name: true, role: true } },
        },
      },
    },
    orderBy: { scheduledStartAt: "desc" },
  });

  return (
    <AppShell
      user={session}
      permissions={permissions}
      title="Appointments"
      subtitle="Appointment lifecycle tracking (REQUESTED -> COMPLETED), reminders, rescheduling, cancellations, and visit completion evidence."
    >
      <AppointmentsClient
        appointments={JSON.parse(JSON.stringify(appointments))}
        canManage={canManage}
      />
    </AppShell>
  );
}
