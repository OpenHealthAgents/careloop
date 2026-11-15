import React from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ReferralIngestionClient } from "@/components/ReferralIngestionClient";
import { CaseStatusBadge, RiskTierBadge } from "@/components/StatusBadges";
import { requirePageSession } from "@/lib/auth/page-session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ReferralsPage() {
  const { session, permissions } = await requirePageSession(PERMISSIONS.REFERRALS_READ);
  const canIngest = hasPermission(
    session.role,
    PERMISSIONS.REFERRALS_MANAGE,
    session.customRoleCode
  );

  const [referrals, batches] = await Promise.all([
    prisma.referral.findMany({
      where: { tenantId: session.tenantId },
      include: { member: true, careCase: true },
      orderBy: { referralDate: "desc" },
    }),
    prisma.ingestionBatch.findMany({
      where: { tenantId: session.tenantId },
      include: {
        uploadedBy: { select: { name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <AppShell
      user={session}
      permissions={permissions}
      title="Referrals"
      subtitle="Behavioral-health referral intake, CSV ingestion preview/confirm, duplicate detection, and import history."
    >
      <div className="space-y-6">
        <ReferralIngestionClient canIngest={canIngest} />

        {/* Import History */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="text-sm font-semibold text-slate-900">Import History & Failed-Row Reports</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Audit trail of every CSV/API ingestion batch in this tenant. Failed rows are preserved and downloadable.
          </p>
          {batches.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Timestamp</th>
                    <th className="px-3 py-2">File / Source</th>
                    <th className="px-3 py-2">Uploaded By</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Imported</th>
                    <th className="px-3 py-2">Failed / Skipped</th>
                    <th className="px-3 py-2 text-right">Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batches.map((b) => (
                    <tr key={b.id}>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                        {new Date(b.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {b.fileName}{" "}
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                          {b.sourceType}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {b.uploadedBy?.name ?? "SYSTEM"}
                      </td>
                      <td className="px-3 py-2">{b.totalRows}</td>
                      <td className="px-3 py-2 font-semibold text-emerald-700">{b.successRows}</td>
                      <td className="px-3 py-2 font-semibold text-rose-700">{b.errorRows}</td>
                      <td className="px-3 py-2 text-right">
                        {b.errorRows > 0 ? (
                          <a
                            href={`/api/referrals/ingest/${b.id}/failed-rows`}
                            className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 font-semibold text-rose-800 hover:bg-rose-100"
                          >
                            <Download className="h-3 w-3" />
                            Failed Rows CSV
                          </a>
                        ) : (
                          <span className="text-slate-400">Clean</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">No CSV import batches recorded yet.</p>
          )}
        </div>

        {/* Referrals Table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Referral ID</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Need & Specialty</th>
                <th className="px-4 py-3">Language / Geo</th>
                <th className="px-4 py-3">Eligibility</th>
                <th className="px-4 py-3">Case Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {referrals.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                    {r.externalReferralId}
                    <div className="text-[11px] font-normal text-slate-400">{r.sourceSystem}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {new Date(r.referralDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-semibold text-slate-900">
                      {r.member.firstName} {r.member.lastName}
                    </div>
                    <div className="text-slate-500">{r.member.externalMemberId}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-medium text-slate-800">{r.specialty}</div>
                    <div className="text-slate-500">{r.behavioralHealthNeed}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {r.preferredLanguage} • {r.geography}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-slate-700">
                    {r.eligibilityVerified}
                  </td>
                  <td className="px-4 py-3">
                    {r.careCase && (
                      <Link href={`/cases/${r.careCase.id}`} className="inline-flex items-center gap-1.5">
                        <CaseStatusBadge status={r.careCase.status} />
                        <RiskTierBadge riskTier={r.careCase.riskLevel} />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
