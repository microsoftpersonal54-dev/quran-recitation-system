import "server-only";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import type { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "qrs_session";
const SESSION_DURATION_DAYS = 30;

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Builds a raw Set-Cookie header value.
 * Using a raw string is more reliable than NextResponse.cookies.set()
 * in Next.js 15/16 route handlers.
 */
function buildSetCookie(
  name: string,
  value: string,
  expiresAt: Date,
  secure: boolean
): string {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    `Expires=${expiresAt.toUTCString()}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function buildClearCookie(name: string, secure: boolean): string {
  const parts = [
    `${name}=`,
    "Path=/",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Creates a session and stores it.
 *
 * When called from a Route Handler:
 *   - pass the NextResponse (2nd arg)
 *   - pass isSecure = true if the request came over HTTPS
 */
export async function createSession(
  userId: string,
  res?: NextResponse,
  isSecure = false
): Promise<void> {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  );

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;
  const ua = h.get("user-agent") ?? null;

  await db.session.create({
    data: { userId, tokenHash, expiresAt, ipAddress: ip, userAgent: ua },
  });

  if (res) {
    res.headers.append(
      "Set-Cookie",
      buildSetCookie(SESSION_COOKIE, rawToken, expiresAt, isSecure)
    );
  } else {
    const store = await cookies();
    store.set(SESSION_COOKIE, rawToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const tokenHash = sha256(raw);

  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  if (!session.user.active) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}

export async function destroyCurrentSession(
  res?: NextResponse,
  isSecure = false
): Promise<void> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (raw) {
    const tokenHash = sha256(raw);
    await db.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  if (res) {
    res.headers.append("Set-Cookie", buildClearCookie(SESSION_COOKIE, isSecure));
  } else {
    store.delete(SESSION_COOKIE);
  }
}

export function homeForRole(role: string): string {
  switch (role) {
    case "STUDENT":
      return "/student";
    case "FATHER":
      return "/father";
    case "QARI":
      return "/qari";
    default:
      return "/login";
  }
}