import Link from "next/link";
import { Mic } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import LogoutButton from "@/components/LogoutButton";
import RecordingListItem from "@/components/student/RecordingListItem";
import PendingUploads from "@/components/student/PendingUploads";
import { listRecordingsForStudent } from "@/server/recordings/service";

export const dynamic = "force-dynamic";

export default async function StudentHome() {
  const user = await requireRole(["STUDENT"]);
  const items = await listRecordingsForStudent(user.id);

  return (
    <div>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          Student
        </p>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">
          Assalamu alaikum, {user.name}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Record your recitation and it will be reviewed by your teacher.
        </p>
      </header>

      <Link
        href="/student/record"
        className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-5 hover:border-neutral-300"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white">
          <Mic className="h-6 w-6" aria-hidden />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-neutral-900">
            Record a new recitation
          </span>
          <span className="mt-0.5 block text-xs text-neutral-500">
            Choose a surah, recite, and save.
          </span>
        </span>
      </Link>

      <PendingUploads />

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-neutral-800">
          Your recordings
          {items.length > 0 && (
            <span className="ml-2 text-xs font-normal text-neutral-500">
              ({items.length})
            </span>
          )}
        </h2>

        {items.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-sm text-neutral-500">
            No recitations recorded yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {items.map((item) => (
              <RecordingListItem
                key={item.id}
                item={{
                  id: item.id,
                  surahNumber: item.surahNumber,
                  surahName: item.surahName,
                  ayahFrom: item.ayahFrom,
                  ayahTo: item.ayahTo,
                  paraFrom: item.paraFrom,
                  paraTo: item.paraTo,
                  paraQuarter: item.paraQuarter,
                  durationMs: item.durationMs,
                  recordedAt: item.recordedAt.toISOString(),
                  uploadStatus: item.uploadStatus,
                  reviewStatus: item.reviewStatus,
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10">
        <LogoutButton />
      </div>
    </div>
  );
}