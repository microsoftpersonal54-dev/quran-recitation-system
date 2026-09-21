import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { markReviewedSchema } from "@/lib/validation/mistakes";
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
  const rec = await db.recording.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
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

  const parsed = markReviewedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  await db.recording.update({
    where: { id },
    data: { reviewStatus: parsed.data.reviewStatus },
  });

  await audit({
    userId: user.id,
    action: "recording.review_status_changed",
    target: id,
    metadata: { status: parsed.data.reviewStatus },
  });

  return NextResponse.json({ ok: true });
}