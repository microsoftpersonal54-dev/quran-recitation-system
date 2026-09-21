import "server-only";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";

const STORAGE_ROOT = process.env.STORAGE_ROOT ?? "./data";

export function recordingsRoot(): string {
  return path.resolve(STORAGE_ROOT, "recordings");
}

/**
 * Builds a relative path under data/recordings for the given date.
 * Example: 2026/09/20/<random>.webm
 */
export function relativePathFor(
  date: Date,
  extension: string
): string {
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const rand = crypto.randomBytes(8).toString("hex");
  return path.posix.join(yyyy, mm, dd, `${rand}.${extension}`);
}

export async function ensureDirFor(relativePath: string): Promise<string> {
  const fullPath = path.resolve(recordingsRoot(), relativePath);
  const dir = path.dirname(fullPath);
  await fs.mkdir(dir, { recursive: true });
  return fullPath;
}

/**
 * Resolves a stored relative path to an absolute path on disk.
 * Throws if the resolved path escapes the recordings root
 * (protects against stored path traversal — defense in depth).
 */
export function resolveStoredPath(relativePath: string): string {
  const root = recordingsRoot();
  const full = path.resolve(root, relativePath);
  const normalizedRoot = root.endsWith(path.sep) ? root : root + path.sep;
  if (!full.startsWith(normalizedRoot)) {
    throw new Error("Invalid recording path.");
  }
  return full;
}

/**
 * Maps an incoming MIME type to a safe file extension.
 * Returns null if the MIME type is not allowed.
 */
export function extensionForMime(mime: string): string | null {
  const m = mime.toLowerCase().split(";")[0].trim();
  switch (m) {
    case "audio/webm":
      return "webm";
    case "audio/ogg":
      return "ogg";
    case "audio/mp4":
    case "audio/m4a":
    case "audio/x-m4a":
      return "m4a";
    case "audio/mpeg":
      return "mp3";
    case "audio/wav":
    case "audio/x-wav":
      return "wav";
    default:
      return null;
  }
}

export function isAllowedMime(mime: string): boolean {
  return extensionForMime(mime) !== null;
}

export function maxUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB ?? "50");
  const safe = Number.isFinite(mb) && mb > 0 ? mb : 50;
  return safe * 1024 * 1024;
}