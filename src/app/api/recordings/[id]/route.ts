import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getRecordingById } from "@/server/recordings/service";
import { db } from "@/lib/db";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const rec = await getRecordingById(id);
  if (!rec) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (user.role === "STUDENT" && rec.studentId !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const student = await db.user.findUnique({
    where: { id: rec.studentId },
    select: { id: true, name: true },
  });

  return NextResponse.json({
    recording: {
      id: rec.id,
      studentId: rec.studentId,
      student,
      surahNumber: rec.surahNumber,
      surahName: rec.surahName,
      ayahFrom: rec.ayahFrom,
      ayahTo: rec.ayahTo,
      durationMs: rec.durationMs,
      notes: rec.notes,
      mimeType: rec.mimeType,
      fileSizeBytes: rec.fileSizeBytes,
      recordedAt: rec.recordedAt,
      uploadedAt: rec.uploadedAt,
      uploadStatus: rec.uploadStatus,
      reviewStatus: rec.reviewStatus,
      timezone: rec.timezone,
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const rec = await getRecordingById(id);
  if (!rec) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Only the Father or the owning student can delete.
  const allowed =
    user.role === "FATHER" ||
    (user.role === "STUDENT" && rec.studentId === user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Soft delete: keep the row + file for recovery, just hide it.
  await db.recording.update({
    where: { id: rec.id },
    data: { deletedAt: new Date() },
  });

  await audit({
    userId: user.id,
    action: "recording.deleted",
    target: rec.id,
    metadata: { soft: true },
  });

  return NextResponse.json({ ok: true });
}