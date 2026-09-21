import { requireRole } from "@/lib/auth/guards";
import BackupPanel from "@/components/settings/BackupPanel";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function FatherSettingsPage() {
  const user = await requireRole(["FATHER"]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          Settings
        </p>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">
          Backup &amp; maintenance
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Signed in as {user.name} · {user.email}
        </p>
      </header>

      <BackupPanel />

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Account
        </h2>
        <div className="mt-3">
          <LogoutButton />
        </div>
      </section>
    </div>
  );
}