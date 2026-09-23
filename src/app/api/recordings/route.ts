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
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
  }
}

function parseBackdate(isoDate: string): {
  recordedAt: Date;
  attendanceDay: Date;
} | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return {
    recordedAt: new Date(Date.UTC(y, mo, d, 12, 0, 0)),
    attendanceDay: new Date(Date.UTC(y, mo, d)),
  };
}

async function markPresentIfAbsent(
  studentId: string,
  dayDate: Date
): Promise<void> {
  try {
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

const studentMistakesSchema = (raw: unknown): StudentMistakeInput[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is StudentMistakeInput =>
        typeof m === "object" &&
        m !== null &&
        typeof (m as StudentMistakeInput).description === "string" &&
        typeof (m as StudentMistakeInput).timestampMs === "number"
    )
    .slice(0, 20);
};

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

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const surahNumber = Number(body.surahNumber);
  const ayahFrom = Number(body.ayahFrom);
  const ayahTo = Number(body.ayahTo);
  const paraQuarter =
    body.paraQuarter != null ? Number(body.paraQuarter) : null;

  let paraFrom: number | null = null;
  let paraTo: number | null = null;
  let paraNumber: number | null = null;
  const auto = getParasForRange(surahNumber, ayahFrom, surahNumber, ayahTo);
  if (auto) {
    paraFrom = auto.paraFrom;
    paraTo = auto.paraTo;
    paraNumber = auto.paraFrom;
  }

  const qariId =
    typeof body.qariId === "string" && body.qariId.trim().length > 0
      ? body.qariId.trim()
      : null;

  const timezone = String(body.timezone ?? "UTC");

  const backdateRaw = body.recordedAt;
  let recordedAtOverride: Date | undefined;
  let attendanceDay: Date;
  if (typeof backdateRaw === "string" && backdateRaw.trim().length > 0) {
    const parsedBackdate = parseBackdate(backdateRaw.trim());
    if (parsedBackdate) {
      recordedAtOverride = parsedBackdate.recordedAt;
      attendanceDay = parsedBackdate.attendanceDay;
    } else {
      attendanceDay = localDayInZone(timezone);
    }
  } else {
    attendanceDay = localDayInZone(timezone);
  }

  const meta = {
    surahNumber,
    ayahFrom,
    ayahTo,
    paraNumber,
    paraFrom,
    paraTo,
    paraQuarter,
    qariId,
    durationMs: Number(body.durationMs),
    notes: String(body.notes ?? ""),
    timezone,
    cloudinaryUrl: String(body.cloudinaryUrl ?? ""),
    cloudinaryPublicId: String(body.cloudinaryPublicId ?? ""),
    cloudinaryBytes: Number(body.cloudinaryBytes ?? 0),
    mimeType: String(body.mimeType ?? "audio/webm"),
    checksum: body.checksum ? String(body.checksum) : null,
  };

  const parsed = createRecordingSchema.safeParse(meta);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid metadata.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const studentMistakes = studentMistakesSchema(body.studentMistakes);

  try {
    const created = await createRecording({
      studentId: user.id,
      ...parsed.data,
      studentMistakes,
      recordedAtOverride,
    });

    await markPresentIfAbsent(user.id, attendanceDay);

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
    const backdateNote = recordedAtOverride
      ? ` · for ${recordedAtOverride.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}`
      : "";

    const notificationBody = `${user.name} · ${created.surahName} · Ayahs ${ayahRange}${
      paraLabel ? ` · ${paraLabel}` : ""
    } · ${durationLabel}${mistakeNote}${backdateNote}`;

    await Promise.all(
      recipients.map((r) =>
        createNotification({
          recipientId: r.id,
          recordingId: created.id,
          type: "NEW_RECORDING",
          title: recordedAtOverride
            ? "New Recitation (backdated)"
            : "New Quran Recitation",
          body: notificationBody,
        })
      )
    );

    const pushPayload = {
      title: recordedAtOverride
        ? "New Recitation (backdated)"
        : "New Quran Recitation",
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
        backdated: Boolean(recordedAtOverride),
        cloudinaryBytes: parsed.data.cloudinaryBytes,
      },
    });

    return NextResponse.json({ recording: created }, { status: 201 });
  } catch (err) {
    const code = (err as Error).message;
    if (
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