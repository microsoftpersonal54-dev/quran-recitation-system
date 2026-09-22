"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { formatMs } from "@/lib/format";

export interface RecordingListItemData {
  id: string;
  surahNumber: number;
  surahName: string;
  ayahFrom: number;
  ayahTo: number;
  paraFrom: number | null;
  paraTo: number | null;
  paraQuarter: number | null;
  durationMs: number;
  recordedAt: string;
  uploadStatus: string;
  reviewStatus: string;
}

export default function RecordingListItem({
  item,
}: {
  item: RecordingListItemData;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const date = new Date(item.recordedAt);
  const dateLabel = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timeLabel = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const reviewed = item.reviewStatus === "REVIEWED";
  const paraLabel =
    item.paraFrom && item.paraTo
      ? item.paraFrom === item.paraTo
        ? `Para ${item.paraFrom}${
            item.paraQuarter ? ` (${item.paraQuarter}/4)` : ""
          }`
        : `Paras ${item.paraFrom}–${item.paraTo}`
      : null;

  async function handleDelete() {
    if (!confirm("Delete this recording? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/recordings/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Delete failed.");
      }
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-900">
            {item.surahName}{" "}
            <span className="text-neutral-500">
              — Ayahs {item.ayahFrom}–{item.ayahTo}
            </span>
          </p>
          {paraLabel && (
            <p className="mt-0.5 text-xs text-neutral-600">{paraLabel}</p>
          )}
          <p className="mt-1 text-xs text-neutral-500">
            {dateLabel} · {timeLabel} · {formatMs(item.durationMs)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
              reviewed
                ? "bg-emerald-100 text-emerald-900"
                : "bg-neutral-100 text-neutral-700"
            }`}
          >
            {reviewed ? "Reviewed" : "Unreviewed"}
          </span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Delete recording"
            className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <audio
        src={`/api/recordings/${item.id}/audio`}
        controls
        preload="none"
        className="mt-3 w-full"
      />
    </li>
  );
}