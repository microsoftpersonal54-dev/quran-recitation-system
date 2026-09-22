import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date");
  const studentIdParam = url.searchParams.get("studentId");

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  // Determine which student we're looking at.
  const studentId =
    user.role === "STUDENT" ? user.id : studentIdParam ?? null;

  if (user.role !== "STUDENT" && !studentId) {
    return NextResponse.json(
      { error: "Missing studentId." },
      { status: 400 }
    );
  }

  // Local-day range (start and end of the given calendar day).
  const dayStart = new Date(dateStr + "T00:00:00.000Z");
  const dayEnd = new Date(dateStr + "T23:59:59.999Z");

  const [attendance, recordings] = await Promise.all([
    db.attendance.findUnique({
      where: {
        studentId_date: {
          studentId: studentId!,
          date: new Date(
            Date.UTC(
              dayStart.getUTCFullYear(),
              dayStart.getUTCMonth(),
              dayStart.getUTCDate()
            )
          ),
        },
      },
      include: {
        markedBy: { select: { id: true, name: true, role: true } },
      },
    }),
    db.recording.findMany({
      where: {
        studentId: studentId!,
        deletedAt: null,
        recordedAt: { gte: dayStart, lte: dayEnd },
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
        _count: { select: { mistakes: true } },
        qari: { select: { id: true, name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    date: dateStr,
    studentId,
    attendance: attendance
      ? {
          id: attendance.id,
          status: attendance.status,
          reason: attendance.reason,
          notes: attendance.notes,
          markedBy: attendance.markedBy,
        }
      : null,
    recordings: recordings.map((r) => ({
      id: r.id,
      surahName: r.surahName,
      surahNumber: r.surahNumber,
      ayahFrom: r.ayahFrom,
      ayahTo: r.ayahTo,
      paraFrom: r.paraFrom,
      paraTo: r.paraTo,
      durationMs: r.durationMs,
      recordedAt: r.recordedAt,
      reviewStatus: r.reviewStatus,
      mistakes: r._count.mistakes,
      qari: r.qari,
    })),
  });
}