import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { recordingToTxt } from "@/server/export/recording-txt";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await ctx.params;

  const rec = await db.recording.findFirst({
    where: { id, deletedAt: null },
    select: { studentId: true, surahName: true, recordedAt: true },
  });
  if (!rec) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (user.role === "STUDENT" && rec.studentId !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const txt = await recordingToTxt(id);
  if (!txt) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const date = new Date(rec.recordedAt);
  const filename = `${rec.surahName.replace(/[^a-z0-9]+/gi, "-")}_${date
    .toISOString()
    .slice(0, 10)}.txt`;

  return new NextResponse(txt, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}