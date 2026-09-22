import "server-only";
import { db } from "@/lib/db";

function normalizeDate(d: Date): Date {
  // Returns a Date at midnight UTC for the given calendar day.
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

export interface AttendanceInput {
  studentId: string;
  date: Date;
  status: "PRESENT" | "LEAVE" | "ABSENT";
  reason?: string | null;
  notes?: string | null;
  markedById?: string | null;
}

export async function upsertAttendance(input: AttendanceInput) {
  const date = normalizeDate(input.date);

  return db.attendance.upsert({
    where: {
      studentId_date: { studentId: input.studentId, date },
    },
    update: {
      status: input.status,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
      markedById: input.markedById ?? null,
    },
    create: {
      studentId: input.studentId,
      date,
      status: input.status,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
      markedById: input.markedById ?? null,
    },
  });
}

export async function getAttendanceForRange(
  studentId: string,
  from: Date,
  to: Date
) {
  return db.attendance.findMany({
    where: {
      studentId,
      date: { gte: normalizeDate(from), lte: normalizeDate(to) },
    },
    orderBy: { date: "asc" },
    include: {
      markedBy: { select: { id: true, name: true, role: true } },
    },
  });
}

export async function getAttendanceForDate(studentId: string, date: Date) {
  return db.attendance.findUnique({
    where: {
      studentId_date: {
        studentId,
        date: normalizeDate(date),
      },
    },
    include: {
      markedBy: { select: { id: true, name: true, role: true } },
    },
  });
}

export async function deleteAttendance(studentId: string, date: Date) {
  return db.attendance.deleteMany({
    where: {
      studentId,
      date: normalizeDate(date),
    },
  });
}