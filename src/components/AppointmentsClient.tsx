"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { APPOINTMENT_STATUS_ORDER } from "@/domain/appointments/state-machine";
import { AvailabilitySourceBadge } from "./StatusBadges";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { EmptyState } from "./ui/EmptyState";
import { FeedbackBanner } from "./ui/FeedbackBanner";

export function AppointmentsClient({
  appointments,
  canManage,
}: {
  appointments: any[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>(() => {
    const d = new Date(Date.now() + 3 * 86_400_000);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [confirmAppt, setConfirmAppt] = useState<{
    id: string;
    action: "NO_SHOW" | "CANCEL";
    label: string;
  } | null>(null);

  const filtered = useMemo(
    () =>
      appointments.filter((a) =>
        statusFilter === "ALL" ? true : a.status === statusFilter
      ),
    [appointments, statusFilter]
  );

  async function updateAppt(id: string, payload: Record<string, unknown>, message: string) {
    setBusyId(id);
    setBanner(null);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setBanner({ type: "error", text: json?.error?.message ?? "Failed to update appointment." });
      } else {
        setBanner({ type: "success", text: message });
        router.refresh();
      }
    } catch {
      setBanner({ type: "error", text: "Network error updating appointment." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`rounded-md px-2.5 py-1 font-semibold ${
              statusFilter === "ALL"
                ? "bg-teal-700 text-white"
                : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            All ({appointments.length})
          </button>
          {APPOINTMENT_STATUS_ORDER.map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-md px-2.5 py-1 font-semibold ${
                statusFilter === st
                  ? "bg-teal-700 text-white"
                  : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
        <span className="text-slate-500">
          Scheduled appointments NEVER count as completed care until verified.
        </span>
      </div>

      {banner && (
        <FeedbackBanner
          type={banner.type}
          text={banner.text}
          onDismiss={() => setBanner(null)}
        />
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Scheduled Time</th>
              <th className="px-4 py-3">Member & Case</th>
              <th className="px-4 py-3">Provider & Modality</th>
              <th className="px-4 py-3">Booking Source</th>
              <th className="px-4 py-3">Status & Verification</th>
              <th className="px-4 py-3">Reminder</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((a) => {
              const latestVerif = a.verifications?.[0];
              return (
                <React.Fragment key={a.id}>
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs font-medium text-slate-900">
                      {new Date(a.scheduledStartAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <Link
                        href={`/cases/${a.caseId}`}
                        className="font-semibold text-teal-700 hover:underline"
                      >
                        {a.member.firstName} {a.member.lastName}
                      </Link>
                      <div className="text-slate-500">{a.careCase.referral.externalReferralId}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium text-slate-900">{a.provider.name}</div>
                      <div className="text-slate-500">{a.modality}</div>
                    </td>
                    <td className="px-4 py-3">
                      <AvailabilitySourceBadge source={a.availabilitySourceAtBooking} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-800">
                        {a.status}
                      </span>
                      {latestVerif && (
                        <div className="mt-1 text-[11px] text-slate-500">
                          {latestVerif.signalType} • {latestVerif.verificationStatus ?? "VERIFIED"} (
                          {Math.round((latestVerif.confidence ?? 0) * 100)}%)
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {a.reminderSentAt
                        ? `${a.reminderChannel} (${new Date(a.reminderSentAt).toLocaleDateString()})`
                        : "Not sent"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManage && (
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          {(a.status === "REQUESTED" || a.status === "PROPOSED") && (
                            <button
                              disabled={busyId !== null}
                              onClick={() =>
                                updateAppt(
                                  a.id,
                                  { action: "SCHEDULE" },
                                  "Appointment marked SCHEDULED."
                                )
                              }
                              className="rounded bg-teal-700 px-2 py-1 text-xs font-semibold text-white hover:bg-teal-600"
                            >
                              Mark Scheduled
                            </button>
                          )}
                          {(a.status === "SCHEDULED" || a.status === "CONFIRMED") && (
                            <button
                              disabled={busyId !== null}
                              onClick={() =>
                                updateAppt(
                                  a.id,
                                  { action: "SEND_REMINDER" },
                                  "Reminder dispatched."
                                )
                              }
                              className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Remind
                            </button>
                          )}
                          {a.status === "SCHEDULED" && (
                            <button
                              disabled={busyId !== null}
                              onClick={() =>
                                updateAppt(
                                  a.id,
                                  { action: "CONFIRM" },
                                  "Appointment confirmed."
                                )
                              }
                              className="rounded bg-sky-700 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-600"
                            >
                              Confirm
                            </button>
                          )}
                          {(a.status === "SCHEDULED" ||
                            a.status === "CONFIRMED" ||
                            a.status === "UNKNOWN") && (
                            <>
                              <button
                                disabled={busyId !== null}
                                onClick={() =>
                                  updateAppt(
                                    a.id,
                                    { action: "COMPLETE" },
                                    "Appointment marked COMPLETED and verified."
                                  )
                                }
                                className="rounded bg-emerald-700 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                              >
                                Complete
                              </button>
                              <button
                                disabled={busyId !== null}
                                onClick={() =>
                                  setConfirmAppt({
                                    id: a.id,
                                    action: "NO_SHOW",
                                    label: `${a.member.firstName} ${a.member.lastName}`,
                                  })
                                }
                                className="rounded border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                              >
                                No-Show
                              </button>
                              <button
                                disabled={busyId !== null}
                                onClick={() =>
                                  updateAppt(
                                    a.id,
                                    { action: "MARK_UNKNOWN" },
                                    "Appointment marked UNKNOWN pending verification."
                                  )
                                }
                                className="rounded border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                              >
                                Unknown
                              </button>
                            </>
                          )}
                          {a.status !== "COMPLETED" &&
                            a.status !== "CANCELLED" &&
                            a.status !== "RESCHEDULED" && (
                              <>
                                <button
                                  disabled={busyId !== null}
                                  onClick={() =>
                                    setRescheduleId(rescheduleId === a.id ? null : a.id)
                                  }
                                  className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  Reschedule
                                </button>
                                <button
                                  disabled={busyId !== null}
                                  onClick={() =>
                                    setConfirmAppt({
                                      id: a.id,
                                      action: "CANCEL",
                                      label: `${a.member.firstName} ${a.member.lastName}`,
                                    })
                                  }
                                  className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                        </div>
                      )}
                    </td>
                  </tr>
                  {rescheduleId === a.id && (
                    <tr className="bg-slate-50">
                      <td colSpan={7} className="px-4 py-3 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-700">New Time:</span>
                          <input
                            type="datetime-local"
                            value={rescheduleDate}
                            onChange={(e) => setRescheduleDate(e.target.value)}
                            className="rounded border border-slate-300 bg-white px-2.5 py-1"
                          />
                          <button
                            onClick={async () => {
                              await updateAppt(
                                a.id,
                                {
                                  action: "RESCHEDULE",
                                  rescheduledStartAt: new Date(rescheduleDate).toISOString(),
                                  note: "Rescheduled via Appointments Console",
                                },
                                "Appointment rescheduled cleanly."
                              );
                              setRescheduleId(null);
                            }}
                            className="rounded bg-teal-700 px-3 py-1 font-semibold text-white"
                          >
                            Save Reschedule
                          </button>
                          <button
                            onClick={() => setRescheduleId(null)}
                            className="rounded border border-slate-300 px-2.5 py-1"
                          >
                            Close
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6">
                  <EmptyState
                    title="No appointments in this status"
                    description="Switch the appointment status filter to view other scheduled, confirmed, missed, or completed visits."
                    action={
                      statusFilter !== "ALL" && (
                        <button
                          type="button"
                          onClick={() => setStatusFilter("ALL")}
                          className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600"
                        >
                          Show All Appointments
                        </button>
                      )
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmAppt !== null}
        title={
          confirmAppt?.action === "NO_SHOW"
            ? `Mark NO_SHOW (${confirmAppt.label})?`
            : `Cancel Appointment (${confirmAppt?.label ?? ""})?`
        }
        description={
          confirmAppt?.action === "NO_SHOW"
            ? "Flags case for re-engagement outreach and records a missed visit event."
            : "Cancelling releases this booking and records the reason in audit history."
        }
        confirmLabel={confirmAppt?.action === "NO_SHOW" ? "Confirm No-Show" : "Confirm Cancel"}
        tone={confirmAppt?.action === "NO_SHOW" ? "warning" : "danger"}
        requireNote={confirmAppt?.action === "CANCEL"}
        busy={busyId !== null}
        onCancel={() => setConfirmAppt(null)}
        onConfirm={async (note) => {
          if (!confirmAppt) return;
          if (confirmAppt.action === "NO_SHOW") {
            await updateAppt(
              confirmAppt.id,
              { action: "NO_SHOW", note: note || undefined },
              "Marked NO_SHOW and flagged for review."
            );
          } else {
            await updateAppt(
              confirmAppt.id,
              { action: "CANCEL", note },
              "Appointment cancelled."
            );
          }
          setConfirmAppt(null);
        }}
      />
    </div>
  );
}
