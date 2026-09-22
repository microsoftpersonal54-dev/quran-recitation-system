"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type DayStatus = "PRESENT" | "LEAVE" | "ABSENT" | null;

export interface CalendarDay {
  /** ISO date string YYYY-MM-DD */
  date: string;
  status: DayStatus;
  /** Optional context shown on hover/tap, e.g. reason text */
  label?: string;
}

interface Props {
  /** Map of ISO date → status for the current month */
  days: Record<string, CalendarDay>;
  /** Called when a day is tapped */
  onSelectDate: (isoDate: string) => void;
  /** Optional initial month (defaults to today's month) */
  initialMonth?: Date;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isoOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function statusColor(status: DayStatus): string {
  switch (status) {
    case "PRESENT":
      return "bg-emerald-500";
    case "LEAVE":
      return "bg-amber-500";
    case "ABSENT":
      return "bg-red-500";
    default:
      return "";
  }
}

export default function Calendar({ days, onSelectDate, initialMonth }: Props) {
  const [cursor, setCursor] = useState<Date>(() => {
    const base = initialMonth ? new Date(initialMonth) : new Date();
    base.setDate(1);
    base.setHours(0, 0, 0, 0);
    return base;
  });

  const todayIso = useMemo(() => isoOf(new Date()), []);

  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: { date: Date | null; iso: string | null }[] = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ date: null, iso: null });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      cells.push({ date: d, iso: isoOf(d) });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ date: null, iso: null });
    }
    return cells;
  }, [cursor]);

  function prevMonth() {
    setCursor((c) => {
      const n = new Date(c);
      n.setMonth(n.getMonth() - 1);
      return n;
    });
  }

  function nextMonth() {
    setCursor((c) => {
      const n = new Date(c);
      n.setMonth(n.getMonth() + 1);
      return n;
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          aria-label="Previous month"
          className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <div className="text-sm font-medium text-neutral-900">{monthLabel}</div>
        <button
          onClick={nextMonth}
          aria-label="Next month"
          className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="text-center text-[10px] font-medium uppercase tracking-wide text-neutral-500"
          >
            {wd}
          </div>
        ))}
        {grid.map((cell, i) => {
          if (!cell.date) {
            return <div key={i} className="aspect-square" />;
          }
          const iso = cell.iso!;
          const dayNum = cell.date.getDate();
          const entry = days[iso];
          const isToday = iso === todayIso;

          return (
            <button
              key={i}
              onClick={() => onSelectDate(iso)}
              className={`relative flex aspect-square items-center justify-center rounded-md text-xs ${
                isToday
                  ? "border border-neutral-900 font-semibold text-neutral-900"
                  : "text-neutral-700 hover:bg-neutral-100"
              }`}
              aria-label={`${dayNum}${
                entry?.status ? ` — ${entry.status}` : ""
              }`}
              title={entry?.label ?? undefined}
            >
              <span>{dayNum}</span>
              {entry?.status && (
                <span
                  className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${statusColor(
                    entry.status
                  )}`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-3 text-[11px] text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Present
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Leave
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" /> Absent
        </span>
      </div>
    </div>
  );
}