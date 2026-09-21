import { z } from "zod";

export const MISTAKE_CATEGORIES = [
  "TAJWEED",
  "PRONUNCIATION",
  "MADD",
  "MAKHARIJ",
  "GHUNNAH",
  "WAQF",
  "GENERAL",
  "OTHER",
] as const;

export const MISTAKE_SEVERITIES = ["MINOR", "MEDIUM", "MAJOR"] as const;

export const createMistakeSchema = z.object({
  timestampMs: z.number().int().min(0).max(4 * 60 * 60 * 1000),
  ayahNumber: z.number().int().min(1).max(300).nullable().optional(),
  category: z.enum(MISTAKE_CATEGORIES),
  severity: z.enum(MISTAKE_SEVERITIES),
  description: z.string().min(1).max(1000),
  correction: z.string().max(1000).optional().default(""),
});

export const updateMistakeSchema = createMistakeSchema.partial();

export const markReviewedSchema = z.object({
  reviewStatus: z.enum(["UNREVIEWED", "IN_REVIEW", "REVIEWED"]),
});

export type CreateMistakeInput = z.infer<typeof createMistakeSchema>;
export type UpdateMistakeInput = z.infer<typeof updateMistakeSchema>;