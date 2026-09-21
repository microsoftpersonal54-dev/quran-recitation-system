import { NextRequest, NextResponse } from "next/server";
import { destroyCurrentSession, getCurrentUser } from "@/lib/auth/session";
import { audit } from "@/server/audit";

export const runtime = "nodejs";

function isHttpsRequest(req: NextRequest): boolean {
  if (req.nextUrl.protocol === "https:") return true;
  return req.headers.get("x-forwarded-proto") === "https";
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const secure = isHttpsRequest(req);

  const response = NextResponse.json({ ok: true });
  await destroyCurrentSession(response, secure);

  if (user) {
    await audit({ userId: user.id, action: "auth.logout" });
  }

  return response;
}