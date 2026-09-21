import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { z } from "zod";

export const runtime = "nodejs";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = subscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
    }

    const sub = parsed.data;
    await db.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      update: { keys: JSON.stringify(sub.keys) },
      create: {
        userId: user.id,
        endpoint: sub.endpoint,
        keys: JSON.stringify(sub.keys),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push/subscribe] failed", err);
    return NextResponse.json({ error: "Failed to save subscription." }, { status: 500 });
  }
}