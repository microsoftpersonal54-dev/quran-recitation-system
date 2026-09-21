import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/validation/auth";
import { audit } from "@/server/audit";
import { createSession, homeForRole } from "@/lib/auth/session";
import { checkLimit, resetLimit } from "@/server/security/rate-limit";

export const runtime = "nodejs";

function isHttpsRequest(req: NextRequest): boolean {
  if (req.nextUrl.protocol === "https:") return true;
  const proto = req.headers.get("x-forwarded-proto");
  return proto === "https";
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 400 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const { email, password } = parsed.data;
  const emailLower = email.toLowerCase();

  const ipLimit = checkLimit({
    key: `login:ip:${ip}`,
    max: 10,
    windowMs: 5 * 60 * 1000,
    cooldownMs: 15 * 60 * 1000,
  });
  const emailLimit = checkLimit({
    key: `login:email:${emailLower}`,
    max: 5,
    windowMs: 5 * 60 * 1000,
    cooldownMs: 15 * 60 * 1000,
  });

  if (!ipLimit.allowed || !emailLimit.allowed) {
    const wait = Math.max(ipLimit.retryAfterSec, emailLimit.retryAfterSec);
    return NextResponse.json(
      {
        error: `Too many attempts. Try again in ${Math.ceil(
          wait / 60
        )} minute(s).`,
      },
      { status: 429, headers: { "Retry-After": String(wait) } }
    );
  }

  const user = await db.user.findUnique({
    where: { email: emailLower },
  });

  const dummyHash =
    "$2a$12$abcdefghijklmnopqrstuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu";
  const ok = await verifyPassword(password, user?.passwordHash ?? dummyHash);

  if (!user || !ok || !user.active) {
    await audit({
      action: "auth.login_failed",
      target: emailLower,
      ipAddress: ip,
    });
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  resetLimit(`login:email:${emailLower}`);
  const secure = isHttpsRequest(req);

  const response = NextResponse.json({
    ok: true,
    redirect: homeForRole(user.role),
  });

  await createSession(user.id, response, secure);

  console.log("[login] Success:", {
    email: emailLower,
    role: user.role,
    secure,
    protocol: req.nextUrl.protocol,
    xfp: req.headers.get("x-forwarded-proto"),
    setCookieHeader: response.headers.get("set-cookie")?.slice(0, 120),
    userAgent: req.headers.get("user-agent")?.slice(0, 80),
  });

  await audit({
    userId: user.id,
    action: "auth.login_success",
    ipAddress: ip,
  });

  return response;
}