"use client";

import { sendCashPlanDueReminderEmail } from "@/modules/cash-plan/actions/send-cashplan-due-reminder-email";
import { localTodayKey } from "@/modules/financial/services/cashplan-schedule-missed";
import {
  buildCashPlanDueReminderPayload,
  formatCashPlanReminderText,
  markCashPlanReminderSentToday,
  wasCashPlanReminderSentToday,
} from "@/modules/cash-plan/services/cashplan-due-reminders";

function openMailtoFallback(to: string, subject: string, body: string) {
  const u = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  try {
    window.open(u, "_blank", "noopener,noreferrer");
  } catch {
    /* ignore */
  }
}

let reminderInFlight = false;

/**
 * Once per local calendar day: if there are creditors or debtors due within 3 days,
 * email the vendor (signed-in user email). Uses Resend when RESEND_API_KEY is set; otherwise mailto.
 */
export async function runCashPlanDueReminderOnce(vendorEmail: string | undefined): Promise<void> {
  const email = vendorEmail?.trim();
  if (!email) return;
  if (reminderInFlight) return;

  const todayKey = localTodayKey();
  if (wasCashPlanReminderSentToday(todayKey)) return;

  const { creditors, debtors } = buildCashPlanDueReminderPayload(todayKey);
  if (creditors.length === 0 && debtors.length === 0) return;

  reminderInFlight = true;
  try {
    const { subject, text, html } = formatCashPlanReminderText({ creditors, debtors }, todayKey);

    const result = await sendCashPlanDueReminderEmail({
      to: email,
      subject,
      text,
      html,
    });

    if (result.ok) {
      if ("skipped" in result && result.skipped) {
        openMailtoFallback(email, subject, text);
      }
      markCashPlanReminderSentToday(todayKey);
      return;
    }

    openMailtoFallback(email, subject, text);
    markCashPlanReminderSentToday(todayKey);
  } finally {
    reminderInFlight = false;
  }
}
