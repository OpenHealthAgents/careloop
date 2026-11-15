"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "warning" | "danger";
  requireNote?: boolean;
  noteLabel?: string;
  notePlaceholder?: string;
  initialNote?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}

function ConfirmDialogBody(props: Omit<ConfirmDialogProps, "open">) {
  const {
    title,
    description,
    confirmLabel,
    cancelLabel = "Cancel",
    tone = "danger",
    requireNote = false,
    noteLabel = "Reason / Clinical Coordination Note",
    notePlaceholder = "Provide required rationale for audit log...",
    initialNote = "",
    busy = false,
    onCancel,
    onConfirm,
  } = props;

  const [note, setNote] = useState(initialNote);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const descId = useId();
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (requireNote && noteInputRef.current) {
        noteInputRef.current.focus();
      } else {
        confirmBtnRef.current?.focus();
      }
    }, 10);
    return () => clearTimeout(timer);
  }, [requireNote]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) {
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [busy, onCancel]);

  const confirmStyles =
    tone === "danger"
      ? "bg-rose-700 hover:bg-rose-600 text-white"
      : tone === "warning"
        ? "bg-amber-600 hover:bg-amber-500 text-white"
        : "bg-teal-700 hover:bg-teal-600 text-white";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = note.trim();
    if (requireNote && trimmed.length < 3) {
      setError("Please enter at least 3 characters to record an audit rationale.");
      return;
    }
    setError(null);
    onConfirm(trimmed);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                tone === "danger"
                  ? "bg-rose-50 text-rose-700"
                  : tone === "warning"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-teal-50 text-teal-700"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 id={titleId} className="text-sm font-semibold text-slate-900">
                {title}
              </h3>
              <p id={descId} className="mt-1 text-xs leading-relaxed text-slate-600">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {requireNote && (
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                {noteLabel} <span className="text-rose-600">*</span>
              </label>
              <textarea
                ref={noteInputRef}
                rows={3}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={notePlaceholder}
                aria-invalid={Boolean(error)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
              />
              {error && (
                <p role="alert" className="mt-1 text-xs font-medium text-rose-700">
                  {error}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              ref={!requireNote ? confirmBtnRef : undefined}
              type="submit"
              disabled={busy}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold disabled:opacity-50 ${confirmStyles}`}
            >
              {busy ? "Processing..." : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, ...rest }: ConfirmDialogProps) {
  if (!open) return null;
  return <ConfirmDialogBody key={`${rest.title}:${rest.initialNote ?? ""}`} {...rest} />;
}
