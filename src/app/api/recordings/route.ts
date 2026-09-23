import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createRecordingSchema } from "@/lib/validation/recordings";
import {
  createRecording,
  listRecordingsForStudent,
  StudentMistakeInput,
} from "@/server/recordings/service";
import { audit } from "@/server/audit";
import { createNotification } from "@/server/notifications/service";
import { sendPushToUser } from "@/server/push/push-service";
import { db } from "@/lib/db";
import { getParasForRange } from "@/lib/quran/paras";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_FIELD_BYTES = 51 * 1024 * 1024;

/**
 * Returns midnight UTC of the client's local calendar day.
 * Uses the client's timezone string (e.g. "Asia/Karachi") so a recording
 * made at 1 AM local time still lands on the correct calendar day.
 */
function localDayInZone(timezone: string): Date {
  const now = new Date();
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = fmt.formatToParts(now);
    const y = Number(parts.find((p) => p.type === "year")?.value);
    const m = Number(parts.find((p) => p.type === "month")?.value);
    const d = Number(parts.find((p) => p.type === "day")?.value);
    if (!y || !m || !d) throw new Error("bad parts");
    return new Date(Date.UTC(y, m - 1, d));
  } catch {
    // Fallback: UTC day.
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
  }
}

/**
 * Auto-marks the student PRESENT for today's local date — but only if
 * there is no existing attendance row for that day. If the student has
 * already marked LEAVE, we respect that and do nothing.
 */
async function markPresentIfAbsent(
  studentId: string,
  timezone: string
): Promise<void> {
  try {
    const dayDate = localDayInZone(timezone);
    const existing = await db.attendance.findUnique({
      where: { studentId_date: { studentId, date: dayDate } },
      select: { id: true },
    });
    if (existing) return;

    await db.attendance.create({
      data: {
        studentId,
        date: dayDate,
        status: "PRESENT",
        reason: null,
        notes: null,
        markedById: null,
      },
    });
  } catch (err) {
    // Never fail the upload because of attendance marking.
    console.warn("[recordings] auto-attendance failed", err);
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

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
      qariId: true,
      surahNumber: true,
      surahName: true,
      ayahFrom: true,
      ayahTo: true,
      paraNumber: true,
      paraFrom: true,
      paraTo: true,
      paraQuarter: true,
      durationMs: true,
      notes: true,
      mimeType: true,
      fileSizeBytes: true,
      recordedAt: true,
      uploadStatus: true,
      reviewStatus: true,
      student: { select: { id: true, name: true } },
      qari: { select: { id: true, name: true } },
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

  const surahNumber = Number(form.get("surahNumber"));
  const ayahFrom = Number(form.get("ayahFrom"));
  const ayahTo = Number(form.get("ayahTo"));
  const paraQuarterRaw = form.get("paraQuarter");
  const paraQuarter = paraQuarterRaw ? Number(paraQuarterRaw) : null;

  let paraFrom: number | null = null;
  let paraTo: number | null = null;
  let paraNumber: number | null = null;
  const auto = getParasForRange(surahNumber, ayahFrom, surahNumber, ayahTo);
  if (auto) {
    paraFrom = auto.paraFrom;
    paraTo = auto.paraTo;
    paraNumber = auto.paraFrom;
  }

  const formParaFrom = form.get("paraFrom");
  const formParaTo = form.get("paraTo");
  if (formParaFrom && formParaTo) {
    paraFrom = Number(formParaFrom);
    paraTo = Number(formParaTo);
    paraNumber = paraFrom;
  }

  const qariIdRaw = form.get("qariId");
  const qariId =
    typeof qariIdRaw === "string" && qariIdRaw.trim().length > 0
      ? qariIdRaw.trim()
      : null;

  const mistakesRaw = form.get("studentMistakes");
  let studentMistakes: StudentMistakeInput[] = [];
  if (typeof mistakesRaw === "string" && mistakesRaw.trim().length > 0) {
    try {
      const parsed = JSON.parse(mistakesRaw) as unknown;
      if (Array.isArray(parsed)) {
        studentMistakes = parsed
          .filter(
            (m): m is StudentMistakeInput =>
              typeof m === "object" &&
              m !== null &&
              typeof (m as StudentMistakeInput).description === "string" &&
              typeof (m as StudentMistakeInput).timestampMs === "number"
          )
          .slice(0, 20);
      }
    } catch {
      studentMistakes = [];
    }
  }

  const timezone = String(form.get("timezone") ?? "UTC");

  const meta = {
    surahNumber,
    ayahFrom,
    ayahTo,
    paraNumber,
    paraFrom,
    paraTo,
    paraQuarter,
    qariId,
    durationMs: Number(form.get("durationMs")),
    notes: String(form.get("notes") ?? ""),
    timezone,
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
      studentMistakes,
      ...parsed.data,
    });

    // --- Auto-mark PRESENT for the student's local day ---
    await markPresentIfAbsent(user.id, timezone);

    const recipients = await db.user.findMany({
      where: { active: true, role: { in: ["FATHER", "QARI"] } },
      select: { id: true },
    });

    const ayahRange = `${created.ayahFrom}–${created.ayahTo}`;
    const durationLabel = formatDuration(created.durationMs);
    const paraLabel =
      created.paraFrom && created.paraTo
        ? created.paraFrom === created.paraTo
          ? `Para ${created.paraFrom}${
              created.paraQuarter ? ` (${created.paraQuarter}/4)` : ""
            }`
          : `Paras ${created.paraFrom}–${created.paraTo}`
        : "";
    const mistakeNote =
      created.studentMistakeCount > 0
        ? ` · ${created.studentMistakeCount} note${
            created.studentMistakeCount === 1 ? "" : "s"
          } by student`
        : "";

    const notificationBody = `${user.name} · ${created.surahName} · Ayahs ${ayahRange}${
      paraLabel ? ` · ${paraLabel}` : ""
    } · ${durationLabel}${mistakeNote}`;

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

    const pushPayload = {
      title: "New Quran Recitation",
      body: notificationBody,
      url: `/father/recordings/${created.id}`,
    };

    Promise.all(
      recipients.map((r) =>
        sendPushToUser(r.id, pushPayload).catch((err) => {
          console.error(`[push] failed for user ${r.id}`, err);
        })
      )
    ).catch(() => {});

    await audit({
      userId: user.id,
      action: "recording.created",
      target: created.id,
      metadata: {
        surah: created.surahNumber,
        ayahFrom: created.ayahFrom,
        ayahTo: created.ayahTo,
        paraFrom: created.paraFrom,
        paraTo: created.paraTo,
        paraQuarter: created.paraQuarter,
        qariId: created.qariId,
        durationMs: created.durationMs,
        studentMistakeCount: created.studentMistakeCount,
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