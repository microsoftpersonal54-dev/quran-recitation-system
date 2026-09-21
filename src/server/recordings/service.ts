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

// ---- Cloudinary configuration ----
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

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

interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  bytes: number;
  resource_type: string;
}

/**
 * Uploads the audio buffer to Cloudinary using an upload stream.
 * Returns the secure HTTPS URL and the public ID.
 */
function uploadToCloudinary(
  buffer: Buffer,
  mimeType: string
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video", // Cloudinary uses "video" for audio files too
        folder: "quran-recitations",
        // Track the original mime type for future use
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

  // 1. Upload to Cloudinary first.
  let upload: CloudinaryUploadResult;
  try {
    upload = await uploadToCloudinary(opts.fileBuffer, opts.mimeType);
  } catch (err) {
    console.error("[recordings] Cloudinary upload failed", err);
    throw new Error("UPLOAD_FAILED");
  }

  // 2. Insert the DB row. If it fails, delete the Cloudinary asset
  //    so we don't leave orphan files in the cloud.
  try {
    const created = await db.recording.create({
      data: {
        studentId: opts.studentId,
        surahNumber: opts.surahNumber,
        surahName: surah.name,
        ayahFrom: opts.ayahFrom,
        ayahTo: opts.ayahTo,
        durationMs: opts.durationMs,
        notes: opts.notes || null,
        // `filePath` now stores the full Cloudinary HTTPS URL
        filePath: upload.secure_url,
        // `fileName` now stores the Cloudinary public_id (useful for deletion)
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
    // Roll back: delete the Cloudinary asset so we don't leave orphans.
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

/**
 * Returns the Cloudinary URL for a recording, so the audio route can
 * redirect the browser to it. We no longer stream from disk.
 */
export async function openRecordingStream(id: string) {
  const rec = await getRecordingById(id);
  if (!rec) return null;
  return { recording: rec, remoteUrl: rec.filePath };
}