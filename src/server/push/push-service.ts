import "server-only";
import webpush from "web-push";
import { db } from "@/lib/db";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    console.warn("[push] VAPID keys not set — push disabled.");
    return;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string; // Where to go when the notification is clicked
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  ensureConfigured();
  if (!configured) return;

  const subs = await db.pushSubscription.findMany({ where: { userId } });
  const body = JSON.stringify(payload);

  for (const sub of subs) {
    const keys = JSON.parse(sub.keys);
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys },
        body
      );
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      // 404 or 410 means the subscription is dead — remove it.
      if (statusCode === 404 || statusCode === 410) {
        await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        console.error(`[push] failed for ${sub.endpoint}`, err);
      }
    }
  }
}