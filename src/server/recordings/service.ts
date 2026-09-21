import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { getSurah } from "@/lib/quran/surahs";
import {
  ensureDirFor,
  extensionForMime,
  isAllowedMime,
  maxUploadBytes,
  relativePathFor,
  resolveStoredPath,
} from "@/lib/storage/recordings-path";
import type { CreateRecordingInput } from "@/lib/validation/recordings";

export interface CreateRecordingOptions extends CreateRecordingInput {
  studentId: string;
  fileBuffer: Buffer;
  mimeType: string;
}

export interface CreatedRecording {
  id: string;
  surahNumber: number;
  surahName: string;
  ayahFrom: number;
  ayahTo: number;
  durationMs: number;
  recordedAt: Date;
  uploadStatus: string;
  reviewStatus: string;
}

export async function createRecording(
  opts: CreateRecordingOptions
): Promise<CreatedRecording> {
  if (!isAllowedMime(opts.mimeType)) {
    throw new Error("UNSUPPORTED_MIME");
  }
  const ext = extensionForMime(opts.mimeType);
  if (!ext) throw new Error("UNSUPPORTED_MIME");

  if (opts.fileBuffer.byteLength === 0) {
    throw new Error("EMPTY_FILE");
  }
  if (opts.fileBuffer.byteLength > maxUploadBytes()) {
    throw new Error("FILE_TOO_LARGE");
  }

  const surah = getSurah(opts.surahNumber);
  if (!surah) throw new Error("UNKNOWN_SURAH");
  if (opts.ayahTo > surah.ayahCount) throw new Error("INVALID_AYAH_RANGE");

  const now = new Date();
  const relative = relativePathFor(now, ext);
  const fullPath = await ensureDirFor(relative);

  // Write file first. If DB insert fails, remove the file so we don't
  // leave orphan bytes on disk.
  await fs.writeFile(fullPath, opts.fileBuffer, { mode: 0o600 });

  const checksum = crypto
    .createHash("sha256")
    .update(opts.fileBuffer)
    .digest("hex");

  try {
    // NOTE: We deliberately do NOT wrap this in db.$transaction().
    // With the Prisma 7 better-sqlite3 adapter, interactive transactions
    // can fail with a misleading P1008 SocketTimeout when SQLite is
    // briefly busy. A single create() is already atomic on its own.
    const created = await db.recording.create({
      data: {
        studentId: opts.studentId,
        surahNumber: opts.surahNumber,
        surahName: surah.name,
        ayahFrom: opts.ayahFrom,
        ayahTo: opts.ayahTo,
        durationMs: opts.durationMs,
        notes: opts.notes || null,
        filePath: relative,
        fileName: path.basename(relative),
        mimeType: opts.mimeType,
        fileSizeBytes: opts.fileBuffer.byteLength,
        checksum,
        uploadStatus: "UPLOADED",
        reviewStatus: "UNREVIEWED",
        recordedAt: now,
        uploadedAt: now,
        timezone: opts.timezone || "UTC",
      },
    });

    return {
      id: created.id,
      surahNumber: created.surahNumber,
      surahName: created.surahName,
      ayahFrom: created.ayahFrom,
      ayahTo: created.ayahTo,
      durationMs: created.durationMs,
      recordedAt: created.recordedAt,
      uploadStatus: created.uploadStatus,
      reviewStatus: created.reviewStatus,
    };
  } catch (err) {
    // Roll back the file write so we don't leave orphan bytes
    await fs.unlink(fullPath).catch(() => {});
    throw err;
  }
}

export async function listRecordingsForStudent(studentId: string) {
  return db.recording.findMany({
    where: { studentId, deletedAt: null },
    orderBy: { recordedAt: "desc" },
    select: {
      id: true,
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
    },
  });
}

export async function getRecordingById(id: string) {
  return db.recording.findFirst({
    where: { id, deletedAt: null },
  });
}

export async function openRecordingStream(id: string) {
  const rec = await getRecordingById(id);
  if (!rec) return null;
  const fullPath = resolveStoredPath(rec.filePath);
  try {
    await fs.access(fullPath);
  } catch {
    return null;
  }
  return { recording: rec, fullPath };
}