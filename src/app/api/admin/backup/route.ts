import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createBackupPayload } from "@/server/backups/service";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.role !== "FATHER") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const payload = await createBackupPayload();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  await audit({
    userId: user.id,
    action: "backup.downloaded",
    metadata: { exportedAt: payload.exportedAt, counts: payload.counts },
  });

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="quran-backup-${stamp}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST() {
  // Alias for GET — clicking "Create backup now" triggers a download.
  return GET();
}