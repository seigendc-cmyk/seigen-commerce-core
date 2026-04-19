"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type SendCashPlanReminderResult =
  | { ok: true }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

/**
 * Sends CashPlan due-date reminder to the signed-in user's email (must match `to`).
 * Requires RESEND_API_KEY and optional CASHPLAN_REMINDER_FROM_EMAIL in server env.
 */
export async function sendCashPlanDueReminderEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<SendCashPlanReminderResult> {
  if (!isSupabaseConfigured()) {
    return { ok: true, skipped: true, reason: "Supabase not configured" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email?.trim()) {
    return { ok: false, error: "Sign in to send CashPlan email reminders." };
  }

  const toNorm = input.to.trim().toLowerCase();
  const userNorm = user.email.trim().toLowerCase();
  if (toNorm !== userNorm) {
    return { ok: false, error: "Reminder email must match your signed-in address." };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.CASHPLAN_REMINDER_FROM_EMAIL?.trim() || "CashPlan <onboarding@resend.dev>";

  if (!apiKey) {
    return { ok: true, skipped: true, reason: "RESEND_API_KEY not configured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to.trim()],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: errText || `Resend HTTP ${res.status}` };
  }

  return { ok: true };
}
