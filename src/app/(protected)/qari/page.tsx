import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { formatMs } from "@/lib/format";
import LogoutButton from "@/components/LogoutButton";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function QariHome() {
  const user = await requireRole(["QARI"]);

  const rows = await db.recording.findMany({
    where: { deletedAt: null },
    orderBy: [{ reviewStatus: "asc" }, { recordedAt: "desc" }],
    take: 50,
    select: {
      id: true,
      surahName: true,
      ayahFrom: true,
      ayahTo: true,
      durationMs: true,
      recordedAt: true,
      reviewStatus: true,
      student: { select: { name: true } },
      _count: { select: { mistakes: true } },
    },
  });

  const unreviewed = rows.filter(
    (r) => r.reviewStatus === "UNREVIEWED"
  ).length;
  const inReview = rows.filter((r) => r.reviewStatus === "IN_REVIEW").length;

  return (
    <div>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          Review
        </p>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">
          Assalamu alaikum, {user.name}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          {rows.length === 0
            ? "No recordings to review yet."
            : `${unreviewed} unreviewed · ${inReview} in review`}
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-10 text-center">
          <p className="text-sm font-medium text-neutral-700">
            No recitations recorded yet.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const date = new Date(r.recordedAt);
            const badge =
              r.reviewStatus === "REVIEWED"
                ? "bg-emerald-100 text-emerald-900"
                : r.reviewStatus === "IN_REVIEW"
                ? "bg-amber-100 text-amber-900"
                : "bg-neutral-100 text-neutral-700";
            return (
              <li key={r.id}>
                <Link
                  href={`/qari/recordings/${r.id}`}
                  className="block rounded-xl border border-neutral-200 bg-white px-4 py-3 hover:border-neutral-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {r.surahName}{" "}
                        <span className="font-normal text-neutral-500">
                          — Ayahs {r.ayahFrom}–{r.ayahTo}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {r.student.name} · {formatMs(r.durationMs)} ·{" "}
                        {date.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badge}`}
                      >
                        {r.reviewStatus.replace("_", " ")}
                      </span>
                      {r._count.mistakes > 0 && (
                        <span className="text-[10px] font-medium text-amber-700">
                          {r._count.mistakes} mistake
                          {r._count.mistakes === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-10">
        <LogoutButton />
      </div>
    </div>
  );
}