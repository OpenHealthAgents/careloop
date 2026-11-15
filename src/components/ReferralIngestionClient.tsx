"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  FileUp,
  RotateCcw,
  UploadCloud,
} from "lucide-react";

const SAMPLE_CSV = `member_id,first_name,last_name,dob_year,referral_id,referral_date,behavioral_health_need,specialty,urgency,geography,urbanicity,network,coverage_type,eligibility_verified,preferred_language,preferred_contact_channel,consent_sms,digital_access_level,transportation_access,prior_no_show_count,referring_provider_name,operational_notes
MEM-9021,Lucia,Fernandez,1988,REF-CSV-2001,${new Date().toISOString().slice(0, 10)},Anxiety & Adjustment Support,Outpatient Behavioral Health,PRIORITY,Central Metro,URBAN,Horizon Medicaid,MEDICAID,VERIFIED,Spanish,SMS,true,LIMITED,NONE,1,Dr. Rivera PCP,Prefers Spanish provider; lacks car for in-person clinic
MEM-9022,Arthur,Pendleton,1965,REF-CSV-2002,${new Date().toISOString().slice(0, 10)},Outpatient Psychiatry Consultation,Outpatient Psychiatry,ROUTINE,East Valley,SUBURBAN,Horizon Medicaid,MEDICARE_ADVANTAGE,UNVERIFIED,English,PHONE,false,NONE,LIMITED,2,Dr. Park PCP,Pending authorization verification and copay questions`;

