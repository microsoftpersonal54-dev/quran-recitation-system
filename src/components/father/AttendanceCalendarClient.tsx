"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { X, Mic, Award, Clock } from "lucide-react";
import Calendar, { CalendarDay } from "@/components/calendar/Calendar";
import { formatMs } from "@/lib/format";

interface StudentOption {
  id: string;
  name: string;
}

interface Props {
  students: StudentOption[];
  /** Where the "open recording" links should point, e.g. "/father/recordings" */
  recordingBasePath: string;
  /** Where the "open recording" links should point for the qari, e.g. "/qari/recordings" */
  startStudentId?: string;
}

interface DayRecording {
  id: string;
  surahName: string;
  surahNumber: number;
  ayahFrom: number;
  ayahTo: number;
  paraFrom: number | null;
  paraTo: number | null;
  durationMs: number;
  recordedAt: string;
  reviewStatus: string;
  mistakes: number;
  qari: { id: string; name: string } | null;
}

interface DayData {
  attendance: {
    status: string;
    reason: string | null;
    markedBy: { id: string; name: string; role: string } | null;
  } | null;
  recordings: DayRecording[];
}

function isoOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthRange(cursor: Date): { from: string; to: string } {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  return { from: isoOf(first), to: isoOf(last) };
}

export default function AttendanceCalendarClient({
  students,
  recordingBasePath,
  startStudentId,
}: Props) {
  const [studentId, setStudentId] = useState(
    startStudentId ?? students[0]?.id ?? ""
  );
  const [days, setDays] = useState<Record<string, CalendarDay>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [dayLoading, setDayLoading] = useState(false);

  const loadMonth = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    const { from, to } = monthRange(new Date());
    try {
      const res = await fetch(
        `/api/attendance?from=${from}&to=${to}&studentId=${studentId}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const map: Record<string, CalendarDay> = {};
      for (const item of data.items as Array<{
        date: string;
        status: string;
        reason: string | null;
      }>) {
        const iso = item.date.slice(0, 10);
        map[iso] = {
          date: iso,
          status: item.status as CalendarDay["status"],
          label: item.reason ?? undefined,
        };
      }
      setDays(map);
    } catch (err) {
      console.error("[attendance] load", err);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  async function openDay(iso: string) {
    setSelectedDate(iso);
    setDayData(null);
    setDayLoading(true);
    try {
      const res = await fetch(
        `/api/day?date=${iso}&studentId=${studentId}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setDayData({ attendance: data.attendance, recordings: data.recordings });
    } catch (err) {
      console.error("[day] load", err);
    } finally {
      setDayLoading(false);
    }
  }

  function closeDay() {
    setSelectedDate(null);
    setDayData(null);
  }

  const studentName =
    students.find((s) => s.id === studentId)?.name ?? "Student";

  return (
    <div className="space-y-4">
      {students.length > 1 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <label
            htmlFor="studentPicker"
            className="block text-[11px] font-medium uppercase tracking-wide text-neutral-500"
          >
            Student
          </label>
          <select
            id="studentPicker"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
          Loading calendar…
        </div>
      ) : (
        <Calendar days={days} onSelectDate={openDay} />
      )}

      {selectedDate && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-white p-5 shadow-lg sm:rounded-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-neutral-500">
                  {studentName}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-neutral-900">
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString(
                    undefined,
                    {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    }
                  )}
                </h3>
              </div>
              <button
                onClick={closeDay}
                aria-label="Close"
                className="rounded-full p-1 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {dayLoading ? (
              <p className="mt-6 text-center text-sm text-neutral-500">
                Loading…
              </p>
            ) : (
              <>
                {/* Attendance status */}
                <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Attendance
                  </p>
                  {dayData?.attendance ? (
                    <>
                      <p className="mt-1 text-sm font-semibold text-neutral-900">
                        {dayData.attendance.status}
                      </p>
                      {dayData.attendance.reason && (
                        <p className="mt-0.5 text-xs text-neutral-600">
                          Reason: {dayData.attendance.reason}
                        </p>
                      )}
                      {dayData.attendance.markedBy && (
                        <p className="mt-0.5 text-[11px] text-neutral-500">
                          Marked by {dayData.attendance.markedBy.name}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-neutral-500">
                      No attendance marked.
                    </p>
                  )}
                </div>

                {/* Recordings */}
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Sessions ({dayData?.recordings.length ?? 0})
                  </p>

                  {dayData && dayData.recordings.length === 0 ? (
                    <p className="mt-2 rounded-lg border border-dashed border-neutral-300 bg-white px-3 py-4 text-center text-sm text-neutral-500">
                      No recitations on this day.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {dayData?.recordings.map((r) => {
                        const paraLabel =
                          r.paraFrom && r.paraTo
                            ? r.paraFrom === r.paraTo
                              ? `Para ${r.paraFrom}`
                              : `Paras ${r.paraFrom}–${r.paraTo}`
                            : null;
                        const time = new Date(r.recordedAt).toLocaleTimeString(
                          undefined,
                          { hour: "2-digit", minute: "2-digit" }
                        );
                        return (
                          <li key={r.id}>
                            <Link
                              href={`${recordingBasePath}/${r.id}`}
                              className="block rounded-lg border border-neutral-200 bg-white p-3 hover:border-neutral-400"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-neutral-900">
                                    {r.surahName}{" "}
                                    <span className="text-neutral-500">
                                      · Ayahs {r.ayahFrom}–{r.ayahTo}
                                    </span>
                                  </p>
                                  {paraLabel && (
                                    <p className="mt-0.5 text-xs text-neutral-600">
                                      {paraLabel}
                                    </p>
                                  )}
                                  <p className="mt-1 flex items-center gap-2 text-[11px] text-neutral-500">
                                    <Clock className="h-3 w-3" aria-hidden />
                                    {time} · {formatMs(r.durationMs)}
                                  </p>
                                  {r.qari && (
                                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-500">
                                      <Award className="h-3 w-3" aria-hidden />
                                      {r.qari.name}
                                    </p>
                                  )}
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                                      r.reviewStatus === "REVIEWED"
                                        ? "bg-emerald-100 text-emerald-900"
                                        : r.reviewStatus === "IN_REVIEW"
                                        ? "bg-amber-100 text-amber-900"
                                        : "bg-neutral-100 text-neutral-700"
                                    }`}
                                  >
                                    {r.reviewStatus.replace("_", " ")}
                                  </span>
                                  {r.mistakes > 0 && (
                                    <span className="text-[10px] font-medium text-amber-700">
                                      {r.mistakes} mistake
                                      {r.mistakes === 1 ? "" : "s"}
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}