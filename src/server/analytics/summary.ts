import "server-only";
import { db } from "@/lib/db";

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // Week starts Sunday for simplicity.
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function startOfMonth(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

export interface PeriodStats {
  recordings: number;
  totalMs: number;
  mistakes: number;
  daysPracticed: number;
  uniqueSurahs: number;
}

export async function getPeriodStats(
  from: Date,
  studentId?: string
): Promise<PeriodStats> {
  const recordings = await db.recording.findMany({
    where: {
      deletedAt: null,
      recordedAt: { gte: from },
      ...(studentId ? { studentId } : {}),
    },
    select: {
      durationMs: true,
      surahNumber: true,
      recordedAt: true,
      _count: { select: { mistakes: true } },
    },
  });

  const days = new Set<string>();
  const surahs = new Set<number>();
  let totalMs = 0;
  let mistakes = 0;

  for (const r of recordings) {
    totalMs += r.durationMs;
    mistakes += r._count.mistakes;
    surahs.add(r.surahNumber);
    const d = new Date(r.recordedAt);
    days.add(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`
    );
  }

  return {
    recordings: recordings.length,
    totalMs,
    mistakes,
    daysPracticed: days.size,
    uniqueSurahs: surahs.size,
  };
}

export interface OverallStats {
  totalRecordings: number;
  totalMs: number;
  totalMistakes: number;
  averageMistakesPerRecording: number;
  averageDurationMs: number;
  practiceDays: number;
  currentStreak: number;
  longestStreak: number;
  surahsPracticed: number;
  ayahsCovered: number;
}

export async function getOverallStats(
  studentId?: string
): Promise<OverallStats> {
  const recordings = await db.recording.findMany({
    where: {
      deletedAt: null,
      ...(studentId ? { studentId } : {}),
    },
    select: {
      durationMs: true,
      surahNumber: true,
      ayahFrom: true,
      ayahTo: true,
      recordedAt: true,
      _count: { select: { mistakes: true } },
    },
    orderBy: { recordedAt: "asc" },
  });

  let totalMs = 0;
  let totalMistakes = 0;
  const surahs = new Set<number>();
  const ayahKeys = new Set<string>();
  const dayKeys = new Set<string>();

  for (const r of recordings) {
    totalMs += r.durationMs;
    totalMistakes += r._count.mistakes;
    surahs.add(r.surahNumber);
    for (let a = r.ayahFrom; a <= r.ayahTo; a++) {
      ayahKeys.add(`${r.surahNumber}:${a}`);
    }
    const d = new Date(r.recordedAt);
    dayKeys.add(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`
    );
  }

  const totalRecordings = recordings.length;

  // Streaks
  const sortedDays = Array.from(dayKeys).sort();
  let longestStreak = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of sortedDays) {
    const [y, m, d] = k.split("-").map(Number);
    const cur = new Date(y, m - 1, d);
    if (prev) {
      const diff = Math.round(
        (cur.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000)
      );
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
    prev = cur;
  }

  let currentStreak = 0;
  if (sortedDays.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastKey = sortedDays[sortedDays.length - 1];
    const [ly, lm, ld] = lastKey.split("-").map(Number);
    const lastDate = new Date(ly, lm - 1, ld);

    if (lastDate >= yesterday) {
      let cursor = lastDate;
      while (true) {
        const k = `${cursor.getFullYear()}-${String(
          cursor.getMonth() + 1
        ).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        if (!dayKeys.has(k)) break;
        currentStreak += 1;
        cursor = new Date(cursor);
        cursor.setDate(cursor.getDate() - 1);
      }
    }
  }

  return {
    totalRecordings,
    totalMs,
    totalMistakes,
    averageMistakesPerRecording:
      totalRecordings > 0 ? totalMistakes / totalRecordings : 0,
    averageDurationMs:
      totalRecordings > 0 ? Math.round(totalMs / totalRecordings) : 0,
    practiceDays: dayKeys.size,
    currentStreak,
    longestStreak,
    surahsPracticed: surahs.size,
    ayahsCovered: ayahKeys.size,
  };
}

export interface RecentRecording {
  id: string;
  studentId: string;
  studentName: string;
  surahNumber: number;
  surahName: string;
  ayahFrom: number;
  ayahTo: number;
  durationMs: number;
  recordedAt: Date;
  reviewStatus: string;
  mistakeCount: number;
}

export async function getRecentRecordings(
  limit = 8
): Promise<RecentRecording[]> {
  const rows = await db.recording.findMany({
    where: { deletedAt: null },
    orderBy: { recordedAt: "desc" },
    take: limit,
    select: {
      id: true,
      studentId: true,
      surahNumber: true,
      surahName: true,
      ayahFrom: true,
      ayahTo: true,
      durationMs: true,
      recordedAt: true,
      reviewStatus: true,
      student: { select: { name: true } },
      _count: { select: { mistakes: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    studentName: r.student.name,
    surahNumber: r.surahNumber,
    surahName: r.surahName,
    ayahFrom: r.ayahFrom,
    ayahTo: r.ayahTo,
    durationMs: r.durationMs,
    recordedAt: r.recordedAt,
    reviewStatus: r.reviewStatus,
    mistakeCount: r._count.mistakes,
  }));
}