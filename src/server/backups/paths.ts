import "server-only";
import path from "node:path";
import fs from "node:fs/promises";

const STORAGE_ROOT = process.env.STORAGE_ROOT ?? "./data";

export function backupsDir(): string {
  return path.resolve(STORAGE_ROOT, "backups");
}

export function exportsDir(): string {
  return path.resolve(STORAGE_ROOT, "exports");
}

export function databasePath(): string {
  const url = process.env.DATABASE_URL ?? "file:./data/database/quran.sqlite";
  // Strip "file:" prefix
  const raw = url.startsWith("file:") ? url.slice(5) : url;
  return path.resolve(raw);
}

export async function ensureBackupDirs(): Promise<void> {
  await fs.mkdir(backupsDir(), { recursive: true });
  await fs.mkdir(exportsDir(), { recursive: true });
}

export function timestampSlug(d = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}_${hh}${mi}${ss}`;
}