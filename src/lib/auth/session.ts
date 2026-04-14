import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/** Prefer this on the server — validates the JWT with Supabase Auth. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    return null;
  }
  return user;
}

export async function requireUser(options?: { next?: string }) {
  const user = await getUser();
  if (!user) {
    const next = options?.next ?? "/dashboard";
    const q = new URLSearchParams();
    q.set("next", next);
    redirect(`/signin?${q.toString()}`);
  }
  return user;
}
