import React from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { WorklistClient } from "@/components/WorklistClient";
import { requirePageSession } from "@/lib/auth/page-session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ReferralWorklistPage({
  searchParams,
}: {
  searchParams: Promise<{ riskTier?: string; status?: string; review?: string }>;
}) {
  const { session, permissions } = await requirePageSession(PERMISSIONS.CASES_READ);
  const canRunAi = hasPermission(session.role, PERMISSIONS.AI_RUN, session.customRoleCode);
  const sp = await searchParams;

  const cases = await prisma.case.findMany({
    where: {
      tenantId: session.tenantId,
      status: { notIn: ["CLOSED", "VERIFIED"] },
      ...(sp.riskTier ? { riskLevel: sp.riskTier as any } : {}),
      ...(sp.status ? { status: sp.status as any } : {}),
      ...(sp.review === "1" ? { humanReviewRequired: true } : {}),
    },
    include: {
      member: true,
      referral: true,
      matchedProvider: true,
      riskAssessments: {
        orderBy: { assessedAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ priorityScore: "desc" }, { humanReviewRequired: "desc" }],
    take: 250,
  });

  return (
    <AppShell
      user={session}
      permissions={permissions}
      title="Referral Worklist"
      subtitle="Actionable queue sorted by operational non-completion risk with transparent factor explanations."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/worklist"
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
              !sp.riskTier && !sp.review
                ? "border-teal-600 bg-teal-50 text-teal-800"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            All Open ({cases.length})
          </Link>
          <Link
            href="/worklist?riskTier=HIGH"
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
              sp.riskTier === "HIGH"
                ? "border-rose-600 bg-rose-50 text-rose-800"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            High Risk
          </Link>
          <Link
            href="/worklist?riskTier=MEDIUM"
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
              sp.riskTier === "MEDIUM"
                ? "border-amber-600 bg-amber-50 text-amber-800"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            Medium Risk
          </Link>
          <Link
            href="/worklist?review=1"
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
              sp.review === "1"
                ? "border-amber-600 bg-amber-50 text-amber-900"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            Human Review
          </Link>
        </div>
      }
    >
      <WorklistClient cases={JSON.parse(JSON.stringify(cases))} canRunAi={canRunAi} />
    </AppShell>
  );
}
