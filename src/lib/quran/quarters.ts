// Helpers for Para (Juz) quarters (Rub').
// Each of the 30 paras has 4 quarters.

import { getPara } from "./paras";

export type QuarterNumber = 1 | 2 | 3 | 4;

export function guessQuarter(
  paraNumber: number,
  surah: number,
  ayah: number
): QuarterNumber | null {
  const para = getPara(paraNumber);
  if (!para) return null;

  const startKey = para.startSurah * 10000 + para.startAyah;
  const endKey = para.endSurah * 10000 + para.endAyah;
  const key = surah * 10000 + ayah;

  if (key < startKey || key > endKey) return null;

  const total = endKey - startKey;
  if (total <= 0) return 1;

  const ratio = (key - startKey) / total;
  const q = Math.floor(ratio * 4) + 1;
  return Math.min(4, Math.max(1, q)) as QuarterNumber;
}

export const QUARTER_LABELS: Record<QuarterNumber, string> = {
  1: "1st quarter",
  2: "2nd quarter",
  3: "3rd quarter",
  4: "4th quarter",
};

export const QUARTER_SHORT: Record<QuarterNumber, string> = {
  1: "1/4",
  2: "2/4",
  3: "3/4",
  4: "4/4",
};

export function quarterLabel(q: QuarterNumber): string {
  return QUARTER_LABELS[q];
}