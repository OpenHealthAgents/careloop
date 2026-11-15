import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CaseDetailClient } from "@/components/CaseDetailClient";
import { getAllowedNextCaseStatuses } from "@/domain/cases/state-machine";
import { rankProvidersForReferral } from "@/domain/matching/provider-matcher";
import { requirePageSession } from "@/lib/auth/page-session";
import { prisma } from "@/lib/db";
import { getCaseDetail } from "@/services/case-service";

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { session, permissions } = await requirePageSession("cases.read");
  const { id } = await params;

  let careCase;
  try {
    careCase = await getCaseDetail(session.tenantId, id);
  } catch {
    notFound();
  }

  const providers = await prisma.provider.findMany({
    where: { tenantId: session.tenantId },
    include: { availabilities: { where: { status: "AVAILABLE" } } },
  });

  const rankedProviders = rankProvidersForReferral(
    providers.map((p) => ({ ...p, verifiedSlots: p.availabilities })),
    {
      referralSpecialty: careCase.referral.specialty,
      behavioralHealthNeed: careCase.referral.behavioralHealthNeed,
      referralNetwork: careCase.referral.networkRequired,
      referralGeography: careCase.referral.geography,
      preferredLanguage: careCase.referral.preferredLanguage,
      digitalAccessLevel: careCase.member.digitalAccessLevel,
    }
  );

  return (
    <AppShell
      user={session}
      permissions={permissions}
      title={`Case Workspace — ${careCase.member.firstName} ${careCase.member.lastName}`}
      subtitle={`Referral ${careCase.referral.externalReferralId} • ${careCase.referral.specialty}`}
      actions={
        <div className="flex items-center gap-2">
          <Link
            href={`/member-portal/${careCase.id}`}
            className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-900 hover:bg-teal-100"
          >
            Preview Member Experience →
          </Link>
          <Link
            href="/cases"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            ← All Cases
          </Link>
          <Link
            href="/worklist"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Risk Worklist
          </Link>
        </div>
      }
    >
      <CaseDetailClient
        initialData={{
          careCase: JSON.parse(JSON.stringify(careCase)),
          rankedProviders: JSON.parse(JSON.stringify(rankedProviders)),
          allowedNextStatuses: [...getAllowedNextCaseStatuses(careCase.status)],
        }}
        permissions={permissions}
      />
    </AppShell>
  );
}
