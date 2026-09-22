"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  Award,
  BookOpen,
  AlertTriangle,
} from "lucide-react";
import { formatMs } from "@/lib/format";

export interface FatherEntry {
  id: string;
  studentName: string;
  qariName: string | null;
  surahName: string;
  surahNumber: number;
  ayahFrom: number;
  ayahTo: number;
  paraFrom: number | null;
  paraTo: number | null;
  paraQuarter: number | null;
  durationMs: number;
  recordedAt: string;
  notes: string | null;
  reviewStatus: string;
  mistakeCount: number;
}

interface Props {
  entries: FatherEntry[];
  recordingBasePath: string;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const dd = new Date(d);
  dd.setHours(0, 0, 0, 0);

  if (dd.getTime() === today.getTime()) return "Today";
  if (dd.getTime() === yest.getTime()) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function RecordingsByDay({
  entries,
  recordingBasePath,
}: Props) {
  const groups = new Map<string, { date: Date; items: FatherEntry[] }>();
  for (const e of entries) {
    const d = new Date(e.recordedAt);
    const k = dayKey(d);
    if (!groups.has(k)) groups.set(k, { date: d, items: [] });
    groups.get(k)!.items.push(e);
  }
  const sortedKeys = Array.from(groups.keys()).sort().reverse();

  const [openKeys, setOpenKeys] = useState<Set<string>>(
    () => new Set(sortedKeys.slice(0, 1))
  );

  function toggle(k: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-10 text-center">
        <p className="text-sm font-medium text-neutral-700">
          No recordings yet.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Recordings from the student will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedKeys.map((k) => {
        const g = groups.get(k)!;
        const isOpen = openKeys.has(k);
        const totalMs = g.items.reduce((s, i) => s + i.durationMs, 0);

        return (
          <div
            key={k}
            className="overflow-hidden rounded-xl border border-neutral-200 bg-white"
          >
            <button
              onClick={() => toggle(k)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-neutral-50"
            >
              <div className="flex min-w-0 items-center gap-2">
                {isOpen ? (
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-neutral-500"
                    aria-hidden
                  />
                ) : (
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-neutral-500"
                    aria-hidden
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {dayLabel(g.date)}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {g.items.length} recording
                    {g.items.length === 1 ? "" : "s"} · {formatMs(totalMs)}
                  </p>
                </div>
              </div>
            </button>

            {isOpen && (
              <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
                {g.items.map((item) => {
                  const paraLabel = item.paraFrom
                    ? item.paraFrom === item.paraTo
                      ? `Para ${item.paraFrom}${
                          item.paraQuarter ? ` (${item.paraQuarter}/4)` : ""
                        }`
                      : `Paras ${item.paraFrom}–${item.paraTo}`
                    : null;

                  return (
                    <li key={item.id}>
                      <Link
                        href={`${recordingBasePath}/${item.id}`}
                        className="block px-4 py-3 hover:bg-neutral-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-neutral-900">
                              {item.surahName} · Ayahs {item.ayahFrom}–
                              {item.ayahTo}
                            </p>

                            {paraLabel && (
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-600">
                                <BookOpen
                                  className="h-3 w-3 shrink-0"
                                  aria-hidden
                                />
                                {paraLabel}
                              </p>
                            )}

                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-neutral-500">
                              <span className="inline-flex items-center gap-1">
                                <User className="h-3 w-3" aria-hidden />
                                {item.studentName}
                              </span>
                              {item.qariName && (
                                <span className="inline-flex items-center gap-1">
                                  <Award className="h-3 w-3" aria-hidden />
                                  {item.qariName}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" aria-hidden />
                                {new Date(item.recordedAt).toLocaleTimeString(
                                  undefined,
                                  { hour: "2-digit", minute: "2-digit" }
                                )}{" "}
                                · {formatMs(item.durationMs)}
                              </span>
                            </div>

                            {item.notes && (
                              <p className="mt-1 line-clamp-2 text-xs text-neutral-600">
                                {item.notes}
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                                item.reviewStatus === "REVIEWED"
                                  ? "bg-emerald-100 text-emerald-900"
                                  : item.reviewStatus === "IN_REVIEW"
                                  ? "bg-amber-100 text-amber-900"
                                  : "bg-neutral-100 text-neutral-700"
                              }`}
                            >
                              {item.reviewStatus.replace("_", " ")}
                            </span>
                            {item.mistakeCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700">
                                <AlertTriangle
                                  className="h-3 w-3"
                                  aria-hidden
                                />
                                {item.mistakeCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}