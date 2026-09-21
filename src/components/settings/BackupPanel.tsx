"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export default function BackupPanel() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function download() {
    setDownloading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/backup");
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quran-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSuccess("Backup downloaded successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup failed.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Download a backup
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Downloads a complete JSON export of every user, recording, mistake,
          notification, and audit entry. Save it somewhere safe.
        </p>
        <button
          onClick={download}
          disabled={downloading}
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Download className="h-4 w-4" aria-hidden />
          )}
          {downloading ? "Preparing…" : "Download backup JSON"}
        </button>

        {success && (
          <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {success}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
      </section>

      <p className="text-xs text-neutral-500">
        On cloud hosting, backups are downloaded to your device rather than
        stored on the server. This keeps your data available even if the
        hosting service is unavailable.
      </p>
    </div>
  );
}