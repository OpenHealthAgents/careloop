import React from "react";
import { notFound } from "next/navigation";
import { MemberPortalClient } from "@/components/MemberPortalClient";
import { requirePageSession } from "@/lib/auth/page-session";
import { hasPermission } from "@/lib/auth/rbac";
import { getMemberPortalView } from "@/services/member-portal-service";

export const dynamic = "force-dynamic";

export default async function MemberPortalCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { session } = await requirePageSession("cases.read");
  const { caseId } = await params;

  let portal;
  try {
    portal = await getMemberPortalView(session.tenantId, caseId);
  } catch {
    notFound();
  }

  const canInteract = hasPermission(session.role, "cases.manage", session.customRoleCode);

  return (
    <MemberPortalClient
      initialPortal={JSON.parse(JSON.stringify(portal))}
      canInteract={canInteract}
    />
  );
}
