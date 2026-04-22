import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./config";

/**
 * Unauthenticated Supabase client for public read routes (Market Space / iTred).
 * Relies on RLS `anon` policies on projection tables only.
 */
export function createPublicAnonSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
