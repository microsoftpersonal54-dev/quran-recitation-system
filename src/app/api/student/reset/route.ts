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
 * Resets the logged-in STUDENT's own data only:
 * - Deletes all their recordings (and Cloudinary files)
 * - Deletes their attendance records
 * - Deletes their notifications
 * - Mistake rows cascade from recordings
 *
 * Does NOT delete: the account itself, sessions, or audit logs.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.role !== "STUDENT") {
    return NextResponse.json(
      { error: "Only a student can reset their own data." },
      { status: 403 }
    );
  }

  const recordings = await db.recording.findMany({
    where: { studentId: user.id },
    select: { id: true, fileName: true },
  });

  // Best-effort Cloudinary cleanup.
  for (const r of recordings) {
    if (r.fileName) {
      try {
        await cloudinary.uploader.destroy(r.fileName, {
          resource_type: "video",
        });
      } catch (err) {
        console.warn("[student/reset] Cloudinary delete failed", r.id, err);
      }
    }
  }

  // DB cleanup (mistakes cascade via schema).
  const deletedRecordings = await db.recording.deleteMany({
    where: { studentId: user.id },
  });

  const deletedAttendance = await db.attendance.deleteMany({
    where: { studentId: user.id },
  });

  const deletedNotifications = await db.notification.deleteMany({
    where: { recipientId: user.id },
  });

  await audit({
    userId: user.id,
    action: "student.reset_all",
    metadata: {
      deletedRecordings: deletedRecordings.count,
      deletedAttendance: deletedAttendance.count,
      deletedNotifications: deletedNotifications.count,
    },
  });

  return NextResponse.json({
    ok: true,
    deleted: {
      recordings: deletedRecordings.count,
      attendance: deletedAttendance.count,
      notifications: deletedNotifications.count,
    },
  });
}