import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createBackup, listBackups } from "@/server/backups/service";
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
  const items = await listBackups();
  return NextResponse.json({ items });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.role !== "FATHER") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const result = await createBackup();
    await audit({
      userId: user.id,
      action: "backup.created",
      metadata: {
        sqliteFile: result.sqliteFile,
        jsonFile: result.jsonFile,
        sqliteBytes: result.sqliteBytes,
      },
    });
    return NextResponse.json(
      {
        backup: {
          timestamp: result.timestamp,
          sqliteFile: result.sqliteFile,
          jsonFile: result.jsonFile,
          sqliteBytes: result.sqliteBytes,
          jsonBytes: result.jsonBytes,
          recordings: result.recordings,
          mistakes: result.mistakes,
          users: result.users,
          notifications: result.notifications,
        },
        export: result.payload,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[backup] failed", err);
    return NextResponse.json(
      { error: "Could not create backup." },
      { status: 500 }
    );
  }
}