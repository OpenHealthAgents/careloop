import React from "react";
import { AppShell } from "@/components/AppShell";
import { ProvidersSearchClient } from "@/components/ProvidersSearchClient";
import { rankProvidersForReferral } from "@/domain/matching/provider-matcher";
import { requirePageSession } from "@/lib/auth/page-session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { providerRepository } from "@/repositories/provider-repository";

export const dynamic = "force-dynamic";

export default async function ProvidersPage() {
  const { session, permissions } = await requirePageSession(PERMISSIONS.PROVIDERS_READ);
  const canManageProviders = hasPermission(
    session.role,
    PERMISSIONS.PROVIDERS_MANAGE,
    session.customRoleCode
  );

  const providers = await providerRepository.listWithAvailabilities(session.tenantId);
  const initialMatches = rankProvidersForReferral(
    providers.map((p) => ({ ...p, verifiedSlots: p.availabilities })),
    {
      referralSpecialty: "Outpatient Behavioral Health",
      referralNetwork: "Horizon Medicaid",
      referralGeography: "Central Metro",
      preferredLanguage: "Spanish",
    }
  );

  return (
    <AppShell
      user={session}
      permissions={permissions}
      title="Providers"
      subtitle="Behavioral-health provider search & ranking with explicit separation between VERIFIED AVAILABILITY and stale DIRECTORY DATA."
    >
      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
        <strong>Data Integrity Policy:</strong> Stale directory records are explicitly tagged{" "}
        <strong>DIRECTORY DATA (UNVERIFIED)</strong> with a staleness indicator and{" "}
        <strong>never</strong> imply an appointment slot is available.
      </div>

      <ProvidersSearchClient
        initialMatches={JSON.parse(JSON.stringify(initialMatches))}
        canManageProviders={canManageProviders}
      />
    </AppShell>
  );
}
