import { z } from "zod";
import { getSurah } from "@/lib/quran/surahs";

export const createRecordingSchema = z
  .object({
    surahNumber: z.number().int().min(1).max(114),
    ayahFrom: z.number().int().min(1),
    ayahTo: z.number().int().min(1),
    paraNumber: z.number().int().min(1).max(30).nullable().optional(),
    paraFrom: z.number().int().min(1).max(30).nullable().optional(),
    paraTo: z.number().int().min(1).max(30).nullable().optional(),
    qariId: z.string().nullable().optional(),
    durationMs: z.number().int().min(100).max(4 * 60 * 60 * 1000),
    notes: z.string().max(2000).optional().default(""),
    timezone: z.string().max(64).optional().default("UTC"),
  })
  .superRefine((val, ctx) => {
    const surah = getSurah(val.surahNumber);
    if (!surah) {
      ctx.addIssue({
        code: "custom",
        path: ["surahNumber"],
        message: "Unknown surah.",
      });
      return;
    }
    if (val.ayahFrom > val.ayahTo) {
      ctx.addIssue({
        code: "custom",
        path: ["ayahFrom"],
        message: "Ayah from must be less than or equal to Ayah to.",
      });
    }
    if (val.ayahTo > surah.ayahCount) {
      ctx.addIssue({
        code: "custom",
        path: ["ayahTo"],
        message: `Surah ${surah.name} has only ${surah.ayahCount} ayahs.`,
      });
    }
  });

export type CreateRecordingInput = z.infer<typeof createRecordingSchema>;