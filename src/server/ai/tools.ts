import "server-only";
import { db } from "@/lib/db";
import { formatMs } from "@/lib/format";
import { getSurah, SURAHS } from "@/lib/quran/surahs";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "get_recitations",
    description:
      "List recitations in a date range. Use for 'what did he recite yesterday', 'this week', 'last month'.",
    parameters: {
      type: "object",
      properties: {
        fromDate: { type: "string", description: "YYYY-MM-DD, inclusive." },
        toDate: { type: "string", description: "YYYY-MM-DD, inclusive." },
        studentName: { type: "string", description: "Optional student name." },
      },
      required: ["fromDate", "toDate"],
      additionalProperties: false,
    },
  },
  {
    name: "get_recitation_by_id",
    description: "Fetch a single recitation by ID, including mistakes.",
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_mistakes",
    description: "List mistakes in a date range. Optional category filter.",
    parameters: {
      type: "object",
      properties: {
        fromDate: { type: "string" },
        toDate: { type: "string" },
        category: { type: "string" },
      },
      required: ["fromDate", "toDate"],
      additionalProperties: false,
    },
  },
  {
    name: "get_progress_summary",
    description:
      "Overall statistics: total recordings, time, mistakes, streaks, surahs, ayahs.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_unreviewed_recordings",
    description: "List recordings not yet marked REVIEWED.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_surah_history",
    description: "Surahs practiced with counts and total time.",
    parameters: {
      type: "object",
      properties: {
        fromDate: { type: "string" },
        toDate: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_para_progress",
    description:
      "Which Paras (Juz) of the Quran have been covered, with session counts and total time per Para. Use for 'how many paras has he done', 'which para is he on', 'what paras has he covered'.",
    parameters: {
      type: "object",
      properties: {
        fromDate: { type: "string" },
        toDate: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_attendance",
    description:
      "Attendance records (PRESENT / LEAVE / ABSENT) for a student in a date range. Use for 'did he attend', 'how many days was he on leave'.",
    parameters: {
      type: "object",
      properties: {
        fromDate: { type: "string", description: "YYYY-MM-DD." },
        toDate: { type: "string", description: "YYYY-MM-DD." },
        studentName: { type: "string" },
      },
      required: ["fromDate", "toDate"],
      additionalProperties: false,
    },
  },
  {
    name: "get_leaves",
    description:
      "List all marked leaves in a date range with reasons. Use for 'when was he on leave', 'how many leaves this month'.",
    parameters: {
      type: "object",
      properties: {
        fromDate: { type: "string" },
        toDate: { type: "string" },
        studentName: { type: "string" },
      },
      required: ["fromDate", "toDate"],
      additionalProperties: false,
    },
  },
  {
    name: "get_day_detail",
    description:
      "What happened on a specific date: attendance status, all recitation sessions, and mistake counts. Use for 'what did he do on September 15', 'show me last Tuesday'.",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD." },
        studentName: { type: "string" },
      },
      required: ["date"],
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

async function resolveStudentId(studentName?: string) {
  if (!studentName || !studentName.trim()) return undefined;
  const s = await db.user.findFirst({
    where: { role: "STUDENT", active: true, name: { contains: studentName.trim() } },
    select: { id: true, name: true },
  });
  return s ?? null;
}

// -------- executors --------

async function getRecitations(args: Record<string, unknown>) {
  const from = parseDay(args.fromDate);
  const to = parseDay(args.toDate);
  if (!from || !to) return { error: "Invalid date range." };

  const studentName =
    typeof args.studentName === "string" && args.studentName.trim().length > 0
      ? args.studentName.trim()
      : undefined;

  const rows = await db.recording.findMany({
    where: {
      deletedAt: null,
      recordedAt: { gte: from, lte: endOfDay(to) },
      ...(studentName ? { student: { name: { contains: studentName } } } : {}),
    },
    orderBy: { recordedAt: "asc" },
    select: {
      id: true,
      surahName: true,
      surahNumber: true,
      ayahFrom: true,
      ayahTo: true,
      paraFrom: true,
      paraTo: true,
      durationMs: true,
      recordedAt: true,
      reviewStatus: true,
      student: { select: { name: true } },
      qari: { select: { name: true } },
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
      paraFrom: r.paraFrom,
      paraTo: r.paraTo,
      durationFormatted: fmtDuration(r.durationMs),
      reviewStatus: r.reviewStatus,
      mistakeCount: r._count.mistakes,
      qari: r.qari?.name ?? null,
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
      qari: { select: { name: true } },
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
    qari: rec.qari?.name ?? null,
    date: fmtDate(new Date(rec.recordedAt)),
    time: fmtTime(new Date(rec.recordedAt)),
    surah: rec.surahName,
    surahNumber: rec.surahNumber,
    ayahFrom: rec.ayahFrom,
    ayahTo: rec.ayahTo,
    paraFrom: rec.paraFrom,
    paraTo: rec.paraTo,
    durationFormatted: fmtDuration(rec.durationMs),
    reviewStatus: rec.reviewStatus,
    notes: rec.notes,
    mistakes: rec.mistakes.map((m) => ({
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
      paraFrom: true,
      paraTo: true,
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
  const paras = new Set<number>();

  for (const r of recordings) {
    totalMs += r.durationMs;
    totalMistakes += r._count.mistakes;
    surahs.add(r.surahNumber);
    for (let a = r.ayahFrom; a <= r.ayahTo; a++) {
      ayahKeys.add(`${r.surahNumber}:${a}`);
    }
    if (r.paraFrom && r.paraTo) {
      for (let p = r.paraFrom; p <= r.paraTo; p++) paras.add(p);
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
    parasCovered: paras.size,
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
    {
      surahNumber: number;
      surahName: string;
      count: number;
      totalMs: number;
      mistakes: number;
    }
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

async function getParaProgress(args: Record<string, unknown>) {
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
      paraFrom: true,
      paraTo: true,
      durationMs: true,
      _count: { select: { mistakes: true } },
    },
  });

  const map = new Map<
    number,
    { para: number; sessions: number; totalMs: number; mistakes: number }
  >();

  for (const r of rows) {
    if (r.paraFrom == null || r.paraTo == null) continue;
    for (let p = r.paraFrom; p <= r.paraTo; p++) {
      const existing = map.get(p);
      if (existing) {
        existing.sessions += 1;
        existing.totalMs += r.durationMs;
        existing.mistakes += r._count.mistakes;
      } else {
        map.set(p, {
          para: p,
          sessions: 1,
          totalMs: r.durationMs,
          mistakes: r._count.mistakes,
        });
      }
    }
  }

  const paras = Array.from(map.values()).sort((a, b) => a.para - b.para);

  return {
    fromDate: args.fromDate ?? null,
    toDate: args.toDate ?? null,
    totalParasCovered: paras.length,
    paras: paras.map((p) => ({
      para: p.para,
      sessions: p.sessions,
      totalFormatted: fmtDuration(p.totalMs),
      mistakes: p.mistakes,
    })),
  };
}

async function getAttendance(args: Record<string, unknown>) {
  const from = parseDay(args.fromDate);
  const to = parseDay(args.toDate);
  if (!from || !to) return { error: "Invalid date range." };

  const studentName =
    typeof args.studentName === "string" && args.studentName.trim().length > 0
      ? args.studentName.trim()
      : undefined;

  let studentId: string | undefined;
  if (studentName) {
    const resolved = await resolveStudentId(studentName);
    if (!resolved) return { error: `No student named "${studentName}".` };
    if (resolved === null) return { error: `Multiple students match "${studentName}".` };
    studentId = resolved.id;
  }

  const rows = await db.attendance.findMany({
    where: {
      ...(studentId ? { studentId } : {}),
      date: { gte: from, lte: endOfDay(to) },
    },
    orderBy: { date: "asc" },
    include: {
      student: { select: { name: true } },
      markedBy: { select: { name: true, role: true } },
    },
  });

  const byStatus: Record<string, number> = {};
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }

  return {
    fromDate: args.fromDate,
    toDate: args.toDate,
    studentName: studentName ?? null,
    total: rows.length,
    byStatus,
    entries: rows.map((r) => ({
      student: r.student.name,
      date: fmtDate(new Date(r.date)),
      dateIso: new Date(r.date).toISOString().slice(0, 10),
      status: r.status,
      reason: r.reason,
      markedBy: r.markedBy ? `${r.markedBy.name} (${r.markedBy.role})` : null,
    })),
  };
}

async function getLeaves(args: Record<string, unknown>) {
  const from = parseDay(args.fromDate);
  const to = parseDay(args.toDate);
  if (!from || !to) return { error: "Invalid date range." };

  const studentName =
    typeof args.studentName === "string" && args.studentName.trim().length > 0
      ? args.studentName.trim()
      : undefined;

  let studentId: string | undefined;
  if (studentName) {
    const resolved = await resolveStudentId(studentName);
    if (!resolved) return { error: `No student named "${studentName}".` };
    if (resolved === null) return { error: `Multiple students match "${studentName}".` };
    studentId = resolved.id;
  }

  const rows = await db.attendance.findMany({
    where: {
      status: "LEAVE",
      ...(studentId ? { studentId } : {}),
      date: { gte: from, lte: endOfDay(to) },
    },
    orderBy: { date: "asc" },
    include: { student: { select: { name: true } } },
  });

  return {
    fromDate: args.fromDate,
    toDate: args.toDate,
    studentName: studentName ?? null,
    totalLeaves: rows.length,
    leaves: rows.map((r) => ({
      student: r.student.name,
      date: fmtDate(new Date(r.date)),
      dateIso: new Date(r.date).toISOString().slice(0, 10),
      reason: r.reason,
    })),
  };
}

async function getDayDetail(args: Record<string, unknown>) {
  const date = parseDay(args.date);
  if (!date) return { error: "Invalid date." };

  const studentName =
    typeof args.studentName === "string" && args.studentName.trim().length > 0
      ? args.studentName.trim()
      : undefined;

  let studentId: string | undefined;
  let studentDisplay: string | null = null;
  if (studentName) {
    const resolved = await resolveStudentId(studentName);
    if (!resolved) return { error: `No student named "${studentName}".` };
    if (resolved === null) return { error: `Multiple students match "${studentName}".` };
    studentId = resolved.id;
    studentDisplay = resolved.name;
  } else {
    // If no name given, default to the first active student.
    const first = await db.user.findFirst({
      where: { role: "STUDENT", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    if (!first) return { error: "No students configured." };
    studentId = first.id;
    studentDisplay = first.name;
  }

  const dayStart = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const [attendance, recordings] = await Promise.all([
    db.attendance.findUnique({
      where: { studentId_date: { studentId: studentId!, date: dayStart } },
      include: { markedBy: { select: { name: true } } },
    }),
    db.recording.findMany({
      where: {
        studentId: studentId!,
        deletedAt: null,
        recordedAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { recordedAt: "asc" },
      include: {
        qari: { select: { name: true } },
        _count: { select: { mistakes: true } },
      },
    }),
  ]);

  return {
    date: args.date,
    student: studentDisplay,
    attendance: attendance
      ? {
          status: attendance.status,
          reason: attendance.reason,
          markedBy: attendance.markedBy?.name ?? null,
        }
      : null,
    sessionCount: recordings.length,
    sessions: recordings.map((r) => ({
      id: r.id,
      time: fmtTime(new Date(r.recordedAt)),
      surah: r.surahName,
      ayahRange: `${r.ayahFrom}–${r.ayahTo}`,
      paraFrom: r.paraFrom,
      paraTo: r.paraTo,
      durationFormatted: fmtDuration(r.durationMs),
      reviewStatus: r.reviewStatus,
      mistakeCount: r._count.mistakes,
      qari: r.qari?.name ?? null,
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
      case "get_para_progress":
        return await getParaProgress(args);
      case "get_attendance":
        return await getAttendance(args);
      case "get_leaves":
        return await getLeaves(args);
      case "get_day_detail":
        return await getDayDetail(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    console.error(`[ai.tool.${name}] failed`, err);
    return { error: "Tool execution failed." };
  }
}

export function getSurahName(n: number): string | undefined {
  return getSurah(n)?.name;
}

export function listAllSurahs() {
  return SURAHS.map((s) => ({ number: s.number, name: s.name }));
}