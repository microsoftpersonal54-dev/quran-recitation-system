"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface UserFields {
  email: string;
  name: string;
  password: string;
}

const empty: UserFields = { email: "", name: "", password: "" };

export default function SetupForm() {
  const router = useRouter();
  const [appName, setAppName] = useState("Quran Recitation Record");
  const [father, setFather] = useState<UserFields>(empty);
  const [student, setStudent] = useState<UserFields>(empty);
  const [qari, setQari] = useState<UserFields>(empty);
  const [includeQari, setIncludeQari] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const payload = {
      appName,
      father,
      student,
      qari: includeQari ? qari : undefined,
    };

    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Setup failed.");
        setBusy(false);
        return;
      }
      router.push(data.redirect);
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <section className="space-y-3">
        <label className="block text-sm font-medium text-neutral-800">
          Application name
        </label>
        <input
          value={appName}
          onChange={(e) => setAppName(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-none"
          required
        />
      </section>

      <UserBlock
        title="Father (administrator)"
        value={father}
        onChange={setFather}
      />
      <UserBlock title="Student" value={student} onChange={setStudent} />

      <section className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-neutral-800">
          <input
            type="checkbox"
            checked={includeQari}
            onChange={(e) => setIncludeQari(e.target.checked)}
          />
          Also create a Qari account (optional)
        </label>
        {includeQari && (
          <UserBlock
            title="Qari"
            value={qari}
            onChange={setQari}
            hideTitle
          />
        )}
      </section>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-neutral-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy ? "Creating accounts…" : "Create accounts and continue"}
      </button>
    </form>
  );
}

function UserBlock({
  title,
  value,
  onChange,
  hideTitle = false,
}: {
  title: string;
  value: UserFields;
  onChange: (v: UserFields) => void;
  hideTitle?: boolean;
}) {
  return (
    <section className="space-y-3">
      {!hideTitle && (
        <h2 className="text-sm font-semibold text-neutral-800">{title}</h2>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          placeholder="Name"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          className="rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-none"
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={value.email}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
          className="rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-none"
          required
        />
        <input
          type="password"
          placeholder="Password (min 8 characters)"
          value={value.password}
          onChange={(e) => onChange({ ...value, password: e.target.value })}
          minLength={8}
          className="sm:col-span-2 rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-none"
          required
        />
      </div>
    </section>
  );
}