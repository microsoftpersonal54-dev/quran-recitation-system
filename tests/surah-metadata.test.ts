import { describe, it, expect } from "vitest";
import { SURAHS, getSurah, isValidAyah } from "@/lib/quran/surahs";

describe("Quran surah metadata", () => {
  it("contains exactly 114 surahs", () => {
    expect(SURAHS).toHaveLength(114);
  });

  it("numbers are 1..114 in order", () => {
    SURAHS.forEach((s, i) => expect(s.number).toBe(i + 1));
  });

  it("each surah has a name and ayah count", () => {
    for (const s of SURAHS) {
      expect(typeof s.name).toBe("string");
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.ayahCount).toBeGreaterThan(0);
    }
  });

  it("getSurah returns the right entry", () => {
    const fat = getSurah(1);
    expect(fat?.name).toBe("Al-Fatihah");
    expect(fat?.ayahCount).toBe(7);

    const baq = getSurah(2);
    expect(baq?.name).toBe("Al-Baqarah");
    expect(baq?.ayahCount).toBe(286);
  });

  it("isValidAyah checks bounds correctly", () => {
    expect(isValidAyah(1, 1)).toBe(true);
    expect(isValidAyah(1, 7)).toBe(true);
    expect(isValidAyah(1, 8)).toBe(false);
    expect(isValidAyah(1, 0)).toBe(false);
    expect(isValidAyah(999, 1)).toBe(false);
  });
});