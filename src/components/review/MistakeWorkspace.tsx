"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { formatMs } from "@/lib/format";
import {
  MISTAKE_CATEGORIES,
  MISTAKE_SEVERITIES,
} from "@/lib/validation/mistakes";

export interface WorkspaceMistake {
  id: string;
  timestampMs: number;
  ayahNumber: number | null;
  category: string;
  severity: string;
  description: string;
  correction: string | null;
  reviewer: { id: string; name: string };
}

export interface MistakeWorkspaceProps {
  recordingId: string;
  durationMs: number;
  audioUrl: string;
  initialMistakes: WorkspaceMistake[];
  ayahFrom: number;
  ayahTo: number;
  reviewStatus: string;
  canEdit: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  TAJWEED: "Tajweed",
  PRONUNCIATION: "Pronunciation",
  MADD: "Madd",
  MAKHARIJ: "Makharij",
  GHUNNAH: "Ghunnah",
  WAQF: "Waqf",
  GENERAL: "General",
  OTHER: "Other",
};

const SEVERITY_LABELS: Record<string, string> = {
  MINOR: "Minor",
  MEDIUM: "Medium",
  MAJOR: "Major",
};

export default function MistakeWorkspace({
  recordingId,
  durationMs,
  audioUrl,
  initialMistakes,
  ayahFrom,
  ayahTo,
  reviewStatus,
  canEdit,
}: MistakeWorkspaceProps) {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mistakes, setMistakes] = useState<WorkspaceMistake[]>(initialMistakes);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(reviewStatus);

  useEffect(() => {
    setMistakes(initialMistakes);
  }, [initialMistakes]);

  function seekTo(ms: number) {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, ms / 1000);
    el.play().catch(() => {});
  }

  function openAdd() {
    setEditingId(null);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(m: WorkspaceMistake) {
    setEditingId(m.id);
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  }

  async function submitForm(input: {
    timestampMs: number;
    ayahNumber: number | null;
    category: string;
    severity: string;
    description: string;
    correction: string;
  }) {
    setBusy(true);
    setFormError(null);

    try {
      if (editingId) {
        const res = await fetch(`/api/mistakes/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not save.");
        setMistakes((prev) =>
          prev.map((m) => (m.id === editingId ? data.mistake : m))
        );
      } else {
        const res = await fetch(`/api/recordings/${recordingId}/mistakes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not save.");
        setMistakes((prev) =>
          [...prev, data.mistake].sort(
            (a, b) => a.timestampMs - b.timestampMs
          )
        );
        if (status === "UNREVIEWED") setStatus("IN_REVIEW");
      }
      closeForm();
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteMistake(id: string) {
    if (!confirm("Delete this mistake?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/mistakes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed.");
      setMistakes((prev) => prev.filter((m) => m.id !== id));
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  async function setReviewStatus(next: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/recordings/${recordingId}/review-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus: next }),
      });
      if (!res.ok) throw new Error("Could not update status.");
      setStatus(next);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Audio
        </h2>
        <audio
          ref={audioRef}
          src={audioUrl}
          controls
          preload="metadata"
          className="mt-2 w-full"
        />

        <Timeline
          mistakes={mistakes}
          durationMs={durationMs}
          onSeek={seekTo}
        />
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Mistakes ({mistakes.length})
          </h2>
          {canEdit && !showForm && (
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add mistake
            </button>
          )}
        </div>

        {showForm && (
          <MistakeForm
            key={editingId ?? "new"}
            initial={
              editingId
                ? mistakes.find((m) => m.id === editingId) ?? null
                : null
            }
            ayahFrom={ayahFrom}
            ayahTo={ayahTo}
            durationMs={durationMs}
            currentTimeMs={
              audioRef.current
                ? Math.round(audioRef.current.currentTime * 1000)
                : 0
            }
            onCancel={closeForm}
            onSubmit={submitForm}
            submitting={busy}
            error={formError}
          />
        )}

        {mistakes.length === 0 && !showForm && (
          <p className="mt-3 text-sm text-neutral-500">
            No mistakes have been recorded yet.
            {canEdit && (
              <span className="text-neutral-400">
                {" "}
                Tap “Add mistake” when you spot one.
              </span>
            )}
          </p>
        )}

        {mistakes.length > 0 && (
          <ul className="mt-3 space-y-3">
            {mistakes.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border border-neutral-100 bg-neutral-50 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => seekTo(m.timestampMs)}
                    className="font-mono text-sm text-blue-700 hover:underline"
                    title="Jump to this point"
                  >
                    {formatMs(m.timestampMs)}
                  </button>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-700">
                    {SEVERITY_LABELS[m.severity] ?? m.severity}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-neutral-900">
                  {CATEGORY_LABELS[m.category] ?? m.category}
                  {m.ayahNumber != null && (
                    <span className="font-normal text-neutral-500">
                      {" "}
                      · Ayah {m.ayahNumber}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-neutral-700">
                  {m.description}
                </p>
                {m.correction && (
                  <p className="mt-1 text-xs text-neutral-600">
                    <span className="font-medium">Correction:</span>{" "}
                    {m.correction}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[11px] text-neutral-500">
                    — {m.reviewer.name}
                  </p>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(m)}
                        aria-label="Edit mistake"
                        className="rounded p-1 text-neutral-500 hover:bg-white hover:text-neutral-900"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        onClick={() => deleteMistake(m.id)}
                        aria-label="Delete mistake"
                        className="rounded p-1 text-neutral-500 hover:bg-white hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canEdit && (
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Review status
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["UNREVIEWED", "Unreviewed"],
                ["IN_REVIEW", "In review"],
                ["REVIEWED", "Reviewed"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setReviewStatus(value)}
                disabled={busy || status === value}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                  status === value
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50"
                } disabled:opacity-60`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------- Timeline ----------

function Timeline({
  mistakes,
  durationMs,
  onSeek,
}: {
  mistakes: WorkspaceMistake[];
  durationMs: number;
  onSeek: (ms: number) => void;
}) {
  if (durationMs <= 0) return null;
  return (
    <div className="mt-3">
      <div
        className="relative h-8 rounded-md bg-neutral-100"
        role="presentation"
      >
        {mistakes.map((m) => {
          const pct = Math.min(100, (m.timestampMs / durationMs) * 100);
          return (
            <button
              key={m.id}
              onClick={() => onSeek(m.timestampMs)}
              title={`${formatMs(m.timestampMs)} — ${CATEGORY_LABELS[m.category] ?? m.category}`}
              className="absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-amber-600 hover:bg-amber-700"
              style={{ left: `${pct}%` }}
              aria-label={`Mistake at ${formatMs(m.timestampMs)}`}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
        <span>0:00</span>
        <span>{formatMs(durationMs)}</span>
      </div>
    </div>
  );
}

// ---------- Form ----------

function MistakeForm({
  initial,
  ayahFrom,
  ayahTo,
  durationMs,
  currentTimeMs,
  onCancel,
  onSubmit,
  submitting,
  error,
}: {
  initial: WorkspaceMistake | null;
  ayahFrom: number;
  ayahTo: number;
  durationMs: number;
  currentTimeMs: number;
  onCancel: () => void;
  onSubmit: (input: {
    timestampMs: number;
    ayahNumber: number | null;
    category: string;
    severity: string;
    description: string;
    correction: string;
  }) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [timestampSec, setTimestampSec] = useState(
    initial
      ? Math.round(initial.timestampMs / 1000)
      : Math.round(currentTimeMs / 1000)
  );
  const [ayahNumber, setAyahNumber] = useState<string>(
    initial?.ayahNumber != null ? String(initial.ayahNumber) : ""
  );
  const [category, setCategory] = useState(initial?.category ?? "TAJWEED");
  const [severity, setSeverity] = useState(initial?.severity ?? "MINOR");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [correction, setCorrection] = useState(initial?.correction ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ayah = ayahNumber.trim() === "" ? null : Number(ayahNumber);
    onSubmit({
      timestampMs: Math.max(0, Math.min(durationMs, timestampSec * 1000)),
      ayahNumber: ayah,
      category,
      severity,
      description: description.trim(),
      correction: correction.trim(),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="timestampSec"
            className="block text-xs font-medium text-neutral-700"
          >
            Timestamp (seconds)
          </label>
          <input
            id="timestampSec"
            type="number"
            inputMode="numeric"
            min={0}
            max={Math.round(durationMs / 1000)}
            value={timestampSec}
            onChange={(e) => setTimestampSec(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm"
          />
          <p className="mt-0.5 font-mono text-[10px] text-neutral-500">
            = {formatMs(timestampSec * 1000)}
          </p>
        </div>
        <div>
          <label
            htmlFor="ayahNumber"
            className="block text-xs font-medium text-neutral-700"
          >
            Ayah (optional)
          </label>
          <input
            id="ayahNumber"
            type="number"
            inputMode="numeric"
            min={ayahFrom}
            max={ayahTo}
            value={ayahNumber}
            onChange={(e) => setAyahNumber(e.target.value)}
            placeholder={`${ayahFrom}–${ayahTo}`}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="category"
            className="block text-xs font-medium text-neutral-700"
          >
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm"
          >
            {MISTAKE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="severity"
            className="block text-xs font-medium text-neutral-700"
          >
            Severity
          </label>
          <select
            id="severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm"
          >
            {MISTAKE_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-xs font-medium text-neutral-700"
        >
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={1000}
          required
          placeholder="What went wrong?"
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm"
        />
      </div>

      <div>
        <label
          htmlFor="correction"
          className="block text-xs font-medium text-neutral-700"
        >
          Correction (optional)
        </label>
        <textarea
          id="correction"
          value={correction}
          onChange={(e) => setCorrection(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="How should it be recited?"
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm"
        />
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || description.trim().length === 0}
          className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
          {submitting ? "Saving…" : initial ? "Save changes" : "Add mistake"}
        </button>
      </div>
    </form>
  );
}