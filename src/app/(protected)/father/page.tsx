import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { formatMs } from "@/lib/format";
import LogoutButton from "@/components/LogoutButton";
import {
  getPeriodStats,
  getOverallStats,
  getRecentRecordings,
  startOfToday,
  startOfWeek,
  startOfMonth,
} from "@/server/analytics/summary";

export const dynamic = "force-dynamic";

export default async function FatherDashboard() {
  const user = await requireRole(["FATHER"]);

  const [today, week, month, overall, recent] = await Promise.all([
    getPeriodStats(startOfToday()),
    getPeriodStats(startOfWeek()),
    getPeriodStats(startOfMonth()),
    getOverallStats(),
    getRecentRecordings(5),
  ]);

  const hasAny = overall.totalRecordings > 0;

  return (
    <div>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          Dashboard
        </p>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">
          Assalamu alaikum, {user.name}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          {hasAny
            ? `${overall.totalRecordings} recitation${
                overall.totalRecordings === 1 ? "" : "s"
              } recorded so far · ${formatMs(overall.totalMs)} total`
            : "Your family's recitations will appear here."}
        </p>
      </header>

      {!hasAny ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-10 text-center">
          <p className="text-sm font-medium text-neutral-700">
            No recitations recorded yet.
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Once the student records a recitation, it will appear here.
          </p>
        </div>
      ) : (
        <>
          <PeriodCard
            title="Today"
            stats={[
              { label: "Recordings", value: String(today.recordings) },
              { label: "Recitation", value: formatMs(today.totalMs) },
              { label: "Mistakes", value: String(today.mistakes) },
            ]}
          />

          <PeriodCard
            title="This week"
            stats={[
              { label: "Recordings", value: String(week.recordings) },
              { label: "Recitation", value: formatMs(week.totalMs) },
              { label: "Days practiced", value: String(week.daysPracticed) },
            ]}
          />

          <PeriodCard
            title="This month"
            stats={[
              { label: "Recordings", value: String(month.recordings) },
              { label: "Recitation", value: formatMs(month.totalMs) },
              { label: "Mistakes", value: String(month.mistakes) },
            ]}
          />

          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-800">
                Recent recordings
              </h2>
              <Link
                href="/father/recordings"
                className="text-xs font-medium text-neutral-600 hover:text-neutral-900"
              >
                View all
              </Link>
            </div>

            {recent.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-sm text-neutral-500">
                No recent recordings.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {recent.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/father/recordings/${r.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 hover:border-neutral-300"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-neutral-900">
                          {r.surahName}{" "}
                          <span className="font-normal text-neutral-500">
                            — Ayahs {r.ayahFrom}–{r.ayahTo}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs text-neutral-500">
                          {r.studentName} · {formatMs(r.durationMs)}
                          {r.mistakeCount > 0 && (
                            <>
                              {" · "}
                              <span className="text-amber-700">
                                {r.mistakeCount} mistake
                                {r.mistakeCount === 1 ? "" : "s"}
                              </span>
                            </>
                          )}
                        </span>
                      </span>
                      <span className="ml-3 shrink-0 text-[11px] text-neutral-400">
                        {relativeDay(r.recordedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Overall
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-neutral-500">Total time</dt>
              <dd className="text-right font-mono font-medium text-neutral-900">
                {formatMs(overall.totalMs)}
              </dd>
              <dt className="text-neutral-500">Surahs practiced</dt>
              <dd className="text-right font-medium text-neutral-900">
                {overall.surahsPracticed}
              </dd>
              <dt className="text-neutral-500">Ayahs covered</dt>
              <dd className="text-right font-medium text-neutral-900">
                {overall.ayahsCovered}
              </dd>
              <dt className="text-neutral-500">Current streak</dt>
              <dd className="text-right font-medium text-neutral-900">
                {overall.currentStreak}{" "}
                {overall.currentStreak === 1 ? "day" : "days"}
              </dd>
              <dt className="text-neutral-500">Longest streak</dt>
              <dd className="text-right font-medium text-neutral-900">
                {overall.longestStreak}{" "}
                {overall.longestStreak === 1 ? "day" : "days"}
              </dd>
            </dl>
          </section>
        </>
      )}

            <div className="mt-10 flex items-center gap-3">
        <LogoutButton />
        <Link
          href="/father/settings"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-800 hover:bg-neutral-50"
        >
          Settings
        </Link>
      </div>
    </div>
  );
}

function PeriodCard({
  title,
  stats,
}: {
  title: string;
  stats: { label: string; value: string }[];
}) {
  return (
    <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </h2>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="font-mono text-lg font-semibold text-neutral-900">
              {s.value}
            </div>
            <div className="mt-0.5 text-[11px] text-neutral-500">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function relativeDay(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round(
    (today.getTime() - dd.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}