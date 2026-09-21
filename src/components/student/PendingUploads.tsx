"use client";

import { Loader2, RefreshCw, AlertTriangle, CloudUpload } from "lucide-react";
import { formatMs } from "@/lib/format";
import { usePendingUploads } from "@/hooks/usePendingUploads";
import { getSurah } from "@/lib/quran/surahs";

export default function PendingUploads() {
  const { items, online, flushing, flush, retryOne } = usePendingUploads();

  if (items.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-800">
          Pending uploads
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900">
            {items.length}
          </span>
        </h2>
        {online && (
          <button
            onClick={flush}
            disabled={flushing}
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 disabled:opacity-60"
          >
            {flushing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            )}
            {flushing ? "Uploading…" : "Retry all"}
          </button>
        )}
      </div>

      {!online && (
        <p className="mt-2 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          You're offline. Recordings will upload automatically when the
          connection returns.
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {items.map((item) => {
          const surah = getSurah(item.surahNumber);
          const created = new Date(item.createdAt);
          return (
            <li
              key={item.id}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {surah?.name ?? `Surah ${item.surahNumber}`}{" "}
                    <span className="font-normal text-neutral-500">
                      — Ayahs {item.ayahFrom}–{item.ayahTo}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {created.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · {created.toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {formatMs(item.durationMs)}
                  </p>
                  {item.lastError && (
                    <p className="mt-1 text-[11px] text-amber-700">
                      {item.lastError}
                      {item.attempts > 1 && ` · ${item.attempts} attempts`}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => retryOne(item.id)}
                  disabled={!online}
                  className="shrink-0 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                >
                  <CloudUpload className="mr-1 inline h-3 w-3" aria-hidden />
                  Upload
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}