"use client";

import { useEffect, useState } from "react";
import { UserCheck } from "lucide-react";

interface Qari {
  id: string;
  name: string;
}

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}

export default function QariPicker({ value, onChange, disabled }: Props) {
  const [qaris, setQaris] = useState<Qari[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/qaris");
        const data = await res.json();
        if (!cancelled && res.ok) setQaris(data.qaris ?? []);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
        Loading qari list…
      </div>
    );
  }

  if (qaris.length === 0) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
        No qari accounts yet — you can leave this blank.
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor="qariPicker"
        className="flex items-center gap-1.5 text-sm font-medium text-neutral-800"
      >
        <UserCheck className="h-4 w-4" aria-hidden />
        Recited with (Qari)
      </label>
      <select
        id="qariPicker"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
        className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-3 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none disabled:bg-neutral-100"
      >
        <option value="">— Not specified —</option>
        {qaris.map((q) => (
          <option key={q.id} value={q.id}>
            {q.name}
          </option>
        ))}
      </select>
    </div>
  );
}