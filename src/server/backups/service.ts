import "server-only";
import { db } from "@/lib/db";

/**
 * Cloud-friendly backup service.
 * On Vercel there is no persistent disk, so we do NOT write a SQLite snapshot.
 * Instead we produce a JSON export that the caller can stream to the browser
 * as a file download, or store in external storage (Cloudinary, S3, etc.).
 */

export interface BackupPayload {
  exportedAt: string;
  schemaVersion: number;
  app: string;
  counts: {
    users: number;
    recordings: number;
    mistakes: number;
    notifications: number;
    auditLogs: number;
  };
  users: unknown[];
  recordings: unknown[];
  mistakes: unknown[];
  notifications: unknown[];
  auditLogs: unknown[];
  appSettings: unknown[];
}

export async function createBackupPayload(): Promise<BackupPayload> {
  const [users, recordings, mistakes, notifications, auditLogs, appSettings] =
    await Promise.all([
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
      db.recording.findMany({ include: { mistakes: true } }),
      db.mistake.findMany(),
      db.notification.findMany(),
      db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
      db.appSetting.findMany(),
    ]);

  return {
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
}

export interface BackupListing {
  name: string;
  sizeBytes: number;
  createdAt: Date;
  kind: "sqlite" | "json";
}

/**
 * On cloud deployments, backups aren't stored on a local disk.
 * This returns an empty list so the UI shows "No backups yet"
 * with a working "Create backup now" button that downloads a JSON file.
 */
export async function listBackups(): Promise<BackupListing[]> {
  return [];
}