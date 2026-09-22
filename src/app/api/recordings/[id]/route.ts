import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getRecordingById } from "@/server/recordings/service";
import { db } from "@/lib/db";
import { audit } from "@/server/audit";
import { v2 as cloudinary } from "cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

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
      paraFrom: rec.paraFrom,
      paraTo: rec.paraTo,
      paraQuarter: rec.paraQuarter,
      qariId: rec.qariId,
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

  const allowed =
    user.role === "FATHER" ||
    (user.role === "STUDENT" && rec.studentId === user.id);

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Delete from Cloudinary first (best effort — don't block DB delete).
  if (rec.fileName && rec.fileName.length > 0) {
    try {
      await cloudinary.uploader.destroy(rec.fileName, {
        resource_type: "video",
      });
    } catch (err) {
      console.warn("[recordings] Cloudinary delete failed", err);
    }
  }

  // Hard delete the DB row (mistakes cascade via schema onDelete).
  await db.recording.delete({ where: { id: rec.id } });

  await audit({
    userId: user.id,
    action: "recording.deleted",
    target: rec.id,
    metadata: { hard: true },
  });

  return NextResponse.json({ ok: true });
}