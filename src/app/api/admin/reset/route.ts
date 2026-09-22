import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { audit } from "@/server/audit";
import { v2 as cloudinary } from "cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * FATHER-ONLY: wipes ALL recordings, mistakes, attendance, notifications,
 * and audit logs. Keeps user accounts and sessions intact.
 *
 * Body must be: { confirm: "RESET-ALL" }
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.role !== "FATHER") {
    return NextResponse.json(
      { error: "Only the father can reset the entire database." },
      { status: 403 }
    );
  }

  let body: { confirm?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (body.confirm !== "RESET-ALL") {
    return NextResponse.json(
      { error: "Confirmation phrase mismatch." },
      { status: 400 }
    );
  }

  // Collect Cloudinary IDs first.
  const recordings = await db.recording.findMany({
    select: { id: true, fileName: true },
  });

  for (const r of recordings) {
    if (r.fileName) {
      try {
        await cloudinary.uploader.destroy(r.fileName, {
          resource_type: "video",
        });
      } catch (err) {
        console.warn("[admin/reset] Cloudinary delete failed", r.id, err);
      }
    }
  }

  const [deletedRecordings, deletedMistakes, deletedAttendance, deletedNotifications, deletedAudit] =
    await Promise.all([
      db.recording.deleteMany({}),
      db.mistake.deleteMany({}),
      db.attendance.deleteMany({}),
      db.notification.deleteMany({}),
      db.auditLog.deleteMany({}),
    ]);

  await audit({
    userId: user.id,
    action: "admin.reset_all",
    metadata: {
      deletedRecordings: deletedRecordings.count,
      deletedMistakes: deletedMistakes.count,
      deletedAttendance: deletedAttendance.count,
      deletedNotifications: deletedNotifications.count,
      deletedAuditLogs: deletedAudit.count,
    },
  });

  return NextResponse.json({
    ok: true,
    deleted: {
      recordings: deletedRecordings.count,
      mistakes: deletedMistakes.count,
      attendance: deletedAttendance.count,
      notifications: deletedNotifications.count,
      auditLogs: deletedAudit.count,
    },
  });
}