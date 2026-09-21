import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const setupUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const setupSchema = z.object({
  appName: z.string().min(1).max(80).optional(),
  father: setupUserSchema,
  student: setupUserSchema,
  qari: setupUserSchema.optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SetupInput = z.infer<typeof setupSchema>;