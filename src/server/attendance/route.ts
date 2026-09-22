import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getAttendanceForRange,
  upsertAttendance,
  deleteAttendance,
} from "@/server/attendance/service";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const postSchema = z.object({
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

  // Only a Student can mark their own leave. Father/Qari can mark anyone.
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
    // Father/Qari: allow arbitrary student — read studentId from body
    const maybeStudent = (body as { studentId?: string }).studentId;
    if (maybeStudent) {
      studentId = maybeStudent;
    } else {
      return NextResponse.json(
        { error: "Missing studentId." },
        { status: 400 }
      );
    }
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