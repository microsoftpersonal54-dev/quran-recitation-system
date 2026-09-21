import "server-only";
import { db } from "@/lib/db";

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function localWeekKey(d: Date): string {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - s.getDay());
  return localDayKey(s);
}

function localMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export interface ActivityPoint {
  key: string;
  label: string;
  recordings: number;
  totalMs: number;
  mistakes: number;
}

async function getActivitySeries(
  studentId: string | undefined,
  buckets: { key: string; label: string }[],
  keyFn: (d: Date) => string
): Promise<ActivityPoint[]> {
  const map = new Map<string, ActivityPoint>();
  for (const b of buckets) {
    map.set(b.key, {
      key: b.key,
      label: b.label,
      recordings: 0,
      totalMs: 0,
      mistakes: 0,
    });
  }

  const rows = await db.recording.findMany({
    where: {
      deletedAt: null,
      ...(studentId ? { studentId } : {}),
    },
    select: {
      recordedAt: true,
      durationMs: true,
      _count: { select: { mistakes: true } },
    },
  });

  for (const r of rows) {
    const k = keyFn(new Date(r.recordedAt));
    const b = map.get(k);
    if (b) {
      b.recordings += 1;
      b.totalMs += r.durationMs;
      b.mistakes += r._count.mistakes;
    }
  }

  return buckets.map((b) => map.get(b.key)!);
}

export async function getDailyActivity(
  studentId: string | undefined,
  days: number
): Promise<ActivityPoint[]> {
  const buckets: { key: string; label: string }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.push({
      key: localDayKey(d),
      label: d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    });
  }
  return getActivitySeries(studentId, buckets, localDayKey);
}

export async function getWeeklyActivity(
  studentId: string | undefined,
  weeks: number
): Promise<ActivityPoint[]> {
  const buckets: { key: string; label: string }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfThisWeek = new Date(today);
  startOfThisWeek.setDate(startOfThisWeek.getDate() - startOfThisWeek.getDay());

  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(startOfThisWeek);
    d.setDate(d.getDate() - i * 7);
    buckets.push({
      key: localWeekKey(d),
      label: d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    });
  }
  return getActivitySeries(studentId, buckets, localWeekKey);
}

export async function getMonthlyActivity(
  studentId: string | undefined,
  months: number
): Promise<ActivityPoint[]> {
  const buckets: { key: string; label: string }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  today.setDate(1);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setMonth(d.getMonth() - i);
    buckets.push({
      key: localMonthKey(d),
      label: d.toLocaleDateString(undefined, { month: "short" }),
    });
  }
  return getActivitySeries(studentId, buckets, localMonthKey);
}

export interface SurahStat {
  surahNumber: number;
  surahName: string;
  recordings: number;
  totalMs: number;
  mistakes: number;
}

export async function getTopSurahs(
  studentId: string | undefined,
  limit = 6
): Promise<SurahStat[]> {
  const rows = await db.recording.findMany({
    where: {
      deletedAt: null,
      ...(studentId ? { studentId } : {}),
    },
    select: {
      surahNumber: true,
      surahName: true,
      durationMs: true,
      _count: { select: { mistakes: true } },
    },
  });

  const map = new Map<number, SurahStat>();
  for (const r of rows) {
    const existing = map.get(r.surahNumber);
    if (existing) {
      existing.recordings += 1;
      existing.totalMs += r.durationMs;
      existing.mistakes += r._count.mistakes;
    } else {
      map.set(r.surahNumber, {
        surahNumber: r.surahNumber,
        surahName: r.surahName,
        recordings: 1,
        totalMs: r.durationMs,
        mistakes: r._count.mistakes,
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.recordings - a.recordings || b.totalMs - a.totalMs)
    .slice(0, limit);
}