import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { listNotificationsForUser } from "@/server/notifications/service";
import MarkReadOnVisit from "@/components/father/MarkReadOnVisit";

export const dynamic = "force-dynamic";

export default async function QariNotificationsPage() {
  const user = await requireRole(["QARI"]);
  const items = await listNotificationsForUser(user.id);

  return (
    <div>
      <MarkReadOnVisit />

      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          Notifications
        </p>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">
          Review queue updates
        </h1>
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-10 text-center">
          <p className="text-sm font-medium text-neutral-700">
            No notifications yet.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const unread = !n.readAt;
            const date = new Date(n.createdAt);
            return (
              <li
                key={n.id}
                className={`rounded-xl border bg-white p-4 ${
                  unread ? "border-blue-200" : "border-neutral-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  {unread && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                  )}
                  <p className="text-sm font-semibold text-neutral-900">
                    {n.title}
                  </p>
                </div>
                <p className="mt-1 text-sm text-neutral-700">{n.body}</p>
                <p className="mt-1 text-[11px] text-neutral-500">
                  {date.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  ·{" "}
                  {date.toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {n.recordingId && (
                  <div className="mt-3">
                    <Link
                      href={`/qari/recordings/${n.recordingId}`}
                      className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Open recording
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}