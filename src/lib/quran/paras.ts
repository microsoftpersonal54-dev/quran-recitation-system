// The 30 Paras (Juz) of the Quran with their starting and ending positions.
// Source: standard Uthmani mushaf division.
// METADATA ONLY — no Quranic text is included.

export interface Para {
  number: number;
  name: string;
  startSurah: number;
  startAyah: number;
  endSurah: number;
  endAyah: number;
}

export const PARAS: Para[] = [
  { number: 1,  name: "Alif Lam Meem",     startSurah: 1,  startAyah: 1,   endSurah: 2,   endAyah: 141 },
  { number: 2,  name: "Sayaqul",           startSurah: 2,  startAyah: 142, endSurah: 2,   endAyah: 252 },
  { number: 3,  name: "Tilkal Rusul",      startSurah: 2,  startAyah: 253, endSurah: 3,   endAyah: 92 },
  { number: 4,  name: "Lan Tanaloo",       startSurah: 3,  startAyah: 93,  endSurah: 4,   endAyah: 23 },
  { number: 5,  name: "Wal Mohsanat",      startSurah: 4,  startAyah: 24,  endSurah: 4,   endAyah: 147 },
  { number: 6,  name: "La Yuhibbullah",    startSurah: 4,  startAyah: 148, endSurah: 5,   endAyah: 81 },
  { number: 7,  name: "Wa Iza Samiu",      startSurah: 5,  startAyah: 82,  endSurah: 6,   endAyah: 110 },
  { number: 8,  name: "Wa Lau Annana",     startSurah: 6,  startAyah: 111, endSurah: 7,   endAyah: 87 },
  { number: 9,  name: "Qalal Malao",       startSurah: 7,  startAyah: 88,  endSurah: 8,   endAyah: 40 },
  { number: 10, name: "Wa A'lamu",         startSurah: 8,  startAyah: 41,  endSurah: 9,   endAyah: 92 },
  { number: 11, name: "Yatazeroon",        startSurah: 9,  startAyah: 93,  endSurah: 11,  endAyah: 5 },
  { number: 12, name: "Wa Mamin Da'abat",  startSurah: 11, startAyah: 6,   endSurah: 12,  endAyah: 52 },
  { number: 13, name: "Wa Ma Ubarrio",     startSurah: 12, startAyah: 53,  endSurah: 14,  endAyah: 52 },
  { number: 14, name: "Rubama",            startSurah: 15, startAyah: 1,   endSurah: 16,  endAyah: 128 },
  { number: 15, name: "Subhanallazi",      startSurah: 17, startAyah: 1,   endSurah: 18,  endAyah: 74 },
  { number: 16, name: "Qal Alam",          startSurah: 18, startAyah: 75,  endSurah: 20,  endAyah: 135 },
  { number: 17, name: "Aqtarabo",          startSurah: 21, startAyah: 1,   endSurah: 22,  endAyah: 78 },
  { number: 18, name: "Qad Aflaha",        startSurah: 23, startAyah: 1,   endSurah: 25,  endAyah: 20 },
  { number: 19, name: "Wa Qalallazina",    startSurah: 25, startAyah: 21,  endSurah: 27,  endAyah: 55 },
  { number: 20, name: "A'man Khalaq",      startSurah: 27, startAyah: 56,  endSurah: 29,  endAyah: 45 },
  { number: 21, name: "Utlu Ma Oohia",     startSurah: 29, startAyah: 46,  endSurah: 33,  endAyah: 30 },
  { number: 22, name: "Wa Manyaqnut",      startSurah: 33, startAyah: 31,  endSurah: 36,  endAyah: 27 },
  { number: 23, name: "Wa Mali",           startSurah: 36, startAyah: 28,  endSurah: 39,  endAyah: 31 },
  { number: 24, name: "Faman Azlam",       startSurah: 39, startAyah: 32,  endSurah: 41,  endAyah: 46 },
  { number: 25, name: "Elahe Yuraddo",     startSurah: 41, startAyah: 47,  endSurah: 45,  endAyah: 37 },
  { number: 26, name: "Ha Meem",           startSurah: 46, startAyah: 1,   endSurah: 51,  endAyah: 30 },
  { number: 27, name: "Qala Fama Khatbukum",startSurah: 51,startAyah: 31,  endSurah: 57,  endAyah: 29 },
  { number: 28, name: "Qad Sami Allah",    startSurah: 58, startAyah: 1,   endSurah: 66,  endAyah: 12 },
  { number: 29, name: "Tabarakallazi",     startSurah: 67, startAyah: 1,   endSurah: 77,  endAyah: 50 },
  { number: 30, name: "Amma Yatasa'aloon", startSurah: 78, startAyah: 1,   endSurah: 114, endAyah: 6 },
];

export function getPara(n: number): Para | undefined {
  return PARAS.find((p) => p.number === n);
}

/**
 * Given a surah + ayah, returns the para number it belongs to.
 */
export function getParaForAyah(surah: number, ayah: number): number | null {
  for (const p of PARAS) {
    const startKey = p.startSurah * 10000 + p.startAyah;
    const endKey = p.endSurah * 10000 + p.endAyah;
    const key = surah * 10000 + ayah;
    if (key >= startKey && key <= endKey) return p.number;
  }
  return null;
}

/**
 * Given a range, returns the para(s) covered.
 */
export function getParasForRange(
  surahFrom: number,
  ayahFrom: number,
  surahTo: number,
  ayahTo: number
): { paraFrom: number; paraTo: number } | null {
  const p1 = getParaForAyah(surahFrom, ayahFrom);
  const p2 = getParaForAyah(surahTo, ayahTo);
  if (p1 == null || p2 == null) return null;
  return { paraFrom: p1, paraTo: p2 };
}