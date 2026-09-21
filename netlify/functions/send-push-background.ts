import type { Handler } from "@netlify/functions";
import webpush from "web-push";
import { Client } from "pg";

/**
 * Background function: send web-push to stored subscriptions.
 * Invoked by POST /api/recordings after a successful upload.
 * Filename suffix `-background` makes Netlify return 202 immediately.
 */
export const handler: Handler = async (event) => {
  const secret = process.env.INTERNAL_FUNCTION_SECRET;
  const auth = event.headers.authorization ?? event.headers.Authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!secret || token !== secret) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    console.warn("[push] VAPID keys not set — skipping.");
    return { statusCode: 204, body: "" };
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  let body: {
    payload?: { title: string; body: string; url: string };
    subscriptions?: Array<{ id: string; endpoint: string; keys: string }>;
  };
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Invalid JSON." };
  }

  const payload = body.payload;
  const subscriptions = body.subscriptions ?? [];
  if (!payload || subscriptions.length === 0) {
    return { statusCode: 204, body: "" };
  }

  const notificationBody = JSON.stringify(payload);
  const deadIds: string[] = [];

  for (const sub of subscriptions) {
    let keys: { p256dh: string; auth: string };
    try {
      keys = JSON.parse(sub.keys) as { p256dh: string; auth: string };
    } catch {
      deadIds.push(sub.id);
      continue;
    }

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys },
        notificationBody
      );
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        deadIds.push(sub.id);
      } else {
        console.error(`[push] failed for ${sub.endpoint}`, err);
      }
    }
  }

  if (deadIds.length > 0 && process.env.DATABASE_URL) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await client.connect();
      await client.query(
        `DELETE FROM "PushSubscription" WHERE id = ANY($1::text[])`,
        [deadIds]
      );
    } catch (err) {
      console.error("[push] failed to prune dead subscriptions", err);
    } finally {
      await client.end().catch(() => {});
    }
  }

  return { statusCode: 200, body: JSON.stringify({ sent: subscriptions.length }) };
};
