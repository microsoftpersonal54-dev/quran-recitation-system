import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { updateMistakeSchema } from "@/lib/validation/mistakes";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.role !== "FATHER" && user.role !== "QARI") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await db.mistake.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = updateMistakeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await db.mistake.update({
    where: { id },
    data: {
      ...(parsed.data.timestampMs !== undefined && {
        timestampMs: parsed.data.timestampMs,
      }),
      ...(parsed.data.ayahNumber !== undefined && {
        ayahNumber: parsed.data.ayahNumber,
      }),
      ...(parsed.data.category !== undefined && {
        category: parsed.data.category,
      }),
      ...(parsed.data.severity !== undefined && {
        severity: parsed.data.severity,
      }),
      ...(parsed.data.description !== undefined && {
        description: parsed.data.description,
      }),
      ...(parsed.data.correction !== undefined && {
        correction: parsed.data.correction || null,
      }),
    },
    include: { reviewer: { select: { id: true, name: true } } },
  });

  await audit({
    userId: user.id,
    action: "mistake.updated",
    target: id,
  });

  return NextResponse.json({ mistake: updated });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.role !== "FATHER" && user.role !== "QARI") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await db.mistake.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await db.mistake.delete({ where: { id } });

  await audit({
    userId: user.id,
    action: "mistake.deleted",
    target: id,
  });

  return NextResponse.json({ ok: true });
}