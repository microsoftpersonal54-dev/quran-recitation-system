"use client";

import {
  addPending,
  listPending,
  removePending,
  updatePending,
  newId,
  PendingUpload,
  StudentMistakeDraft,
} from "./db";
import { uploadToCloudinary } from "@/lib/cloudinary/direct-upload";

export interface EnqueueInput {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  surahNumber: number;
  ayahFrom: number;
  ayahTo: number;
  paraNumber: number | null;
  paraFrom: number | null;
  paraTo: number | null;
  paraQuarter: number | null;
  qariId: string | null;
  notes: string;
  timezone: string;
  studentMistakes: StudentMistakeDraft[];
  /** YYYY-MM-DD if backdated, else null. */
  recordedAt: string | null;
}

export async function enqueue(input: EnqueueInput): Promise<PendingUpload> {
  const item: PendingUpload = {
    id: newId(),
    blob: input.blob,
    mimeType: input.mimeType,
    durationMs: input.durationMs,
    surahNumber: input.surahNumber,
    ayahFrom: input.ayahFrom,
    ayahTo: input.ayahTo,
    paraNumber: input.paraNumber,
    paraFrom: input.paraFrom,
    paraTo: input.paraTo,
    paraQuarter: input.paraQuarter,
    qariId: input.qariId,
    notes: input.notes,
    timezone: input.timezone,
    studentMistakes: input.studentMistakes,
    recordedAt: input.recordedAt,
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
  };
  await addPending(item);
  return item;
}

export type UploadOutcome = "uploaded" | "offline" | "failed";

/**
 * Retries one queued upload:
 *   1. Upload blob to Cloudinary (direct — no size limit)
 *   2. POST metadata to /api/recordings
 *   3. Delete from queue on success
 */
export async function tryUploadItem(
  item: PendingUpload
): Promise<UploadOutcome> {
  try {
    // Step 1: Cloudinary direct upload
    const cloudResult = await uploadToCloudinary(item.blob);

    // Step 2: send metadata to our API
    const res = await fetch("/api/recordings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        surahNumber: item.surahNumber,
        ayahFrom: item.ayahFrom,
        ayahTo: item.ayahTo,
        paraQuarter: item.paraQuarter,
        qariId: item.qariId,
        durationMs: item.durationMs,
        notes: item.notes,
        timezone: item.timezone,
        studentMistakes: item.studentMistakes,
        recordedAt: item.recordedAt,
        cloudinaryUrl: cloudResult.secure_url,
        cloudinaryPublicId: cloudResult.public_id,
        cloudinaryBytes: cloudResult.bytes,
        mimeType: item.mimeType,
      }),
    });

    if (res.ok) {
      await removePending(item.id);
      return "uploaded";
    }

    const data = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    const errMsg = data?.error ?? `HTTP ${res.status}`;

    // 4xx = permanent failure. 5xx = transient, keep trying.
    if (res.status >= 400 && res.status < 500) {
      await updatePending(item.id, {
        attempts: item.attempts + 1,
        lastError: `Rejected: ${errMsg}`,
      });
      return "failed";
    }

    await updatePending(item.id, {
      attempts: item.attempts + 1,
      lastError: `Server error: ${errMsg}`,
    });
    return "offline";
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed.";
    await updatePending(item.id, {
      attempts: item.attempts + 1,
      lastError: msg,
    });
    // Network error → treat as offline, keep in queue.
    return "offline";
  }
}

export async function flushQueue(): Promise<{
  uploaded: number;
  failed: number;
  remaining: number;
}> {
  const items = await listPending();
  let uploaded = 0;
  let failed = 0;

  for (const item of items) {
    if (typeof navigator !== "undefined" && !navigator.onLine) break;
    const result = await tryUploadItem(item);
    if (result === "uploaded") uploaded += 1;
    else if (result === "failed") failed += 1;
    else break;
  }

  const remaining = (await listPending()).length;
  return { uploaded, failed, remaining };
}