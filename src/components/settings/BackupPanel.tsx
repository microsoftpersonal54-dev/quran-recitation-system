"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";

interface BackupListing {
  name: string;
  sizeBytes: number;
  createdAt: string;
  kind: "sqlite" | "json";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function BackupPanel() {
  const [items, setItems] = useState<BackupListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/backup");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load.");
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/backup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Backup failed.");
      const fileName = data.backup?.jsonFile ?? "quran-backup.json";
      if (data.export) {
        const blob = new Blob([JSON.stringify(data.export, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
      setSuccess(
        `Backup downloaded: ${fileName} (${formatBytes(
          data.backup?.jsonBytes ?? 0
        )})`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup failed.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Create a backup
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Downloads a portable JSON export of your data. Never touches the live
          database.
        </p>
        <button
          onClick={create}
          disabled={creating}
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Download className="h-4 w-4" aria-hidden />
          )}
          {creating ? "Creating backup…" : "Create backup now"}
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

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Existing backups
          </h2>
          <button
            onClick={load}
            className="text-xs text-neutral-500 hover:text-neutral-900"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="mt-3 text-sm text-neutral-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No backups yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100">
            {items.map((it) => (
              <li
                key={it.name}
                className="flex items-center justify-between py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-neutral-800">
                    {it.name}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {new Date(it.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs text-neutral-600">
                  {formatBytes(it.sizeBytes)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-neutral-500">
        Backups are downloaded to this device as JSON. Keep them somewhere safe.
      </p>
    </div>
  );
}