import React from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { CaseStatusBadge } from "@/components/StatusBadges";
import { requirePageSession } from "@/lib/auth/page-session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const { session, permissions } = await requirePageSession("members.read");
  const members = await prisma.member.findMany({
    where: { tenantId: session.tenantId },
    include: {
      cases: {
        select: { id: true, status: true, riskLevel: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { externalMemberId: "asc" },
  });

  return (
    <AppShell
      user={session}
      permissions={permissions}
      title="Members"
      subtitle="Synthetic member profiles with language preferences, logistical context, and outreach consent."
    >
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Member ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Language & Geography</th>
              <th className="px-4 py-3">Coverage / Eligibility</th>
              <th className="px-4 py-3">Access Signals</th>
              <th className="px-4 py-3">Consent</th>
              <th className="px-4 py-3">Latest Case</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                  {m.externalMemberId}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {m.firstName} {m.lastName}
                  <div className="text-xs font-normal text-slate-500">
                    Prior No-Shows: {m.priorNoShowCount}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-700">
                  <div className="font-medium">{m.preferredLanguage}</div>
                  <div className="text-slate-500">
                    {m.geography} ({m.urbanicity})
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-700">
                  <div>{m.coverageType}</div>
                  <div className="text-slate-500">Status: {m.eligibilityStatus}</div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  <div>Transit: {m.transportationAccess}</div>
                  <div>Digital: {m.digitalAccessLevel}</div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <span
                    className={`rounded px-2 py-0.5 font-medium ${
                      m.consentSms
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    SMS: {m.consentSms ? "Opt-In" : "Phone Only"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {m.cases[0] ? (
                    <div className="flex items-center gap-2">
                      <Link href={`/cases/${m.cases[0].id}`} className="inline-flex items-center gap-1.5">
                        <CaseStatusBadge status={m.cases[0].status} />
                      </Link>
                      <Link
                        href={`/member-portal/${m.cases[0].id}`}
                        className="rounded border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800 hover:bg-teal-100"
                      >
                        Member View
                      </Link>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">None</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
