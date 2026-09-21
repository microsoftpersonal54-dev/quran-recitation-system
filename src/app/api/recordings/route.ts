import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createRecordingSchema } from "@/lib/validation/recordings";
import {
  createRecording,
  listRecordingsForStudent,
} from "@/server/recordings/service";
import { audit } from "@/server/audit";
import { createNotification } from "@/server/notifications/service";
import { dispatchPushToUsers } from "@/server/push/dispatch";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 26;

const MAX_UPLOAD_FIELD_BYTES = 51 * 1024 * 1024; // ~51 MB safety margin

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Student sees their own; Father/Qari see everything.
  if (user.role === "STUDENT") {
    const items = await listRecordingsForStudent(user.id);
    return NextResponse.json({ items });
  }

  const items = await listAllRecordings();
  return NextResponse.json({ items });
}

async function listAllRecordings() {
  return db.recording.findMany({
    where: { deletedAt: null },
    orderBy: { recordedAt: "desc" },
    select: {
      id: true,
      studentId: true,
      surahNumber: true,
      surahName: true,
      ayahFrom: true,
      ayahTo: true,
      durationMs: true,
      notes: true,
      mimeType: true,
      fileSizeBytes: true,
      recordedAt: true,
      uploadStatus: true,
      reviewStatus: true,
      student: { select: { id: true, name: true } },
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.role !== "STUDENT") {
    return NextResponse.json(
      { error: "Only students can upload recordings." },
      { status: 403 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data." },
      { status: 400 }
    );
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json(
      { error: "Missing 'audio' file." },
      { status: 400 }
    );
  }
  if (audio.size === 0) {
    return NextResponse.json(
      { error: "The audio file is empty." },
      { status: 400 }
    );
  }
  if (audio.size > MAX_UPLOAD_FIELD_BYTES) {
    return NextResponse.json(
      { error: "The audio file is too large." },
      { status: 413 }
    );
  }

  const meta = {
    surahNumber: Number(form.get("surahNumber")),
    ayahFrom: Number(form.get("ayahFrom")),
    ayahTo: Number(form.get("ayahTo")),
    durationMs: Number(form.get("durationMs")),
    notes: String(form.get("notes") ?? ""),
    timezone: String(form.get("timezone") ?? "UTC"),
  };

  const parsed = createRecordingSchema.safeParse(meta);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid metadata.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const mime = audio.type || "application/octet-stream";
  const buf = Buffer.from(await audio.arrayBuffer());

  try {
    const created = await createRecording({
      studentId: user.id,
      fileBuffer: buf,
      mimeType: mime,
      ...parsed.data,
    });

    // Notify all Father and Qari accounts — but ONLY after the recording
    // row was successfully inserted. Never notify on failed saves.
    const recipients = await db.user.findMany({
      where: { active: true, role: { in: ["FATHER", "QARI"] } },
      select: { id: true },
    });

    const ayahRange = `${created.ayahFrom}–${created.ayahTo}`;
    const durationLabel = formatDuration(created.durationMs);
    const notificationBody = `${user.name} · ${created.surahName} · Ayahs ${ayahRange} · ${durationLabel}`;

    // 1) In-app notification (bell icon / Alerts tab)
    await Promise.all(
      recipients.map((r) =>
        createNotification({
          recipientId: r.id,
          recordingId: created.id,
          type: "NEW_RECORDING",
          title: "New Quran Recitation",
          body: notificationBody,
        })
      )
    );

    // 2) Push notification (mobile popup in notification center).
    //    Fire and forget — a push failure must never break the upload response.
    const pushPayload = {
      title: "New Quran Recitation",
      body: notificationBody,
      url: `/father/recordings/${created.id}`,
    };

    const recipientIds = recipients.map((r) => r.id);
    const subscriptions =
      recipientIds.length === 0
        ? []
        : await db.pushSubscription.findMany({
            where: { userId: { in: recipientIds } },
            select: { id: true, endpoint: true, keys: true },
          });

    dispatchPushToUsers({
      userIds: recipientIds,
      payload: pushPayload,
      subscriptions,
    }).catch((err) => {
      console.error("[push] dispatch failed", err);
    });

    await audit({
      userId: user.id,
      action: "recording.created",
      target: created.id,
      metadata: {
        surah: created.surahNumber,
        ayahFrom: created.ayahFrom,
        ayahTo: created.ayahTo,
        durationMs: created.durationMs,
        size: buf.byteLength,
        mime,
      },
    });

    return NextResponse.json({ recording: created }, { status: 201 });
  } catch (err) {
    const code = (err as Error).message;
    if (
      code === "UNSUPPORTED_MIME" ||
      code === "EMPTY_FILE" ||
      code === "FILE_TOO_LARGE" ||
      code === "UNKNOWN_SURAH" ||
      code === "INVALID_AYAH_RANGE"
    ) {
      return NextResponse.json({ error: code }, { status: 400 });
    }
    console.error("[recordings] create failed", err);
    return NextResponse.json(
      { error: "Could not save the recording." },
      { status: 500 }
    );
  }
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}