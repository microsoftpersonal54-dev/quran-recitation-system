import "server-only";
import { db } from "@/lib/db";
import { getSurah } from "@/lib/quran/surahs";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface StudentMistakeInput {
  timestampMs: number;
  category: string;
  severity: string;
  description: string;
}

export interface CreateRecordingOptions {
  studentId: string;
  surahNumber: number;
  ayahFrom: number;
  ayahTo: number;
  paraNumber?: number | null;
  paraFrom?: number | null;
  paraTo?: number | null;
  paraQuarter?: number | null;
  qariId?: string | null;
  durationMs: number;
  notes?: string;
  timezone?: string;
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
  cloudinaryBytes: number;
  mimeType: string;
  checksum?: string | null;
  studentMistakes?: StudentMistakeInput[];
  recordedAtOverride?: Date;
}

export interface CreatedRecording {
  id: string;
  surahNumber: number;
  surahName: string;
  ayahFrom: number;
  ayahTo: number;
  paraNumber: number | null;
  paraFrom: number | null;
  paraTo: number | null;
  paraQuarter: number | null;
  qariId: string | null;
  durationMs: number;
  recordedAt: Date;
  uploadStatus: string;
  reviewStatus: string;
  studentMistakeCount: number;
}

export async function createRecording(
  opts: CreateRecordingOptions
): Promise<CreatedRecording> {
  const surah = getSurah(opts.surahNumber);
  if (!surah) throw new Error("UNKNOWN_SURAH");
  if (opts.ayahTo > surah.ayahCount) throw new Error("INVALID_AYAH_RANGE");

  const now = new Date();
  const recordedAt = opts.recordedAtOverride ?? now;

  const created = await db.recording.create({
    data: {
      studentId: opts.studentId,
      qariId: opts.qariId ?? null,
      surahNumber: opts.surahNumber,
      surahName: surah.name,
      ayahFrom: opts.ayahFrom,
      ayahTo: opts.ayahTo,
      paraNumber: opts.paraNumber ?? null,
      paraFrom: opts.paraFrom ?? null,
      paraTo: opts.paraTo ?? null,
      paraQuarter: opts.paraQuarter ?? null,
      durationMs: opts.durationMs,
      notes: opts.notes || null,
      filePath: opts.cloudinaryUrl,
      fileName: opts.cloudinaryPublicId,
      mimeType: opts.mimeType,
      fileSizeBytes: opts.cloudinaryBytes,
      checksum: opts.checksum ?? null,
      uploadStatus: "UPLOADED",
      reviewStatus: "UNREVIEWED",
      recordedAt,
      uploadedAt: now,
      timezone: opts.timezone || "UTC",
    },
  });

  let studentMistakeCount = 0;
  if (opts.studentMistakes && opts.studentMistakes.length > 0) {
    for (const m of opts.studentMistakes) {
      if (!m.description || m.description.trim().length === 0) continue;
      await db.mistake.create({
        data: {
          recordingId: created.id,
          reviewerId: opts.studentId,
          timestampMs: Math.max(0, Math.floor(m.timestampMs)),
          ayahNumber: null,
          category: m.category,
          severity: m.severity,
          description: m.description.trim(),
          correction: null,
          source: "STUDENT",
        },
      });
      studentMistakeCount += 1;
    }
    if (studentMistakeCount > 0) {
      await db.recording.update({
        where: { id: created.id },
        data: { reviewStatus: "IN_REVIEW" },
      });
    }
  }

  return {
    id: created.id,
    surahNumber: created.surahNumber,
    surahName: created.surahName,
    ayahFrom: created.ayahFrom,
    ayahTo: created.ayahTo,
    paraNumber: created.paraNumber,
    paraFrom: created.paraFrom,
    paraTo: created.paraTo,
    paraQuarter: created.paraQuarter,
    qariId: created.qariId,
    durationMs: created.durationMs,
    recordedAt: created.recordedAt,
    uploadStatus: created.uploadStatus,
    reviewStatus:
      studentMistakeCount > 0 ? "IN_REVIEW" : created.reviewStatus,
    studentMistakeCount,
  };
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
      paraNumber: true,
      paraFrom: true,
      paraTo: true,
      paraQuarter: true,
      qariId: true,
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
  return { recording: rec, remoteUrl: rec.filePath };
}

/** Best-effort Cloudinary cleanup — used by delete paths. */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "video" });
  } catch (err) {
    console.warn("[recordings] Cloudinary delete failed", err);
  }
}