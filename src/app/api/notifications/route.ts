import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  listNotificationsForUser,
  getUnreadCount,
  markAllRead,
} from "@/server/notifications/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const [items, unread] = await Promise.all([
    listNotificationsForUser(user.id),
    getUnreadCount(user.id),
  ]);
  return NextResponse.json({ items, unread });
}

export async function PATCH(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  await markAllRead(user.id);
  return NextResponse.json({ ok: true });
}