import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { formatMs } from "@/lib/format";
import { db } from "@/lib/db";
import MistakeWorkspace from "./MistakeWorkspace";

interface Props {
  id: string;
  backHref: string;
  backLabel: string;
  canEdit: boolean;
}

export default async function RecordingDetail({
  id,
  backHref,
  backLabel,
  canEdit,
}: Props) {
  const rec = await db.recording.findFirst({
    where: { id, deletedAt: null },
    include: {
      student: { select: { id: true, name: true } },
      mistakes: {
        orderBy: { timestampMs: "asc" },
        include: { reviewer: { select: { id: true, name: true } } },
      },
    },
  });

  if (!rec) notFound();

  const date = new Date(rec.recordedAt);

  const mistakes = rec.mistakes.map((m) => ({
    id: m.id,
    timestampMs: m.timestampMs,
    ayahNumber: m.ayahNumber,
    category: m.category,
    severity: m.severity,
    description: m.description,
    correction: m.correction,
    reviewer: { id: m.reviewer.id, name: m.reviewer.name },
  }));

  return (
    <div>
            <div className="flex items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-xs font-medium text-neutral-600 hover:text-neutral-900"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {backLabel}
        </Link>
        <a
          href={`/api/recordings/${id}/export.txt`}
          download
          className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Download TXT
        </a>
      </div>

      <header className="mt-3 mb-5">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          Recording
        </p>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">
          {rec.surahName}{" "}
          <span className="font-normal text-neutral-500">
            — Ayahs {rec.ayahFrom}–{rec.ayahTo}
          </span>
        </h1>
        <p className="mt-1 text-sm text-neutral-600">{rec.student.name}</p>
      </header>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-neutral-500">Date</dt>
          <dd className="text-right text-neutral-900">
            {date.toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </dd>
          <dt className="text-neutral-500">Time</dt>
          <dd className="text-right text-neutral-900">
            {date.toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </dd>
          <dt className="text-neutral-500">Duration</dt>
          <dd className="text-right font-mono text-neutral-900">
            {formatMs(rec.durationMs)}
          </dd>
          <dt className="text-neutral-500">Review</dt>
          <dd className="text-right">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                rec.reviewStatus === "REVIEWED"
                  ? "bg-emerald-100 text-emerald-900"
                  : rec.reviewStatus === "IN_REVIEW"
                  ? "bg-amber-100 text-amber-900"
                  : "bg-neutral-100 text-neutral-700"
              }`}
            >
              {rec.reviewStatus.replace("_", " ")}
            </span>
          </dd>
        </dl>

        {rec.notes && (
          <div className="mt-4 border-t border-neutral-100 pt-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Student notes
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">
              {rec.notes}
            </p>
          </div>
        )}
      </section>

      <div className="mt-4">
        <MistakeWorkspace
          recordingId={rec.id}
          durationMs={rec.durationMs}
          audioUrl={`/api/recordings/${rec.id}/audio`}
          initialMistakes={mistakes}
          ayahFrom={rec.ayahFrom}
          ayahTo={rec.ayahTo}
          reviewStatus={rec.reviewStatus}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}