"use client";

import { formatMs } from "@/lib/format";

export interface RecordingListItemData {
  id: string;
  surahNumber: number;
  surahName: string;
  ayahFrom: number;
  ayahTo: number;
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
          <p className="mt-1 text-xs text-neutral-500">
            {dateLabel} · {timeLabel} · {formatMs(item.durationMs)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
            reviewed
              ? "bg-emerald-100 text-emerald-900"
              : "bg-neutral-100 text-neutral-700"
          }`}
        >
          {reviewed ? "Reviewed" : "Unreviewed"}
        </span>
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