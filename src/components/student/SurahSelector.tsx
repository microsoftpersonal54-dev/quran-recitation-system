"use client";

import { useEffect, useState } from "react";
import { SURAHS, getSurah } from "@/lib/quran/surahs";

interface Props {
  surahNumber: number;
  ayahFrom: number;
  ayahTo: number;
  onChange: (next: {
    surahNumber: number;
    ayahFrom: number;
    ayahTo: number;
  }) => void;
  disabled?: boolean;
}

export default function SurahSelector({
  surahNumber,
  ayahFrom,
  ayahTo,
  onChange,
  disabled = false,
}: Props) {
  const surah = getSurah(surahNumber);
  const maxAyah = surah?.ayahCount ?? 1;

  // Local text state so the user can type freely ("6", "18", etc.)
  // without React clamping mid-keystroke.
  const [fromText, setFromText] = useState<string>(String(ayahFrom));
  const [toText, setToText] = useState<string>(String(ayahTo));

  // Sync when parent value changes (e.g. surah switch).
  useEffect(() => {
    setFromText(String(ayahFrom));
  }, [ayahFrom]);

  useEffect(() => {
    setToText(String(ayahTo));
  }, [ayahTo]);

  function commitFrom() {
    const n = Number(fromText);
    if (!Number.isFinite(n) || n < 1) {
      setFromText(String(ayahFrom));
      return;
    }
    const v = Math.min(Math.max(1, Math.floor(n)), maxAyah);
    onChange({
      surahNumber,
      ayahFrom: v,
      ayahTo: Math.max(v, ayahTo),
    });
    setFromText(String(v));
  }

  function commitTo() {
    const n = Number(toText);
    if (!Number.isFinite(n) || n < 1) {
      setToText(String(ayahTo));
      return;
    }
    const v = Math.min(Math.max(1, Math.floor(n)), maxAyah);
    onChange({
      surahNumber,
      ayahFrom: Math.min(ayahFrom, v),
      ayahTo: v,
    });
    setToText(String(v));
  }

  function changeSurah(n: number) {
    const s = getSurah(n);
    const max = s?.ayahCount ?? 1;
    // Keep the current ayah range, but clamp within new surah bounds.
    const clampedFrom = Math.min(Math.max(1, ayahFrom), max);
    const clampedTo = Math.min(Math.max(clampedFrom, ayahTo), max);
    onChange({
      surahNumber: n,
      ayahFrom: clampedFrom,
      ayahTo: clampedTo,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="surah"
          className="block text-sm font-medium text-neutral-800"
        >
          Surah
        </label>
        <select
          id="surah"
          value={surahNumber}
          disabled={disabled}
          onChange={(e) => changeSurah(Number(e.target.value))}
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-3 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none disabled:bg-neutral-100"
        >
          {SURAHS.map((s) => (
            <option key={s.number} value={s.number}>
              {s.number}. {s.name} ({s.ayahCount} ayahs)
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="ayahFrom"
            className="block text-sm font-medium text-neutral-800"
          >
            Ayah from
          </label>
          <input
            id="ayahFrom"
            type="number"
            inputMode="numeric"
            min={1}
            max={maxAyah}
            value={fromText}
            disabled={disabled}
            onChange={(e) => setFromText(e.target.value)}
            onBlur={commitFrom}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="1"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-3 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none disabled:bg-neutral-100"
          />
        </div>
        <div>
          <label
            htmlFor="ayahTo"
            className="block text-sm font-medium text-neutral-800"
          >
            Ayah to
          </label>
          <input
            id="ayahTo"
            type="number"
            inputMode="numeric"
            min={1}
            max={maxAyah}
            value={toText}
            disabled={disabled}
            onChange={(e) => setToText(e.target.value)}
            onBlur={commitTo}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder={String(maxAyah)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-3 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none disabled:bg-neutral-100"
          />
        </div>
      </div>

      {surah && (
        <p className="text-xs text-neutral-500">
          This surah has {surah.ayahCount} ayahs. Range must be between 1 and{" "}
          {surah.ayahCount}.
        </p>
      )}
    </div>
  );
}