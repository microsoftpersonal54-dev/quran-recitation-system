import "server-only";
import path from "node:path";
import fs from "node:fs/promises";
import Database from "better-sqlite3";
import { db } from "@/lib/db";
import {
  backupsDir,
  databasePath,
  ensureBackupDirs,
  exportsDir,
  timestampSlug,
} from "./paths";

export interface BackupResult {
  timestamp: string;
  sqliteFile: string;
  jsonFile: string;
  sqliteBytes: number;
  jsonBytes: number;
  recordings: number;
  mistakes: number;
  users: number;
  notifications: number;
}

/**
 * Creates:
 *   1. A consistent snapshot of the SQLite file (via better-sqlite3's
 *      online backup API — safe even while the app is running).
 *   2. A JSON export of every table for human/portable backup.
 *
 * Returns metadata. Never overwrites the live database.
 */
export async function createBackup(): Promise<BackupResult> {
  await ensureBackupDirs();
  const stamp = timestampSlug();

  const sqliteName = `quran_${stamp}.sqlite`;
  const sqliteDest = path.join(backupsDir(), sqliteName);

  // 1. SQLite snapshot via the online backup API.
  const src = new Database(databasePath(), { readonly: true, fileMustExist: true });
  try {
    await src.backup(sqliteDest);
  } finally {
    src.close();
  }

  const sqliteStat = await fs.stat(sqliteDest);

  // 2. JSON export.
  const [
    users,
    recordings,
    mistakes,
    notifications,
    auditLogs,
    appSettings,
  ] = await Promise.all([
    db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
      },
    }),
    db.recording.findMany({
      include: { mistakes: true },
    }),
    db.mistake.findMany(),
    db.notification.findMany(),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
    db.appSetting.findMany(),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    app: "quran-recitation-record",
    counts: {
      users: users.length,
      recordings: recordings.length,
      mistakes: mistakes.length,
      notifications: notifications.length,
      auditLogs: auditLogs.length,
    },
    users,
    recordings,
    mistakes,
    notifications,
    auditLogs,
    appSettings,
  };

  const jsonName = `quran_${stamp}.json`;
  const jsonDest = path.join(backupsDir(), jsonName);
  await fs.writeFile(jsonDest, JSON.stringify(payload, null, 2), {
    mode: 0o600,
  });

  const jsonStat = await fs.stat(jsonDest);

  return {
    timestamp: stamp,
    sqliteFile: sqliteName,
    jsonFile: jsonName,
    sqliteBytes: sqliteStat.size,
    jsonBytes: jsonStat.size,
    recordings: recordings.length,
    mistakes: mistakes.length,
    users: users.length,
    notifications: notifications.length,
  };
}

export interface BackupListing {
  name: string;
  sizeBytes: number;
  createdAt: Date;
  kind: "sqlite" | "json";
}

export async function listBackups(): Promise<BackupListing[]> {
  await ensureBackupDirs();
  const dir = backupsDir();
  const entries = await fs.readdir(dir, { withFileTypes: true });

  const items: BackupListing[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    const stat = await fs.stat(full);
    const kind: "sqlite" | "json" = e.name.endsWith(".json") ? "json" : "sqlite";
    items.push({
      name: e.name,
      sizeBytes: stat.size,
      createdAt: stat.mtime,
      kind,
    });
  }

  return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}