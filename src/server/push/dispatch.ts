import "server-only";
import { siteUrl, internalFunctionSecret } from "@/lib/netlify/site-url";
import { sendPushToUser, type PushPayload } from "./push-service";

interface StoredSub {
  id: string;
  endpoint: string;
  keys: string;
}

/**
 * On Netlify, fire the background function so the upload response is not
 * blocked by web-push round-trips. Locally, send inline.
 */
export async function dispatchPushToUsers(params: {
  userIds: string[];
  payload: PushPayload;
  subscriptions: StoredSub[];
}): Promise<void> {
  const secret = internalFunctionSecret();
  const onNetlify = Boolean(process.env.NETLIFY || process.env.URL);

  if (onNetlify && secret) {
    const url = `${siteUrl()}/.netlify/functions/send-push-background`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        payload: params.payload,
        subscriptions: params.subscriptions,
      }),
    });
    if (!res.ok) {
      console.error("[push] background dispatch failed", res.status);
    }
    return;
  }

  await Promise.all(
    params.userIds.map((id) =>
      sendPushToUser(id, params.payload).catch((err) => {
        console.error(`[push] failed for user ${id}`, err);
      })
    )
  );
}
