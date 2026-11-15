"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Globe,
  HeartHandshake,
  HelpCircle,
  MapPin,
  MessageCircle,
  RefreshCw,
  Video,
} from "lucide-react";
import type { MemberPortalView } from "@/services/member-portal-service";

export function MemberPortalClient({
  initialPortal,
  canInteract,
}: {
  initialPortal: MemberPortalView;
  canInteract: boolean;
}) {
  const router = useRouter();
  const [portal, setPortal] = useState<MemberPortalView>(initialPortal);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Preferences form
  const [preferredLanguage, setPreferredLanguage] = useState(
    initialPortal.member.preferredLanguage
  );
  const [preferredChannel, setPreferredChannel] = useState(
    initialPortal.member.preferredContactChannel as "SMS" | "PHONE" | "EMAIL" | "PORTAL"
  );
  const [consentSms, setConsentSms] = useState(initialPortal.member.consentSms);
  const [consentOutreach, setConsentOutreach] = useState(initialPortal.member.consentOutreach);

  // Scheduling request form (for providers without verified open times or custom day/time request)
  const [requestProviderId, setRequestProviderId] = useState<string>(
    initialPortal.selectedProviderId ?? initialPortal.providerChoices[0]?.id ?? ""
  );
  const [requestDateTime, setRequestDateTime] = useState<string>(() => {
    const d = new Date(Date.now() + 3 * 86_400_000);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [requestModality, setRequestModality] = useState<"TELEHEALTH" | "IN_PERSON">("TELEHEALTH");

  // Rescheduling inline drawer
  const [rescheduleApptId, setRescheduleApptId] = useState<string | null>(null);
  const [rescheduleDateTime, setRescheduleDateTime] = useState<string>(() => {
    const d = new Date(Date.now() + 5 * 86_400_000);
    d.setHours(14, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [rescheduleReason, setRescheduleReason] = useState("Need a different time of day");

  // Help / Question form (minimal questions)
  const [supportKind, setSupportKind] = useState<"ASSISTANCE" | "QUESTION">("ASSISTANCE");
  const [supportTopic, setSupportTopic] = useState("Scheduling help");
  const [supportMessage, setSupportMessage] = useState("");

  const isEs = portal.member.preferredLanguage.toLowerCase().startsWith("span");

  async function runAction(
    key: string,
    payload: Record<string, unknown>,
    successMessage: string
  ) {
    setBusy(key);
    setNotice(null);
    try {
      const res = await fetch(`/api/member-portal/${portal.caseId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({
          type: "error",
          text: json?.error?.message ?? "We could not complete that right now. Please try again.",
        });
        return;
      }
      if (json.portal) {
        setPortal(json.portal);
      }
      setNotice({ type: "success", text: successMessage });
      router.refresh();
    } catch {
      setNotice({
        type: "error",
        text: "Connection issue. Please try again in a moment.",
      });
    } finally {
      setBusy(null);
    }
  }

  const activeAppointments = portal.appointments.filter(
    (a) => a.status !== "CANCELLED" && a.status !== "RESCHEDULED"
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Staff preview convenience bar */}
      <div className="border-b border-slate-200 bg-slate-900 px-4 py-2 text-xs text-slate-200">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
          <span>
            Member-Facing CareLoop Preview • <strong>{portal.member.firstName}</strong> (
            {portal.referralCode})
          </span>
          <div className="flex items-center gap-3">
            <Link href={`/cases/${portal.caseId}`} className="text-teal-300 hover:underline">
              ← Return to Care Manager Case Workspace
            </Link>
            <Link href="/member-portal" className="text-slate-300 hover:underline">
              Switch Member
            </Link>
          </div>
        </div>
      </div>

      {/* Member Portal Friendly Header */}
      <header className="border-b border-teal-100 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white">
              <HeartHandshake className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                {isEs ? `Hola, ${portal.member.firstName}` : `Hi ${portal.member.firstName}, let's get your care set up`}
              </h1>
              <p className="text-xs text-slate-600">
                {isEs ? "Servicio de apoyo para coordinar su cita" : "Personal appointment coordination support"} •{" "}
                {portal.insurancePlan}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Globe className="h-4 w-4 text-teal-700" aria-hidden="true" />
            <label htmlFor="quick-language" className="sr-only">
              Language
            </label>
            <select
              id="quick-language"
              disabled={!canInteract || busy !== null}
              value={preferredLanguage}
              onChange={(e) => {
                const nextLang = e.target.value;
                setPreferredLanguage(nextLang);
                runAction(
                  "quick-lang",
                  {
                    action: "UPDATE_PREFERENCES",
                    preferredLanguage: nextLang,
                    preferredContactChannel: preferredChannel,
                    consentSms,
                    consentOutreach,
                  },
                  nextLang.startsWith("Span")
                    ? "Idioma actualizado a Español."
                    : `Preferred language updated to ${nextLang}.`
                );
              }}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-medium text-slate-800"
            >
              <option value="English">English</option>
              <option value="Spanish">Español (Spanish)</option>
              <option value="Mandarin">Mandarin</option>
              <option value="Vietnamese">Vietnamese</option>
            </select>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        {notice && (
          <div
            role="status"
            aria-live="polite"
            className={`rounded-xl border px-4 py-3 text-sm font-medium ${
              notice.type === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-rose-300 bg-rose-50 text-rose-900"
            }`}
          >
            {notice.text}
          </div>
        )}

        {/* 1. Referral Notification */}
        <section
          aria-labelledby="referral-notification-heading"
          className="rounded-2xl border border-teal-200 bg-linear-to-br from-teal-50 to-white p-6 shadow-xs"
        >
          <span className="inline-block rounded-full bg-teal-700 px-3 py-0.5 text-xs font-semibold text-white">
            {isEs ? "Su referencia de atención" : "Your Care Referral"}
          </span>
          <h2 id="referral-notification-heading" className="mt-3 text-lg font-bold text-slate-900 leading-snug">
            {portal.referralNotification.headline}
          </h2>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed">
            {portal.referralNotification.subtext}
          </p>
        </section>

        {/* 2. Upcoming Appointments & Confirmation / Reminder / Rescheduling */}
        {activeAppointments.length > 0 && (
          <section
            aria-labelledby="your-appointments-heading"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4"
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-teal-700" aria-hidden="true" />
              <h2 id="your-appointments-heading" className="text-base font-bold text-slate-900">
                {isEs ? "Su cita" : "Your Appointment"}
              </h2>
            </div>

            {activeAppointments.map((appt) => (
              <div
                key={appt.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-bold text-slate-900">{appt.providerName}</div>
                    <div className="text-xs text-slate-600">{appt.organizationName}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-medium text-slate-800">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-teal-700" aria-hidden="true" />
                        {new Date(appt.scheduledStartAt).toLocaleString()}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-300 px-2.5 py-0.5 text-xs">
                        {appt.modality === "TELEHEALTH"
                          ? isEs
                            ? "Cita por video"
                            : "Video visit"
                          : isEs
                            ? "En persona"
                            : "In-person visit"}
                      </span>
                    </div>
                  </div>
                  <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-900">
                    {appt.plainStatusLabel}
                  </span>
                </div>

                {appt.reminderSentAt && (
                  <p className="text-xs text-emerald-800">
                    ✓ {isEs ? "Recordatorio enviado" : "Reminder sent"} ({appt.reminderChannel}) —{" "}
                    {new Date(appt.reminderSentAt).toLocaleString()}
                  </p>
                )}

                {canInteract && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(appt.status === "SCHEDULED" || appt.status === "PROPOSED") && (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          runAction(
                            `confirm-${appt.id}`,
                            { action: "CONFIRM_APPOINTMENT", appointmentId: appt.id },
                            isEs
                              ? "¡Gracias! Su cita ha sido confirmada."
                              : "Thank you! Your appointment is confirmed."
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-600 focus-visible:outline-2 focus-visible:outline-teal-700"
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        {isEs ? "Confirmar asistencia" : "Confirm I Will Attend"}
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        runAction(
                          `remind-${appt.id}`,
                          {
                            action: "REQUEST_REMINDER",
                            appointmentId: appt.id,
                            channel: preferredChannel,
                          },
                          isEs
                            ? `Recordatorio enviado por ${preferredChannel}.`
                            : `Reminder sent via ${preferredChannel}.`
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      <Bell className="h-4 w-4 text-teal-700" aria-hidden="true" />
                      {isEs ? "Enviarme recordatorio" : `Send Reminder (${preferredChannel})`}
                    </button>

                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        setRescheduleApptId(rescheduleApptId === appt.id ? null : appt.id)
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      {isEs ? "Cambiar horario" : "Need a Different Time?"}
                    </button>
                  </div>
                )}

                {rescheduleApptId === appt.id && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                    <div className="text-xs font-semibold text-slate-800">
                      {isEs ? "Solicitar nuevo horario" : "Choose a new preferred day & time"}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor={`resched-dt-${appt.id}`} className="block text-xs text-slate-600 mb-1">
                          {isEs ? "Fecha y hora preferida" : "New preferred date & time"}
                        </label>
                        <input
                          id={`resched-dt-${appt.id}`}
                          type="datetime-local"
                          value={rescheduleDateTime}
                          onChange={(e) => setRescheduleDateTime(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label htmlFor={`resched-why-${appt.id}`} className="block text-xs text-slate-600 mb-1">
                          {isEs ? "Nota breve (opcional)" : "Quick note (optional)"}
                        </label>
                        <input
                          id={`resched-why-${appt.id}`}
                          type="text"
                          value={rescheduleReason}
                          onChange={(e) => setRescheduleReason(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={async () => {
                          await runAction(
                            `resched-${appt.id}`,
                            {
                              action: "RESCHEDULE_APPOINTMENT",
                              appointmentId: appt.id,
                              requestedStartAt: new Date(rescheduleDateTime).toISOString(),
                              reason: rescheduleReason,
                            },
                            isEs
                              ? "Solicitud de reprogramación enviada."
                              : "Reschedule request sent! We will update your confirmation."
                          );
                          setRescheduleApptId(null);
                        }}
                        className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-600"
                      >
                        {isEs ? "Solicitar cambio" : "Request New Time"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRescheduleApptId(null)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700"
                      >
                        {isEs ? "Cancelar" : "Cancel"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* 3. Provider Choices & Appointment Options */}
        <section
          aria-labelledby="provider-choices-heading"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4"
        >
          <div>
            <h2 id="provider-choices-heading" className="text-base font-bold text-slate-900">
              {isEs ? "Opciones de proveedores para usted" : "Providers Available for You"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              {isEs
                ? "Seleccione un proveedor y elija un horario abierto o envíe su preferencia."
                : "Pick a provider below and click an open time—or tell us what days work best for you."}
            </p>
          </div>

          <div className="space-y-4">
            {portal.providerChoices.map((prov) => (
              <article
                key={prov.id}
                className={`rounded-xl border p-4 transition ${
                  prov.isSelected
                    ? "border-teal-600 bg-teal-50/40"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{prov.name}</h3>
                      {prov.isSelected && (
                        <span className="rounded-full bg-teal-700 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                          {isEs ? "Su elección" : "Your Pick"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">
                      {prov.organizationName} • {prov.specialty}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                        {prov.geography}
                      </span>
                      <span>
                        {isEs ? "Idiomas:" : "Languages:"} {prov.languages.join(", ")}
                      </span>
                      {prov.telehealthAvailable && (
                        <span className="inline-flex items-center gap-1 text-teal-800 font-medium">
                          <Video className="h-3.5 w-3.5" aria-hidden="true" />
                          {isEs ? "Video disponible" : "Video visits offered"}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {prov.highlights.map((h) => (
                        <span
                          key={h}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>

                  {canInteract && !prov.isSelected && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        setRequestProviderId(prov.id);
                        runAction(
                          `select-${prov.id}`,
                          { action: "SELECT_PROVIDER", providerId: prov.id },
                          `${prov.name} saved as your preferred provider.`
                        );
                      }}
                      className="rounded-lg border border-teal-700 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50"
                    >
                      {isEs ? "Elegir proveedor" : "Choose This Provider"}
                    </button>
                  )}
                </div>

                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="text-xs font-medium text-slate-700">{prov.availabilityMessage}</div>

                  {prov.openAppointmentOptions.length > 0 && canInteract && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {prov.openAppointmentOptions.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={busy !== null}
                          onClick={() =>
                            runAction(
                              `book-${slot.id}`,
                              {
                                action: "REQUEST_APPOINTMENT",
                                providerId: prov.id,
                                slotId: slot.id,
                                requestedStartAt: slot.slotStartAt,
                                modality: slot.modality === "TELEHEALTH" ? "TELEHEALTH" : "IN_PERSON",
                              },
                              isEs
                                ? `Cita programada con ${prov.name}.`
                                : `Appointment scheduled with ${prov.name}!`
                            )
                          }
                          className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-900 hover:bg-teal-100 focus-visible:outline-2 focus-visible:outline-teal-700"
                        >
                          {new Date(slot.slotStartAt).toLocaleString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}{" "}
                          • {slot.modality === "TELEHEALTH" ? (isEs ? "Video" : "Video") : (isEs ? "En oficina" : "Office")}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>

          {/* Simple Custom Scheduling Request */}
          {canInteract && portal.providerChoices.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="text-xs font-bold text-slate-800">
                {isEs
                  ? "¿Prefiere otro horario? Envíe una solicitud de cita"
                  : "Want a specific day or time? Send a scheduling request"}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="req-provider" className="block text-xs text-slate-600 mb-1">
                    {isEs ? "Proveedor" : "Provider"}
                  </label>
                  <select
                    id="req-provider"
                    value={requestProviderId}
                    onChange={(e) => setRequestProviderId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
                  >
                    {portal.providerChoices.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="req-dt" className="block text-xs text-slate-600 mb-1">
                    {isEs ? "Día y hora preferida" : "Preferred day & time"}
                  </label>
                  <input
                    id="req-dt"
                    type="datetime-local"
                    value={requestDateTime}
                    onChange={(e) => setRequestDateTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="req-mod" className="block text-xs text-slate-600 mb-1">
                    {isEs ? "Tipo de visita" : "Visit type"}
                  </label>
                  <select
                    id="req-mod"
                    value={requestModality}
                    onChange={(e) => setRequestModality(e.target.value as "TELEHEALTH" | "IN_PERSON")}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
                  >
                    <option value="TELEHEALTH">{isEs ? "Por video (desde casa)" : "Video visit (from home)"}</option>
                    <option value="IN_PERSON">{isEs ? "En persona" : "In-person office visit"}</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                disabled={busy !== null || !requestProviderId}
                onClick={() =>
                  runAction(
                    "custom-request",
                    {
                      action: "REQUEST_APPOINTMENT",
                      providerId: requestProviderId,
                      requestedStartAt: new Date(requestDateTime).toISOString(),
                      modality: requestModality,
                    },
                    isEs
                      ? "Solicitud enviada. Nuestro equipo le confirmará pronto."
                      : "Scheduling request sent! Our care team will confirm with the office."
                  )
                }
                className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-600"
              >
                {isEs ? "Enviar solicitud de cita" : "Send Scheduling Request"}
              </button>
            </div>
          )}
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          {/* 4. Questions & Assistance Requests */}
          <section
            aria-labelledby="support-heading"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4"
          >
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-teal-700" aria-hidden="true" />
              <h2 id="support-heading" className="text-base font-bold text-slate-900">
                {isEs ? "Preguntas o pedir ayuda" : "Ask a Question or Ask for Help"}
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              {isEs
                ? "Sin formularios largos. Cuéntenos brevemente cómo podemos ayudarle."
                : "No long forms. Let us know what would make getting to your visit easier."}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSupportKind("ASSISTANCE")}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold border ${
                  supportKind === "ASSISTANCE"
                    ? "border-teal-700 bg-teal-50 text-teal-900"
                    : "border-slate-200 text-slate-700"
                }`}
              >
                {isEs ? "Necesito ayuda" : "I Need Assistance"}
              </button>
              <button
                type="button"
                onClick={() => setSupportKind("QUESTION")}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold border ${
                  supportKind === "QUESTION"
                    ? "border-teal-700 bg-teal-50 text-teal-900"
                    : "border-slate-200 text-slate-700"
                }`}
              >
                {isEs ? "Tengo una pregunta" : "I Have a Question"}
              </button>
            </div>

            <div>
              <label htmlFor="support-topic" className="block text-xs font-medium text-slate-700 mb-1">
                {isEs ? "¿Sobre qué tema?" : "Topic"}
              </label>
              <select
                id="support-topic"
                value={supportTopic}
                onChange={(e) => setSupportTopic(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="Scheduling help">{isEs ? "Ayuda para agendar cita" : "Help picking a time"}</option>
                <option value="Transportation">{isEs ? "Ayuda con transporte" : "Getting a ride / transportation"}</option>
                <option value="Insurance or cost">{isEs ? "Dudas sobre seguro o costo" : "Insurance or copay question"}</option>
                <option value="Language or interpreter">{isEs ? "Intérprete o idioma" : "Interpreter or language support"}</option>
                <option value="Other question">{isEs ? "Otra pregunta" : "General question"}</option>
              </select>
            </div>

            <div>
              <label htmlFor="support-msg" className="block text-xs font-medium text-slate-700 mb-1">
                {isEs ? "Su mensaje" : "How can we help?"}
              </label>
              <textarea
                id="support-msg"
                rows={3}
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                placeholder={
                  isEs
                    ? "Ej.: ¿Pueden llamarme después de las 4pm?"
                    : "Example: Can someone call me after 4pm, or help check bus options?"
                }
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs"
              />
            </div>

            {canInteract && (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={busy !== null || supportMessage.trim().length < 2}
                  onClick={async () => {
                    await runAction(
                      "submit-support",
                      {
                        action: "SUBMIT_SUPPORT",
                        kind: supportKind,
                        topic: supportTopic,
                        message: supportMessage.trim(),
                      },
                      isEs
                        ? "Mensaje enviado. Nuestro equipo le responderá pronto."
                        : "Message sent! Your care coordinator will follow up with you shortly."
                    );
                    setSupportMessage("");
                  }}
                  className="w-full rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {isEs ? "Enviar a mi equipo de apoyo" : "Send to Care Team"}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={async () => {
                    await runAction(
                      "escalate-human",
                      {
                        action: "ESCALATE_TO_HUMAN",
                        topic: supportTopic,
                        message:
                          supportMessage.trim() ||
                          (isEs
                            ? "Me gustaría hablar con un coordinador de atención."
                            : "I would like to speak with a care coordinator."),
                      },
                      isEs
                        ? "Conectado. Un coordinador de atención humano se comunicará con usted."
                        : "Connected. A human care coordinator will reach out to you personally."
                    );
                    setSupportMessage("");
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {isEs
                    ? "Hablar con un coordinador de atención"
                    : "Talk to a Human Care Coordinator"}
                </button>
              </div>
            )}
          </section>

          {/* 5. Communication Preferences */}
          <section
            aria-labelledby="prefs-heading"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4"
          >
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-teal-700" aria-hidden="true" />
              <h2 id="prefs-heading" className="text-base font-bold text-slate-900">
                {isEs ? "Cómo prefiere que nos comuniquemos" : "Communication Preferences"}
              </h2>
            </div>

            <div>
              <label htmlFor="pref-channel" className="block text-xs font-medium text-slate-700 mb-1">
                {isEs ? "Canal preferido para avisos y recordatorios" : "Preferred way to reach you"}
              </label>
              <select
                id="pref-channel"
                value={preferredChannel}
                onChange={(e) =>
                  setPreferredChannel(e.target.value as "SMS" | "PHONE" | "EMAIL" | "PORTAL")
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                {portal.supportedChannels.map((ch) => (
                  <option key={ch.channel} value={ch.channel}>
                    {ch.displayName} ({ch.channel})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentSms}
                  onChange={(e) => setConsentSms(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span>
                  {isEs
                    ? "Acepto recibir mensajes de texto (SMS) con recordatorios de citas."
                    : "Yes, send me helpful appointment reminders by text message (SMS)."}
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentOutreach}
                  onChange={(e) => setConsentOutreach(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span>
                  {isEs
                    ? "El equipo de apoyo puede contactarme para ayudarme a agendar mi visita."
                    : "Allow my care coordinator to check in with me about scheduling."}
                </span>
              </label>
            </div>

            {canInteract && (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    runAction(
                      "save-prefs",
                      {
                        action: "UPDATE_PREFERENCES",
                        preferredLanguage,
                        preferredContactChannel: preferredChannel,
                        consentSms,
                        consentOutreach,
                      },
                      isEs
                        ? "Preferencias guardadas."
                        : "Your communication preferences are saved."
                    )
                  }
                  className="w-full rounded-lg border border-teal-700 px-4 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50"
                >
                  {isEs ? "Guardar preferencias" : "Save Preferences"}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={async () => {
                    setConsentSms(false);
                    setConsentOutreach(false);
                    setPreferredChannel("PORTAL");
                    await runAction(
                      "opt-out",
                      {
                        action: "OPT_OUT",
                      },
                      isEs
                        ? "Hemos pausado los mensajes y recordatorios automáticos."
                        : "You have opted out of automated outreach and reminders."
                    );
                  }}
                  className="w-full rounded-lg border border-rose-200 px-4 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  {isEs ? "Pausar todos los mensajes (Opt-out)" : "Opt out of automated outreach"}
                </button>
              </div>
            )}
          </section>
        </div>

        {/* 6. Updates & Messages */}
        <section
          aria-labelledby="messages-heading"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3"
        >
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-teal-700" aria-hidden="true" />
            <h2 id="messages-heading" className="text-base font-bold text-slate-900">
              {isEs ? "Mensajes y confirmaciones" : "Messages & Confirmations"}
            </h2>
          </div>

          {portal.messages.length > 0 ? (
            <div className="space-y-2">
              {portal.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-xl border px-4 py-3 text-xs ${
                    msg.direction === "INBOUND"
                      ? "border-teal-200 bg-teal-50/50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-800">
                      {msg.direction === "INBOUND"
                        ? isEs
                          ? "Usted"
                          : "You"
                        : portal.careCoordinatorName}{" "}
                      • {msg.channel}
                    </span>
                    <span>{new Date(msg.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-slate-800">{msg.summary}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              {isEs
                ? "Aquí aparecerán sus recordatorios y confirmaciones."
                : "Your scheduling confirmations and reminders will show up here."}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
