"use client";

import {
  addPending,
  listPending,
  removePending,
  updatePending,
  newId,
  PendingUpload,
} from "./db";

export interface EnqueueInput {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  surahNumber: number;
  ayahFrom: number;
  ayahTo: number;
  notes: string;
  timezone: string;
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
    notes: input.notes,
    timezone: input.timezone,
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
  };
  await addPending(item);
  return item;
}

export type UploadOutcome = "uploaded" | "offline" | "failed";

export async function tryUploadItem(
  item: PendingUpload
): Promise<UploadOutcome> {
  const form = new FormData();
  const ext = extensionFromMime(item.mimeType);
  form.append("audio", item.blob, `recording.${ext}`);
  form.append("surahNumber", String(item.surahNumber));
  form.append("ayahFrom", String(item.ayahFrom));
  form.append("ayahTo", String(item.ayahTo));
  form.append("durationMs", String(item.durationMs));
  form.append("notes", item.notes);
  form.append("timezone", item.timezone);

  try {
    const res = await fetch("/api/recordings", {
      method: "POST",
      body: form,
    });

    if (res.ok) {
      await removePending(item.id);
      return "uploaded";
    }

    const data = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    const errMsg = data?.error ?? `HTTP ${res.status}`;

    // 4xx errors are permanent failures (bad data, unauthorized).
    // 5xx errors are transient (server issue) — keep in queue.
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
  } catch {
    // Network error — definitely offline-ish. Keep in queue.
    await updatePending(item.id, {
      attempts: item.attempts + 1,
      lastError: "No connection",
    });
    return "offline";
  }
}

function extensionFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mp4") || m.includes("m4a")) return "m4a";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  return "bin";
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
    else break; // offline → stop trying the rest
  }

  const remaining = (await listPending()).length;
  return { uploaded, failed, remaining };
}