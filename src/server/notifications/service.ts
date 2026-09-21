import "server-only";
import { db } from "@/lib/db";

export interface CreateNotificationInput {
  recipientId: string;
  recordingId?: string | null;
  type: string;
  title: string;
  body: string;
}

export async function createNotification(
  input: CreateNotificationInput
) {
  return db.notification.create({
    data: {
      recipientId: input.recipientId,
      recordingId: input.recordingId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
    },
  });
}

export async function listNotificationsForUser(userId: string, limit = 50) {
  return db.notification.findMany({
    where: { recipientId: userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      readAt: true,
      createdAt: true,
      recordingId: true,
    },
  });
}

export async function getUnreadCount(userId: string): Promise<number> {
  return db.notification.count({
    where: { recipientId: userId, readAt: null },
  });
}

export async function markNotificationRead(
  userId: string,
  notificationId: string
): Promise<boolean> {
  const n = await db.notification.findFirst({
    where: { id: notificationId, recipientId: userId },
  });
  if (!n) return false;
  if (n.readAt) return true;

  await db.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
  return true;
}

export async function markAllRead(userId: string): Promise<void> {
  await db.notification.updateMany({
    where: { recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });
}