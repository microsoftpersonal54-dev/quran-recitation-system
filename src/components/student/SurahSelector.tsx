"use client";

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

  function setSurah(n: number) {
    const s = getSurah(n);
    const max = s?.ayahCount ?? 1;
    onChange({
      surahNumber: n,
      ayahFrom: Math.min(ayahFrom, max),
      ayahTo: Math.min(ayahTo, max),
    });
  }

  function setFrom(n: number) {
    const v = Math.min(Math.max(1, n), maxAyah);
    onChange({
      surahNumber,
      ayahFrom: v,
      ayahTo: Math.max(v, ayahTo),
    });
  }

  function setTo(n: number) {
    const v = Math.min(Math.max(1, n), maxAyah);
    onChange({
      surahNumber,
      ayahFrom: Math.min(ayahFrom, v),
      ayahTo: v,
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
          onChange={(e) => setSurah(Number(e.target.value))}
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
            value={ayahFrom}
            disabled={disabled}
            onChange={(e) => setFrom(Number(e.target.value))}
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
            value={ayahTo}
            disabled={disabled}
            onChange={(e) => setTo(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-3 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none disabled:bg-neutral-100"
          />
        </div>
      </div>

      {surah && (
        <p className="text-xs text-neutral-500">
          This surah has {surah.ayahCount} ayahs. Choose a range between 1 and{" "}
          {surah.ayahCount}.
        </p>
      )}
    </div>
  );
}