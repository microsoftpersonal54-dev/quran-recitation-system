import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { setupSchema } from "@/lib/validation/auth";
import { audit } from "@/server/audit";
import { createSession, homeForRole } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const existing = await db.user.count();
  if (existing > 0) {
    return NextResponse.json(
      { error: "Setup has already been completed." },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { appName, father, student, qari } = parsed.data;

  const [fatherHash, studentHash, qariHash] = await Promise.all([
    hashPassword(father.password),
    hashPassword(student.password),
    qari ? hashPassword(qari.password) : Promise.resolve(null),
  ]);

  try {
    const result = await db.$transaction(async (tx) => {
      const fatherUser = await tx.user.create({
        data: {
          email: father.email.toLowerCase(),
          name: father.name,
          passwordHash: fatherHash,
          role: "FATHER",
        },
      });

      const studentUser = await tx.user.create({
        data: {
          email: student.email.toLowerCase(),
          name: student.name,
          passwordHash: studentHash,
          role: "STUDENT",
        },
      });

      if (qari && qariHash) {
        await tx.user.create({
          data: {
            email: qari.email.toLowerCase(),
            name: qari.name,
            passwordHash: qariHash,
            role: "QARI",
          },
        });
      }

      if (appName) {
        await tx.appSetting.upsert({
          where: { key: "app_name" },
          update: { value: appName },
          create: { key: "app_name", value: appName },
        });
      }
      await tx.appSetting.upsert({
        where: { key: "setup_completed_at" },
        update: { value: new Date().toISOString() },
        create: { key: "setup_completed_at", value: new Date().toISOString() },
      });

      return { fatherUser, studentUser };
    });

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    await audit({
      userId: result.fatherUser.id,
      action: "setup.completed",
      metadata: {
        father: father.email,
        student: student.email,
        qari: qari?.email ?? null,
      },
      ipAddress: ip,
    });

    await createSession(result.fatherUser.id);

    return NextResponse.json({
      ok: true,
      redirect: homeForRole("FATHER"),
    });
  } catch (err) {
    console.error("[setup] failed", err);
    return NextResponse.json(
      { error: "Could not create accounts. Please try again." },
      { status: 500 }
    );
  }
}