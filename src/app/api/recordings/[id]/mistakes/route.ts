import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { createMistakeSchema } from "@/lib/validation/mistakes";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureRecordingAccess(id: string, userId: string, role: string) {
  const rec = await db.recording.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, studentId: true },
  });
  if (!rec) return null;
  if (role === "STUDENT" && rec.studentId !== userId) return null;
  return rec;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const rec = await ensureRecordingAccess(id, user.id, user.role);
  if (!rec) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const mistakes = await db.mistake.findMany({
    where: { recordingId: id },
    orderBy: { timestampMs: "asc" },
    include: { reviewer: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ mistakes });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.role !== "FATHER" && user.role !== "QARI") {
    return NextResponse.json(
      { error: "Only Father or Qari can add mistakes." },
      { status: 403 }
    );
  }

  const { id } = await ctx.params;
  const rec = await db.recording.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, reviewStatus: true },
  });
  if (!rec) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = createMistakeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = await db.mistake.create({
    data: {
      recordingId: rec.id,
      reviewerId: user.id,
      timestampMs: parsed.data.timestampMs,
      ayahNumber: parsed.data.ayahNumber ?? null,
      category: parsed.data.category,
      severity: parsed.data.severity,
      description: parsed.data.description,
      correction: parsed.data.correction || null,
    },
    include: { reviewer: { select: { id: true, name: true } } },
  });

  // Auto-advance to IN_REVIEW once any mistake is added.
  if (rec.reviewStatus === "UNREVIEWED") {
    await db.recording.update({
      where: { id: rec.id },
      data: { reviewStatus: "IN_REVIEW" },
    });
  }

  await audit({
    userId: user.id,
    action: "mistake.created",
    target: created.id,
    metadata: {
      recordingId: rec.id,
      category: parsed.data.category,
      severity: parsed.data.severity,
      timestampMs: parsed.data.timestampMs,
    },
  });

  return NextResponse.json({ mistake: created }, { status: 201 });
}