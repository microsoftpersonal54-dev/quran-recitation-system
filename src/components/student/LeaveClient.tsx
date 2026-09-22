"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, X } from "lucide-react";
import Calendar, { CalendarDay } from "@/components/calendar/Calendar";

interface Props {
  studentId: string;
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  return { from: iso(first), to: iso(last) };
}

export default function LeaveClient({ studentId }: Props) {
  const router = useRouter();
  const [days, setDays] = useState<Record<string, CalendarDay>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = currentMonthRange();
    try {
      const res = await fetch(
        `/api/attendance?from=${from}&to=${to}&studentId=${studentId}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load.");
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
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  function openDialog(iso: string) {
    setSelectedDate(iso);
    setReason("");
    setMessage(null);
    setError(null);
  }

  function closeDialog() {
    setSelectedDate(null);
    setReason("");
  }

  async function submitLeave() {
    if (!selectedDate) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          date: selectedDate,
          status: "LEAVE",
          reason: reason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      setMessage("Leave marked. Your father has been notified.");
      await load();
      router.refresh();
      setTimeout(closeDialog, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
          Loading calendar…
        </div>
      ) : (
        <Calendar days={days} onSelectDate={openDialog} />
      )}

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          How leave works
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Tap any day to mark it as leave. Your father and qari will see it on
          their calendars and your father will get a notification.
        </p>
      </div>

      {selectedDate && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-neutral-500">
                  Mark leave
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
                onClick={closeDialog}
                aria-label="Close"
                className="rounded-full p-1 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <label className="mt-4 block text-xs font-medium text-neutral-700">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g., Travel, illness, exam"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />

            {message && (
              <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                {message}
              </p>
            )}
            {error && (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={closeDialog}
                disabled={saving}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-800 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={submitLeave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                <CalendarDays className="h-4 w-4" aria-hidden />
                {saving ? "Saving…" : "Mark leave"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}