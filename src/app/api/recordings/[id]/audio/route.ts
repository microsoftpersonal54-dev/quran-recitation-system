import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getRecordingById } from "@/server/recordings/service";

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
  const rec = await getRecordingById(id);
  if (!rec) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (user.role === "STUDENT" && rec.studentId !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // `filePath` now holds the full Cloudinary HTTPS URL.
  // Redirect the browser there.
  return NextResponse.redirect(rec.filePath);
}