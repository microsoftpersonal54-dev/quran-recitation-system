import "server-only";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { getSurah } from "@/lib/quran/surahs";
import { v2 as cloudinary } from "cloudinary";
import {
  extensionForMime,
  isAllowedMime,
  maxUploadBytes,
} from "@/lib/storage/recordings-path";
import type { CreateRecordingInput } from "@/lib/validation/recordings";

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

export interface CreateRecordingOptions extends CreateRecordingInput {
  studentId: string;
  fileBuffer: Buffer;
  mimeType: string;
  studentMistakes?: StudentMistakeInput[];
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

interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  bytes: number;
  resource_type: string;
}

function uploadToCloudinary(
  buffer: Buffer,
  mimeType: string
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        folder: "quran-recitations",
        context: { mimeType },
      },
      (error, result) => {
        if (error || !result) {
          return reject(error ?? new Error("CLOUDINARY_UPLOAD_FAILED"));
        }
        resolve(result as unknown as CloudinaryUploadResult);
      }
    );
    uploadStream.end(buffer);
  });
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

  const checksum = crypto
    .createHash("sha256")
    .update(opts.fileBuffer)
    .digest("hex");

  let upload: CloudinaryUploadResult;
  try {
    upload = await uploadToCloudinary(opts.fileBuffer, opts.mimeType);
  } catch (err) {
    console.error("[recordings] Cloudinary upload failed", err);
    throw new Error("UPLOAD_FAILED");
  }

  try {
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
        filePath: upload.secure_url,
        fileName: upload.public_id,
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

    // Insert student-suggested mistakes (if any).
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
      // If any student mistakes were recorded, put the recording into IN_REVIEW.
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
  } catch (err) {
    await cloudinary.uploader
      .destroy(upload.public_id, { resource_type: "video" })
      .catch(() => {});
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