/**
 * Validates Supabase public env at runtime (fail fast in dev when misconfigured).
 */
export function getSupabaseEnv(): {
  url: string;
  anonKey: string;
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url?.trim()) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!anonKey?.trim()) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return { url, anonKey };
}

/** For Edge middleware: skip Supabase when env is not configured (e.g. before `.env.local`). */
export function tryGetSupabaseEnv():
  | { ok: true; url: string; anonKey: string }
  | { ok: false } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url?.trim() || !anonKey?.trim()) {
    return { ok: false };
  }
  return { ok: true, url, anonKey };
}
