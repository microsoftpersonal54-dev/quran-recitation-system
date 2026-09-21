import "server-only";
import { db } from "@/lib/db";
import { formatMs } from "@/lib/format";
import { getSurah, SURAHS } from "@/lib/quran/surahs";

/**
 * Safe, controlled tool definitions. The AI can ONLY call these functions.
 * It cannot run arbitrary SQL, and every parameter is validated here.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "get_recitations",
    description:
      "List recitations in a date range. Use this for questions like 'what did he recite yesterday', 'this week', 'last month'.",
    parameters: {
      type: "object",
      properties: {
        fromDate: {
          type: "string",
          description:
            "Start date, inclusive, ISO format YYYY-MM-DD (in local time).",
        },
        toDate: {
          type: "string",
          description:
            "End date, inclusive, ISO format YYYY-MM-DD (in local time).",
        },
        studentName: {
          type: "string",
          description:
            "Optional student name to filter by. Omit to include all students.",
        },
      },
      required: ["fromDate", "toDate"],
      additionalProperties: false,
    },
  },
  {
    name: "get_recitation_by_id",
    description:
      "Fetch a single recitation by its ID, including its mistakes. Use when the father refers to a specific recording that you already know the ID of.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "The recording ID." },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_mistakes",
    description:
      "List mistakes in a date range (based on the parent recording's date). Optional filters by category.",
    parameters: {
      type: "object",
      properties: {
        fromDate: { type: "string", description: "YYYY-MM-DD, inclusive." },
        toDate: { type: "string", description: "YYYY-MM-DD, inclusive." },
        category: {
          type: "string",
          description:
            "Optional: TAJWEED | PRONUNCIATION | MADD | MAKHARIJ | GHUNNAH | WAQF | GENERAL | OTHER",
        },
      },
      required: ["fromDate", "toDate"],
      additionalProperties: false,
    },
  },
  {
    name: "get_progress_summary",
    description:
      "Overall statistics: total recordings, total time, total mistakes, streaks, surahs practiced, ayahs covered. Use for questions like 'how much total time' or 'how many mistakes overall'.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_unreviewed_recordings",
    description:
      "List all recordings that have not yet been marked as REVIEWED. Use for 'which recordings have not been reviewed'.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_surah_history",
    description:
      "List surahs practiced with recording counts and total time. Optionally filter by date range. Use for 'which surahs has he practiced'.",
    parameters: {
      type: "object",
      properties: {
        fromDate: {
          type: "string",
          description: "Optional YYYY-MM-DD, inclusive.",
        },
        toDate: {
          type: "string",
          description: "Optional YYYY-MM-DD, inclusive.",
        },
      },
      additionalProperties: false,
    },
  },
];

// -------- helpers --------

function parseDay(s: unknown): Date | null {
  if (typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(d.getTime())) return null;
  return d;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function fmtDuration(ms: number): string {
  return formatMs(ms);
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// -------- executors --------

async function getRecitations(args: Record<string, unknown>) {
  const from = parseDay(args.fromDate);
  const to = parseDay(args.toDate);
  if (!from || !to) {
    return { error: "Invalid date range." };
  }
  const studentName =
    typeof args.studentName === "string" && args.studentName.trim().length > 0
      ? args.studentName.trim()
      : undefined;

  const rows = await db.recording.findMany({
    where: {
      deletedAt: null,
      recordedAt: { gte: from, lte: endOfDay(to) },
      ...(studentName
        ? { student: { name: { contains: studentName } } }
        : {}),
    },
    orderBy: { recordedAt: "asc" },
    select: {
      id: true,
      surahName: true,
      surahNumber: true,
      ayahFrom: true,
      ayahTo: true,
      durationMs: true,
      recordedAt: true,
      reviewStatus: true,
      student: { select: { name: true } },
      _count: { select: { mistakes: true } },
    },
  });

  const totalMs = rows.reduce((s, r) => s + r.durationMs, 0);
  const totalMistakes = rows.reduce((s, r) => s + r._count.mistakes, 0);

  return {
    fromDate: args.fromDate,
    toDate: args.toDate,
    studentName: studentName ?? null,
    count: rows.length,
    totalMs,
    totalFormatted: fmtDuration(totalMs),
    totalMistakes,
    recordings: rows.map((r) => ({
      id: r.id,
      student: r.student.name,
      date: fmtDate(new Date(r.recordedAt)),
      dateIso: new Date(r.recordedAt).toISOString().slice(0, 10),
      time: fmtTime(new Date(r.recordedAt)),
      surah: r.surahName,
      surahNumber: r.surahNumber,
      ayahFrom: r.ayahFrom,
      ayahTo: r.ayahTo,
      durationFormatted: fmtDuration(r.durationMs),
      reviewStatus: r.reviewStatus,
      mistakeCount: r._count.mistakes,
    })),
  };
}

async function getRecitationById(args: Record<string, unknown>) {
  if (typeof args.id !== "string" || !args.id) {
    return { error: "Missing id." };
  }
  const rec = await db.recording.findFirst({
    where: { id: args.id, deletedAt: null },
    include: {
      student: { select: { name: true } },
      mistakes: {
        orderBy: { timestampMs: "asc" },
        include: { reviewer: { select: { name: true } } },
      },
    },
  });
  if (!rec) return { error: "Recording not found." };

  return {
    id: rec.id,
    student: rec.student.name,
    date: fmtDate(new Date(rec.recordedAt)),
    time: fmtTime(new Date(rec.recordedAt)),
    surah: rec.surahName,
    surahNumber: rec.surahNumber,
    ayahFrom: rec.ayahFrom,
    ayahTo: rec.ayahTo,
    durationFormatted: fmtDuration(rec.durationMs),
    reviewStatus: rec.reviewStatus,
    notes: rec.notes,
    mistakes: rec.mistakes.map((m) => ({
      timestampMs: m.timestampMs,
      timestampFormatted: fmtDuration(m.timestampMs),
      ayahNumber: m.ayahNumber,
      category: m.category,
      severity: m.severity,
      description: m.description,
      correction: m.correction,
      reviewer: m.reviewer.name,
    })),
  };
}

async function getMistakes(args: Record<string, unknown>) {
  const from = parseDay(args.fromDate);
  const to = parseDay(args.toDate);
  if (!from || !to) return { error: "Invalid date range." };

  const category =
    typeof args.category === "string" && args.category.trim().length > 0
      ? args.category.trim().toUpperCase()
      : undefined;

  const rows = await db.mistake.findMany({
    where: {
      recording: {
        deletedAt: null,
        recordedAt: { gte: from, lte: endOfDay(to) },
      },
      ...(category ? { category } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      recording: {
        select: {
          id: true,
          surahName: true,
          ayahFrom: true,
          ayahTo: true,
          recordedAt: true,
          student: { select: { name: true } },
        },
      },
      reviewer: { select: { name: true } },
    },
  });

  const byCategory: Record<string, number> = {};
  for (const m of rows) {
    byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
  }

  return {
    fromDate: args.fromDate,
    toDate: args.toDate,
    category: category ?? null,
    count: rows.length,
    byCategory,
    mistakes: rows.map((m) => ({
      recordingId: m.recording.id,
      date: fmtDate(new Date(m.recording.recordedAt)),
      student: m.recording.student.name,
      surah: m.recording.surahName,
      ayahRange: `${m.recording.ayahFrom}–${m.recording.ayahTo}`,
      timestampFormatted: fmtDuration(m.timestampMs),
      ayahNumber: m.ayahNumber,
      category: m.category,
      severity: m.severity,
      description: m.description,
      correction: m.correction,
      reviewer: m.reviewer.name,
    })),
  };
}

async function getProgressSummary() {
  const recordings = await db.recording.findMany({
    where: { deletedAt: null },
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

  const sortedDays = Array.from(dayKeys).sort();
  let currentStreak = 0;
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
    totalRecordings: recordings.length,
    totalFormatted: fmtDuration(totalMs),
    totalMistakes,
    practiceDays: dayKeys.size,
    currentStreak,
    longestStreak,
    surahsPracticed: surahs.size,
    ayahsCovered: ayahKeys.size,
  };
}

async function getUnreviewedRecordings() {
  const rows = await db.recording.findMany({
    where: { deletedAt: null, reviewStatus: { not: "REVIEWED" } },
    orderBy: { recordedAt: "desc" },
    select: {
      id: true,
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

  return {
    count: rows.length,
    recordings: rows.map((r) => ({
      id: r.id,
      date: fmtDate(new Date(r.recordedAt)),
      student: r.student.name,
      surah: r.surahName,
      ayahRange: `${r.ayahFrom}–${r.ayahTo}`,
      durationFormatted: fmtDuration(r.durationMs),
      reviewStatus: r.reviewStatus,
      mistakeCount: r._count.mistakes,
    })),
  };
}

async function getSurahHistory(args: Record<string, unknown>) {
  const from = typeof args.fromDate === "string" ? parseDay(args.fromDate) : null;
  const to = typeof args.toDate === "string" ? parseDay(args.toDate) : null;

  const rows = await db.recording.findMany({
    where: {
      deletedAt: null,
      ...(from && to
        ? { recordedAt: { gte: from, lte: endOfDay(to) } }
        : {}),
    },
    select: {
      surahNumber: true,
      surahName: true,
      durationMs: true,
      _count: { select: { mistakes: true } },
    },
  });

  const map = new Map<
    number,
    { surahNumber: number; surahName: string; count: number; totalMs: number; mistakes: number }
  >();
  for (const r of rows) {
    const existing = map.get(r.surahNumber);
    if (existing) {
      existing.count += 1;
      existing.totalMs += r.durationMs;
      existing.mistakes += r._count.mistakes;
    } else {
      map.set(r.surahNumber, {
        surahNumber: r.surahNumber,
        surahName: r.surahName,
        count: 1,
        totalMs: r.durationMs,
        mistakes: r._count.mistakes,
      });
    }
  }

  const surahs = Array.from(map.values()).sort((a, b) => b.count - a.count);

  return {
    fromDate: args.fromDate ?? null,
    toDate: args.toDate ?? null,
    totalSurahs: surahs.length,
    surahs: surahs.map((s) => ({
      number: s.surahNumber,
      name: s.surahName,
      recordings: s.count,
      totalFormatted: fmtDuration(s.totalMs),
      mistakes: s.mistakes,
    })),
  };
}

// -------- dispatcher --------

export async function executeTool(
  name: string,
  rawArgs: string
): Promise<unknown> {
  let args: Record<string, unknown>;
  try {
    args = rawArgs && rawArgs.length > 0 ? JSON.parse(rawArgs) : {};
  } catch {
    return { error: "Invalid JSON arguments." };
  }

  try {
    switch (name) {
      case "get_recitations":
        return await getRecitations(args);
      case "get_recitation_by_id":
        return await getRecitationById(args);
      case "get_mistakes":
        return await getMistakes(args);
      case "get_progress_summary":
        return await getProgressSummary();
      case "get_unreviewed_recordings":
        return await getUnreviewedRecordings();
      case "get_surah_history":
        return await getSurahHistory(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    console.error(`[ai.tool.${name}] failed`, err);
    return { error: "Tool execution failed." };
  }
}

export function listStudentsHint(): string {
  // Helper used by the system prompt for context.
  const names = new Set<string>();
  SURAHS.slice(0, 1).forEach(() => names.add(""));
  return Array.from(names).join("");
}

export function getSurahName(n: number): string | undefined {
  return getSurah(n)?.name;
}