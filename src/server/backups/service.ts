import "server-only";
import { db } from "@/lib/db";
import { timestampSlug } from "./paths";

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
  payload: unknown;
}

/**
 * JSON export of application tables. Filesystem snapshots are not available
 * on Netlify; the caller downloads the JSON payload.
 */
export async function createBackup(): Promise<BackupResult> {
  const stamp = timestampSlug();

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
  const jsonBytes = Buffer.byteLength(JSON.stringify(payload, null, 2), "utf8");

  return {
    timestamp: stamp,
    sqliteFile: "",
    jsonFile: jsonName,
    sqliteBytes: 0,
    jsonBytes,
    recordings: recordings.length,
    mistakes: mistakes.length,
    users: users.length,
    notifications: notifications.length,
    payload,
  };
}

export interface BackupListing {
  name: string;
  sizeBytes: number;
  createdAt: Date;
  kind: "sqlite" | "json";
}

export async function listBackups(): Promise<BackupListing[]> {
  return [];
}
