import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import AttendanceCalendarClient from "@/components/father/AttendanceCalendarClient";

export const dynamic = "force-dynamic";

export default async function QariAttendancePage() {
  await requireRole(["QARI"]);

  const students = await db.user.findMany({
    where: { role: "STUDENT", active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <header className="mb-5">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          Attendance
        </p>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">
          Student calendar
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Tap a date to see attendance and every recitation session.
        </p>
      </header>
      {students.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-sm text-neutral-500">
          No students yet.
        </div>
      ) : (
        <AttendanceCalendarClient
          students={students}
          recordingBasePath="/qari/recordings"
        />
      )}
    </div>
  );
}