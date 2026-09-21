"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Anon-key browser client. Auth remains the app's custom cookie sessions;
 * this is only for client-side Storage/realtime if needed.
 */
export function supabaseBrowser(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  cached = createClient(url, anon);
  return cached;
}
