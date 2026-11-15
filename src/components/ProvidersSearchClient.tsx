"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, CheckCircle2, Clock, Search, ShieldAlert } from "lucide-react";
import { AvailabilitySourceBadge } from "./StatusBadges";

export function ProvidersSearchClient({
  initialMatches,
  canManageProviders,
}: {
  initialMatches: any[];
  canManageProviders: boolean;
}) {
  const router = useRouter();
  const [matches, setMatches] = useState<any[]>(initialMatches);
  const [specialty, setSpecialty] = useState("Outpatient Behavioral Health");
  const [behavioralHealthNeed, setNeed] = useState("");
  const [network, setNetwork] = useState("Horizon Medicaid");
  const [geography, setGeography] = useState("Central Metro");
  const [language, setLanguage] = useState("Spanish");
  const [preferredModality, setModality] = useState<"ANY" | "TELEHEALTH" | "IN_PERSON">("ANY");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [searching, setSearching] = useState(false);

  const [addingForId, setAddingForId] = useState<string | null>(null);
  const [slotTime, setSlotTime] = useState(() => {
    const d = new Date(Date.now() + 2 * 86400000);
    d.setHours(11, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [slotModality, setSlotModality] = useState<"TELEHEALTH" | "IN_PERSON">("TELEHEALTH");

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    try {
      const res = await fetch("/api/providers/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specialty,
          behavioralHealthNeed,
          network,
          geography,
          language,
          preferredModality,
          verifiedOnly,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches);
      }
    } finally {
      setSearching(false);
    }
  }

  async function addVerifiedSlot(providerId: string) {
    const res = await fetch(`/api/providers/${providerId}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slotStartAt: new Date(slotTime).toISOString(),
        modality: slotModality,
        source: "VERIFIED_AVAILABILITY",
      }),
    });
    if (res.ok) {
      setAddingForId(null);
      router.refresh();
      // Re-run current search so new slot immediately updates ranking
      const searchRes = await fetch("/api/providers/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specialty,
          behavioralHealthNeed,
          network,
          geography,
          language,
          preferredModality,
          verifiedOnly,
        }),
      });
      if (searchRes.ok) {
        const data = await searchRes.json();
        setMatches(data.matches);
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Search & Ranking Criteria */}
      <form
        onSubmit={runSearch}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Search className="h-4 w-4 text-teal-700" />
            Provider Matching & Ranking Search
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
            />
            Show VERIFIED AVAILABILITY only
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">Specialty</label>
            <input
              type="text"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="e.g. Outpatient Behavioral Health"
              className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">BH Need</label>
            <input
              type="text"
              value={behavioralHealthNeed}
              onChange={(e) => setNeed(e.target.value)}
              placeholder="e.g. Depression, Recovery"
              className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">Network</label>
            <input
              type="text"
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              placeholder="e.g. Horizon Medicaid"
              className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">Geography</label>
            <input
              type="text"
              value={geography}
              onChange={(e) => setGeography(e.target.value)}
              placeholder="e.g. Central Metro"
              className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">Language</label>
            <input
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="e.g. Spanish"
              className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">Modality</label>
            <select
              value={preferredModality}
              onChange={(e) => setModality(e.target.value as any)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            >
              <option value="ANY">Any Modality</option>
              <option value="TELEHEALTH">Telehealth Preferred</option>
              <option value="IN_PERSON">In-Person Preferred</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={searching}
          className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
        >
          {searching ? "Ranking Providers..." : "Search & Rank Providers"}
        </button>
      </form>

      {/* Ranked Provider Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {matches.map((m) => {
          const p = m.provider;
          return (
            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900">{p.name}</h2>
                    <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">
                      {m.matchScore}% Match
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {p.organizationName} • NPI {p.npi}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <AvailabilitySourceBadge source={m.availabilityLabel} />
                  <span
                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${
                      m.isStale
                        ? "bg-amber-100 text-amber-900"
                        : "bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    {m.stalenessLabel}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Specialty:</span>{" "}
                  <span className="font-medium text-slate-800">{p.specialty}</span>
                </div>
                <div>
                  <span className="text-slate-500">Geography:</span>{" "}
                  <span className="font-medium text-slate-800">
                    {p.geography} ({p.county})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Languages:</span>{" "}
                  <span className="font-medium text-slate-800">{p.languages.join(", ")}</span>
                </div>
                <div>
                  <span className="text-slate-500">Networks:</span>{" "}
                  <span className="font-medium text-slate-800">{p.networkNames.join(", ")}</span>
                </div>
              </div>

              {/* Why It Matched */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Why Matched
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {m.reasons.map((r: string, i: number) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-900"
                    >
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      {r}
                    </span>
                  ))}
                  {m.mismatches.map((mm: string, i: number) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
                    >
                      {mm}
                    </span>
                  ))}
                </div>
              </div>

              {/* Explicit Availability Section */}
              <div className="rounded-lg bg-slate-50 p-3 text-xs">
                {m.availabilityLabel === "VERIFIED AVAILABILITY" ? (
                  <div>
                    <div className="font-semibold text-emerald-800">
                      {(p.verifiedSlots ?? p.availabilities ?? []).length} Verified Open Slot(s)
                    </div>
                    <div className="mt-1 space-y-1 text-slate-700">
                      {(p.verifiedSlots ?? p.availabilities ?? []).map((s: any) => (
                        <div key={s.id}>
                          • {new Date(s.slotStartAt).toLocaleString()} ({s.modality})
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-amber-900">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <span>{m.availabilityWarning}</span>
                  </div>
                )}
              </div>

              {canManageProviders && (
                <div>
                  {addingForId === p.id ? (
                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
                      <input
                        type="datetime-local"
                        value={slotTime}
                        onChange={(e) => setSlotTime(e.target.value)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                      <select
                        value={slotModality}
                        onChange={(e) => setSlotModality(e.target.value as any)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        <option value="TELEHEALTH">TELEHEALTH</option>
                        <option value="IN_PERSON">IN_PERSON</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => addVerifiedSlot(p.id)}
                        className="rounded bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white"
                      >
                        Save Verified Slot
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddingForId(null)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingForId(p.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                      Add Verified Availability Slot
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
