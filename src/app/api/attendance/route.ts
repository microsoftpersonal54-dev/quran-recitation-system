import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getAttendanceForRange,
  upsertAttendance,
  deleteAttendance,
} from "@/server/attendance/service";
import { audit } from "@/server/audit";
import { db } from "@/lib/db";
import { createNotification } from "@/server/notifications/service";
import { sendPushToUser } from "@/server/push/push-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const postSchema = z.object({
  studentId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["PRESENT", "LEAVE", "ABSENT"]),
  reason: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const studentIdParam = url.searchParams.get("studentId");

  if (!fromStr || !toStr) {
    return NextResponse.json(
      { error: "Missing 'from' or 'to'." },
      { status: 400 }
    );
  }

  const studentId =
    user.role === "STUDENT" ? user.id : studentIdParam ?? user.id;

  const from = new Date(fromStr + "T00:00:00.000Z");
  const to = new Date(toStr + "T23:59:59.999Z");

  const items = await getAttendanceForRange(studentId, from, to);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let studentId: string;
  if (user.role === "STUDENT") {
    studentId = user.id;
    if (parsed.data.status !== "LEAVE") {
      return NextResponse.json(
        { error: "Students can only mark themselves on leave." },
        { status: 403 }
      );
    }
  } else if (user.role === "FATHER" || user.role === "QARI") {
    if (!parsed.data.studentId) {
      return NextResponse.json(
        { error: "Missing studentId." },
        { status: 400 }
      );
    }
    studentId = parsed.data.studentId;
  } else {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const date = new Date(parsed.data.date + "T12:00:00.000Z");

  const row = await upsertAttendance({
    studentId,
    date,
    status: parsed.data.status,
    reason: parsed.data.reason ?? null,
    notes: parsed.data.notes ?? null,
    markedById: user.id,
  });

  await audit({
    userId: user.id,
    action: "attendance.upsert",
    target: row.id,
    metadata: {
      studentId,
      date: parsed.data.date,
      status: parsed.data.status,
    },
  });

  // If a student marked themselves on leave, notify Father + Qari.
  if (user.role === "STUDENT" && parsed.data.status === "LEAVE") {
    const dateLabel = new Date(parsed.data.date + "T12:00:00").toLocaleDateString(
      undefined,
      { weekday: "long", month: "long", day: "numeric" }
    );
    const reasonLabel = parsed.data.reason
      ? ` · ${parsed.data.reason}`
      : "";

    const recipients = await db.user.findMany({
      where: { active: true, role: { in: ["FATHER", "QARI"] } },
      select: { id: true },
    });

    const title = "Leave Marked";
    const bodyText = `${user.name} marked leave · ${dateLabel}${reasonLabel}`;

    await Promise.all(
      recipients.map((r) =>
        createNotification({
          recipientId: r.id,
          type: "LEAVE_MARKED",
          title,
          body: bodyText,
        })
      )
    );

    Promise.all(
      recipients.map((r) =>
        sendPushToUser(r.id, {
          title,
          body: bodyText,
          url: "/father/attendance",
        }).catch((err) => {
          console.error(`[push] leave for user ${r.id}`, err);
        })
      )
    ).catch(() => {});
  }

  return NextResponse.json({ attendance: row });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.role !== "FATHER" && user.role !== "QARI") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const studentId = url.searchParams.get("studentId");
  if (!date || !studentId) {
    return NextResponse.json(
      { error: "Missing 'date' or 'studentId'." },
      { status: 400 }
    );
  }

  await deleteAttendance(studentId, new Date(date + "T12:00:00.000Z"));
  return NextResponse.json({ ok: true });
}