export function ReferralIngestionClient({ canIngest }: { canIngest: boolean }) {
  const router = useRouter();
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("referrals-batch.csv");
  const [fileSizeBytes, setFileSizeBytes] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState<"preview" | "confirm" | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canIngest) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
        Your current permissions grant read-only access to referrals (<code>referrals.read</code>).
        Users with <code>referrals.manage</code> can upload, preview, and import CSV batches.
      </div>
    );
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPreview(null);
    setResult(null);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Only .csv files are permitted for referral ingestion.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Selected file exceeds the 2 MB maximum upload limit.");
      return;
    }
    setFileName(file.name);
    setFileSizeBytes(file.size);
    const text = await file.text();
    setCsvText(text);
  }

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setLoading("preview");
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/referrals/ingest/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, csvText, fileSizeBytes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "CSV validation preview failed");
        setPreview(null);
        return;
      }
      setPreview(data.preview);
    } catch {
      setError("Network error while validating CSV");
    } finally {
      setLoading(null);
    }
  }

  async function handleConfirmImport() {
    setLoading("confirm");
    setError(null);
    try {
      const res = await fetch("/api/referrals/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, csvText, fileSizeBytes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Import failed");
        return;
      }
      setResult(data);
      setPreview(null);
      router.refresh();
    } catch {
      setError("Network error while importing CSV");
    } finally {
      setLoading(null);
    }
  }

  function resetWizard() {
    setCsvText("");
    setFileName("referrals-batch.csv");
    setFileSizeBytes(undefined);
    setPreview(null);
    setResult(null);
    setError(null);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <UploadCloud className="h-4 w-4 text-teal-700" />
            CSV Referral Ingestion Wizard (Validate → Preview → Confirm)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Required fields: <code>member_id</code>, <code>first_name</code>,{" "}
            <code>last_name</code>, <code>referral_id</code>, <code>referral_date</code>,{" "}
            <code>behavioral_health_need</code>, <code>specialty</code>, <code>geography</code>,{" "}
            <code>network</code>, <code>eligibility_verified</code>,{" "}
            <code>preferred_language</code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/samples/careloop-sample-referrals.csv"
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            Download Sample CSV
          </a>
          <button
            type="button"
            onClick={() => {
              setFileName("sample-bh-referrals.csv");
              setFileSizeBytes(undefined);
              setCsvText(SAMPLE_CSV);
              setPreview(null);
              setResult(null);
              setError(null);
            }}
            className="rounded-md border border-teal-600 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50"
          >
            Load Sample CSV
          </button>
        </div>
      </div>

      {/* Step 1: Upload / Input */}
      <form onSubmit={handlePreview} className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
            <FileUp className="h-3.5 w-3.5" />
            Choose .csv file (max 2 MB)
            <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
          </label>
          <span className="text-xs text-slate-500">
            File: <strong className="text-slate-700">{fileName}</strong>
          </span>
        </div>

        <textarea
          rows={5}
          required
          value={csvText}
          onChange={(e) => {
            setCsvText(e.target.value);
            setPreview(null);
            setResult(null);
          }}
          placeholder="Paste CSV content or upload a .csv file..."
          className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs focus:border-teal-600 focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={loading !== null || !csvText.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Eye className="h-3.5 w-3.5" />
            {loading === "preview" ? "Validating..." : "Validate & Preview CSV"}
          </button>
          {(csvText || preview || result) && (
            <button
              type="button"
              onClick={resetWizard}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 2: Preview & Row-level Errors + Confirmation */}
      {preview && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Import Preview — {preview.fileName}
              </h3>
              <p className="text-xs text-slate-500">
                Review row validation and duplicate checks before confirming database import.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded bg-white px-2.5 py-1 text-slate-700 border border-slate-200">
                Total: {preview.totalRows}
              </span>
              <span className="rounded bg-emerald-50 px-2.5 py-1 text-emerald-800 border border-emerald-200">
                Valid & Ready: {preview.validCount}
              </span>
              <span className="rounded bg-amber-50 px-2.5 py-1 text-amber-800 border border-amber-200">
                Duplicates: {preview.duplicateCount}
              </span>
              <span className="rounded bg-rose-50 px-2.5 py-1 text-rose-800 border border-rose-200">
                Errors / Skipped: {preview.errorCount}
              </span>
            </div>
          </div>

          {preview.readyRows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Referral ID</th>
                    <th className="px-3 py-2">Member</th>
                    <th className="px-3 py-2">Specialty</th>
                    <th className="px-3 py-2">Network / Elig.</th>
                    <th className="px-3 py-2">Language / Geo</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.readyRows.map((r: any) => (
                    <tr key={r.rowNumber}>
                      <td className="px-3 py-2 text-slate-500">{r.rowNumber}</td>
                      <td className="px-3 py-2 font-mono font-semibold text-slate-800">
                        {r.externalReferralId}
                      </td>
                      <td className="px-3 py-2">
                        {r.data.firstName} {r.data.lastName} ({r.data.externalMemberId})
                      </td>
                      <td className="px-3 py-2">{r.data.specialty}</td>
                      <td className="px-3 py-2">
                        {r.data.networkRequired} ({r.data.eligibilityVerified})
                      </td>
                      <td className="px-3 py-2">
                        {r.data.preferredLanguage} • {r.data.geography}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
                          READY
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.errors.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-rose-200 bg-white">
              <div className="border-b border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900">
                Row-Level Validation & Duplicate Report ({preview.errors.length} row(s) will NOT be imported)
              </div>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Referral ID</th>
                    <th className="px-3 py-2">Issue Type</th>
                    <th className="px-3 py-2">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.errors.map((err: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-mono">{err.rowNumber}</td>
                      <td className="px-3 py-2 font-mono text-slate-700">
                        {err.externalReferralId || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-rose-50 px-2 py-0.5 font-semibold text-rose-800">
                          {err.errorType}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-rose-800">{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel Preview
            </button>
            <button
              type="button"
              disabled={loading !== null || preview.validCount === 0}
              onClick={handleConfirmImport}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {loading === "confirm"
                ? "Importing & Running AI Triage..."
                : `Confirm & Import ${preview.validCount} Valid Referral(s)`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Import Results */}
      {result && (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold text-emerald-950">
              Import Complete ({result.batch.fileName}): {result.batch.successRows} imported,{" "}
              {result.batch.errorRows} failed/skipped
            </div>
            {result.batch.errorRows > 0 && (
              <a
                href={`/api/referrals/ingest/${result.batch.id}/failed-rows`}
                className="inline-flex items-center gap-1 rounded border border-rose-300 bg-white px-2.5 py-1 font-semibold text-rose-800 hover:bg-rose-50"
              >
                <Download className="h-3.5 w-3.5" />
                Download Failed Rows CSV
              </a>
            )}
          </div>

          {result.createdCases?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {result.createdCases.map((c: any) => (
                <Link
                  key={c.caseId}
                  href={`/cases/${c.caseId}`}
                  className="rounded-md border border-emerald-300 bg-white px-2.5 py-1 font-medium text-emerald-900 hover:bg-emerald-50"
                >
                  {c.externalReferralId} ({c.riskTier}) → Open Case
                </Link>
              ))}
            </div>
          )}

          {result.errors?.length > 0 && (
            <ul className="list-disc pl-4 text-rose-900">
              {result.errors.map((err: any, i: number) => (
                <li key={i}>
                  Row {err.rowNumber} ({err.errorType}): {err.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
