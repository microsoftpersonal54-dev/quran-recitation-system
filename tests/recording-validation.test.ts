import { describe, it, expect } from "vitest";
import { createRecordingSchema } from "@/lib/validation/recordings";

describe("recording validation", () => {
  const valid = {
    surahNumber: 1,
    ayahFrom: 1,
    ayahTo: 7,
    durationMs: 5000,
    notes: "",
    timezone: "UTC",
  };

  it("accepts a valid payload", () => {
    const r = createRecordingSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("rejects an unknown surah", () => {
    const r = createRecordingSchema.safeParse({ ...valid, surahNumber: 999 });
    expect(r.success).toBe(false);
  });

  it("rejects ayah range beyond surah length", () => {
    // Al-Fatihah has 7 ayahs
    const r = createRecordingSchema.safeParse({
      ...valid,
      ayahFrom: 1,
      ayahTo: 99,
    });
    expect(r.success).toBe(false);
  });

  it("rejects ayahFrom > ayahTo", () => {
    const r = createRecordingSchema.safeParse({
      ...valid,
      ayahFrom: 5,
      ayahTo: 3,
    });
    expect(r.success).toBe(false);
  });

  it("rejects zero-duration recordings", () => {
    const r = createRecordingSchema.safeParse({ ...valid, durationMs: 10 });
    expect(r.success).toBe(false);
  });

  it("rejects absurdly long recordings", () => {
    const r = createRecordingSchema.safeParse({
      ...valid,
      durationMs: 5 * 60 * 60 * 1000, // 5 hours
    });
    expect(r.success).toBe(false);
  });
});