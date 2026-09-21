import { formatMs } from "@/lib/format";
import BarChart from "@/components/charts/BarChart";
import StatTile from "@/components/progress/StatTile";
import {
  getOverallStats,
  getPeriodStats,
  startOfWeek,
  startOfMonth,
} from "@/server/analytics/summary";
import {
  getDailyActivity,
  getWeeklyActivity,
  getMonthlyActivity,
  getTopSurahs,
} from "@/server/analytics/activity";

interface Props {
  studentId?: string;
  title: string;
  subtitle?: string;
}

export default async function ProgressView({
  studentId,
  title,
  subtitle,
}: Props) {
  const [overall, week, month, daily, weekly, monthly, topSurahs] =
    await Promise.all([
      getOverallStats(studentId),
      getPeriodStats(startOfWeek(), studentId),
      getPeriodStats(startOfMonth(), studentId),
      getDailyActivity(studentId, 30),
      getWeeklyActivity(studentId, 12),
      getMonthlyActivity(studentId, 12),
      getTopSurahs(studentId, 6),
    ]);

  const hasAny = overall.totalRecordings > 0;

  if (!hasAny) {
    return (
      <div>
        <header className="mb-6">
          <p className="text-xs uppercase tracking-widest text-neutral-500">
            Progress
          </p>
          <h1 className="mt-1 text-xl font-semibold text-neutral-900">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>
          )}
        </header>
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-10 text-center">
          <p className="text-sm font-medium text-neutral-700">No data yet.</p>
          <p className="mt-1 text-xs text-neutral-500">
            Stats will appear here once a recitation has been uploaded.
          </p>
        </div>
      </div>
    );
  }

  const dailyPoints = daily.map((d) => ({
    label: d.label,
    value: d.recordings,
    tooltip: `${d.label}: ${d.recordings} recording${
      d.recordings === 1 ? "" : "s"
    }, ${formatMs(d.totalMs)}`,
  }));
  const weeklyPoints = weekly.map((d) => ({
    label: d.label,
    value: d.recordings,
    tooltip: `Week of ${d.label}: ${d.recordings} recording${
      d.recordings === 1 ? "" : "s"
    }, ${formatMs(d.totalMs)}`,
  }));
  const monthlyPoints = monthly.map((d) => ({
    label: d.label,
    value: d.recordings,
    tooltip: `${d.label}: ${d.recordings} recording${
      d.recordings === 1 ? "" : "s"
    }, ${formatMs(d.totalMs)}`,
  }));

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          Progress
        </p>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>
        )}
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Total recordings"
          value={String(overall.totalRecordings)}
        />
        <StatTile label="Total recitation" value={formatMs(overall.totalMs)} />
        <StatTile
          label="Total mistakes"
          value={String(overall.totalMistakes)}
        />
        <StatTile
          label="Avg duration"
          value={formatMs(overall.averageDurationMs)}
          hint={`${overall.averageMistakesPerRecording.toFixed(1)} mistakes avg`}
        />
        <StatTile
          label="Practice days"
          value={String(overall.practiceDays)}
        />
        <StatTile
          label="Current streak"
          value={`${overall.currentStreak} ${
            overall.currentStreak === 1 ? "day" : "days"
          }`}
        />
        <StatTile
          label="Longest streak"
          value={`${overall.longestStreak} ${
            overall.longestStreak === 1 ? "day" : "days"
          }`}
        />
        <StatTile
          label="Surahs practiced"
          value={String(overall.surahsPracticed)}
        />
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Last 30 days
          </h2>
          <span className="text-[11px] text-neutral-500">
            recordings per day
          </span>
        </div>
        <div className="mt-3">
          <BarChart data={dailyPoints} />
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Last 12 weeks
          </h2>
          <span className="text-[11px] text-neutral-500">
            recordings per week
          </span>
        </div>
        <div className="mt-3">
          <BarChart data={weeklyPoints} />
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Last 12 months
          </h2>
          <span className="text-[11px] text-neutral-500">
            recordings per month
          </span>
        </div>
        <div className="mt-3">
          <BarChart data={monthlyPoints} />
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Period totals
        </h2>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-neutral-500">This week</dt>
            <dd className="text-right text-neutral-900">
              {week.recordings} recording{week.recordings === 1 ? "" : "s"} ·{" "}
              {formatMs(week.totalMs)} · {week.mistakes} mistake
              {week.mistakes === 1 ? "" : "s"}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-neutral-500">This month</dt>
            <dd className="text-right text-neutral-900">
              {month.recordings} recording{month.recordings === 1 ? "" : "s"} ·{" "}
              {formatMs(month.totalMs)} · {month.mistakes} mistake
              {month.mistakes === 1 ? "" : "s"}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-neutral-500">Ayahs covered</dt>
            <dd className="text-right text-neutral-900">
              {overall.ayahsCovered}
            </dd>
          </div>
        </dl>
      </section>

      {topSurahs.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Most practiced surahs
          </h2>
          <ul className="mt-2 divide-y divide-neutral-100">
            {topSurahs.map((s) => (
              <li
                key={s.surahNumber}
                className="flex items-center justify-between py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {s.surahName}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {s.recordings} recording
                    {s.recordings === 1 ? "" : "s"}
                    {s.mistakes > 0 &&
                      ` · ${s.mistakes} mistake${
                        s.mistakes === 1 ? "" : "s"
                      }`}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm text-neutral-700">
                  {formatMs(s.totalMs)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}