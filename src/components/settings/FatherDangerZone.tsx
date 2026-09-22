"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertOctagon, Loader2 } from "lucide-react";

export default function FatherDangerZone() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [typed, setTyped] = useState("");

  async function doReset() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "RESET-ALL" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reset failed.");
      const d = data.deleted ?? {};
      setSuccess(
        `Everything cleared. Removed ${d.recordings ?? 0} recordings, ${
          d.mistakes ?? 0
        } mistakes, ${d.attendance ?? 0} attendance, ${
          d.notifications ?? 0
        } notifications.`
      );
      setShowConfirm(false);
      setTyped("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  }

  const confirmOk = typed.trim().toUpperCase() === "RESET-ALL";

  return (
    <section className="rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-900">
          <AlertOctagon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-red-900">
            Danger zone — Reset entire system
          </h2>
          <p className="mt-1 text-sm text-red-800">
            This deletes <strong>every</strong> recording, mistake, attendance
            mark, notification, and audit log across all users. The student
            and qari accounts will remain.
          </p>
          <p className="mt-1 text-xs font-medium text-red-900">
            Use this only if you want to start completely fresh. Cannot be
            undone.
          </p>

          {!showConfirm ? (
            <button
              type="button"
              onClick={() => {
                setShowConfirm(true);
                setError(null);
                setSuccess(null);
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-900 hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Reset entire system
            </button>
          ) : (
            <div className="mt-3 rounded-lg border border-red-300 bg-white p-3">
              <label className="block text-xs font-medium text-red-900">
                Type{" "}
                <span className="font-mono font-bold">RESET-ALL</span> to
                confirm
              </label>
              <input
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoFocus
                className="mt-1 w-full rounded-md border border-red-300 px-3 py-2 text-sm font-mono"
                placeholder="RESET-ALL"
              />
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirm(false);
                    setTyped("");
                  }}
                  disabled={busy}
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-800 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={doReset}
                  disabled={!confirmOk || busy}
                  className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {busy ? "Resetting…" : "Yes, reset everything"}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-md border border-red-300 bg-red-100 px-3 py-2 text-xs text-red-900">
              {error}
            </p>
          )}
          {success && (
            <p className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              {success}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}