"use client";

import { clearDemoSession } from "@/lib/demo-session";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function signOutVendorSession(): Promise<void> {
  clearDemoSession();
  if (!isSupabaseConfigured()) return;
  const supabase = createBrowserSupabaseClient();
  await supabase.auth.signOut();
}
