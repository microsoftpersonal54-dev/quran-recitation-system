import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import RecordingsByDay, {
  FatherEntry,
} from "@/components/father/RecordingsByDay";

export const dynamic = "force-dynamic";

export default async function FatherRecordingsPage() {
  await requireRole(["FATHER"]);

  const rows = await db.recording.findMany({
    where: { deletedAt: null },
    orderBy: { recordedAt: "desc" },
    select: {
      id: true,
      surahName: true,
      surahNumber: true,
      ayahFrom: true,
      ayahTo: true,
      paraFrom: true,
      paraTo: true,
      paraQuarter: true,
      durationMs: true,
      recordedAt: true,
      notes: true,
      reviewStatus: true,
      student: { select: { name: true } },
      qari: { select: { name: true } },
      _count: { select: { mistakes: true } },
    },
  });

  const entries: FatherEntry[] = rows.map((r) => ({
    id: r.id,
    studentName: r.student.name,
    qariName: r.qari?.name ?? null,
    surahName: r.surahName,
    surahNumber: r.surahNumber,
    ayahFrom: r.ayahFrom,
    ayahTo: r.ayahTo,
    paraFrom: r.paraFrom,
    paraTo: r.paraTo,
    paraQuarter: r.paraQuarter,
    durationMs: r.durationMs,
    recordedAt: r.recordedAt.toISOString(),
    notes: r.notes,
    reviewStatus: r.reviewStatus,
    mistakeCount: r._count.mistakes,
  }));

  return (
    <div>
      <header className="mb-5">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          All recordings
        </p>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">
          Every session, organized by day
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          {entries.length === 0
            ? "Recordings will appear here."
            : `${entries.length} recording${
                entries.length === 1 ? "" : "s"
              } — tap a day to expand.`}
        </p>
      </header>

      <RecordingsByDay
        entries={entries}
        recordingBasePath="/father/recordings"
      />
    </div>
  );
}