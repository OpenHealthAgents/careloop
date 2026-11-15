import React from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requirePageSession } from "@/lib/auth/page-session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MemberPortalDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { session, permissions } = await requirePageSession("cases.read");
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  const cases = await prisma.case.findMany({
    where: {
      tenantId: session.tenantId,
      ...(q
        ? {
            OR: [
              { member: { firstName: { contains: q, mode: "insensitive" } } },
              { member: { lastName: { contains: q, mode: "insensitive" } } },
              { member: { externalMemberId: { contains: q, mode: "insensitive" } } },
              { referral: { externalReferralId: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      member: {
        select: {
          firstName: true,
          lastName: true,
          externalMemberId: true,
          preferredLanguage: true,
          preferredContactChannel: true,
        },
      },
      referral: {
        select: {
          externalReferralId: true,
          behavioralHealthNeed: true,
          networkRequired: true,
        },
      },
    },
    orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
    take: 24,
  });

  return (
    <AppShell
      user={session}
      permissions={permissions}
      title="Member Experience"
      subtitle="Preview the supportive, plain-language member-facing CareLoop view (with zero internal risk scores or AI jargon)."
    >
      <form method="GET" className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
        <input
          type="text"
          name="q"
          defaultValue={q}
          aria-label="Search member portal cases"
          placeholder="Search by member name, member ID, or referral ID (e.g., Elena or REF-2026-1001)..."
          className="flex-1 min-w-60 rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-teal-600 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-600"
        >
          Search
        </button>
        {q && (
          <Link
            href="/member-portal"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cases.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between gap-4"
          >
            <div>
              <div className="text-xs font-mono text-slate-500">
                {c.referral.externalReferralId} • {c.member.externalMemberId}
              </div>
              <h2 className="mt-1 text-base font-bold text-slate-900">
                {c.member.firstName} {c.member.lastName}
              </h2>
              <p className="mt-1 text-xs text-slate-600">{c.referral.behavioralHealthNeed}</p>
              <p className="mt-1 text-xs text-slate-500">
                {c.referral.networkRequired} • Prefers {c.member.preferredLanguage} via{" "}
                {c.member.preferredContactChannel}
              </p>
            </div>

            <Link
              href={`/member-portal/${c.id}`}
              className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-600"
            >
              Open Member View →
            </Link>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
