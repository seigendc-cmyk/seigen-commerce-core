import { effectiveDueDateKeyForSupplier } from "@/modules/financial/services/creditor-due";
import { effectiveCollectionDateKeyForCustomer } from "@/modules/financial/services/debtor-due";
import { listCreditorEntries, listOutstandingCreditors } from "@/modules/financial/services/creditors-ledger";
import { listDebtorEntries, listOutstandingDebtors } from "@/modules/financial/services/debtors-ledger";
import { localTodayKey } from "@/modules/financial/services/cashplan-schedule-missed";

export type CashPlanReminderLine = {
  name: string;
  balance: number;
  dueDateKey: string;
  /** Days from today until due date (0 = due today, 3 = due in 3 days). */
  daysUntil: number;
};

function parseLocalDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map((x) => parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Whole days from today to due (positive = due in future, 0 = today, negative = overdue). */
export function daysFromTodayToDue(dueDateKey: string, todayKey: string): number {
  const due = parseLocalDateKey(dueDateKey);
  const today = parseLocalDateKey(todayKey);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

/**
 * Reminder window: from 3 days before the due date through the due date (inclusive).
 * So we include when daysUntil is 0, 1, 2, or 3.
 */
export function isDueInReminderWindow(dueDateKey: string, todayKey: string): boolean {
  const n = daysFromTodayToDue(dueDateKey, todayKey);
  return n >= 0 && n <= 3;
}

function money(n: number): string {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function buildCashPlanDueReminderPayload(todayKey: string = localTodayKey()): {
  creditors: CashPlanReminderLine[];
  debtors: CashPlanReminderLine[];
  digest: string;
} {
  const creditorEntries = listCreditorEntries(500);
  const debtorEntries = listDebtorEntries(500);

  const creditors: CashPlanReminderLine[] = [];
  for (const row of listOutstandingCreditors()) {
    const due = effectiveDueDateKeyForSupplier(row.supplierId, creditorEntries);
    if (!due || !isDueInReminderWindow(due, todayKey)) continue;
    creditors.push({
      name: row.supplierName,
      balance: row.balance,
      dueDateKey: due,
      daysUntil: daysFromTodayToDue(due, todayKey),
    });
  }
  creditors.sort((a, b) => a.dueDateKey.localeCompare(b.dueDateKey) || a.name.localeCompare(b.name));

  const debtors: CashPlanReminderLine[] = [];
  for (const row of listOutstandingDebtors()) {
    const due = effectiveCollectionDateKeyForCustomer(row.customerId, debtorEntries);
    if (!due || !isDueInReminderWindow(due, todayKey)) continue;
    debtors.push({
      name: row.customerName,
      balance: row.balance,
      dueDateKey: due,
      daysUntil: daysFromTodayToDue(due, todayKey),
    });
  }
  debtors.sort((a, b) => a.dueDateKey.localeCompare(b.dueDateKey) || a.name.localeCompare(b.name));

  const digest = JSON.stringify({
    t: todayKey,
    c: creditors.map((x) => [x.name, x.balance, x.dueDateKey]),
    d: debtors.map((x) => [x.name, x.balance, x.dueDateKey]),
  });

  return { creditors, debtors, digest };
}

export function formatCashPlanReminderText(
  lines: { creditors: CashPlanReminderLine[]; debtors: CashPlanReminderLine[] },
  todayKey: string,
): { subject: string; text: string; html: string } {
  const subject = `CashPlan: creditor & debtor dates (next 3 days) — ${todayKey}`;

  const whenLabel = (days: number) =>
    days === 0 ? "due today" : days === 1 ? "due in 1 day" : `due in ${days} days`;

  let text = `SEIGEN Commerce — CashPlan reminder\nDate: ${todayKey}\n\n`;
  text += `This lists open balances with a payment or collection date within the next 3 days (including today).\n\n`;

  text += `CREDITORS (amounts you owe — payables)\n`;
  text += `--------------------------------------\n`;
  if (lines.creditors.length === 0) {
    text += `(none in this window)\n`;
  } else {
    for (const c of lines.creditors) {
      text += `• ${c.name} — ${money(c.balance)} — ${c.dueDateKey} (${whenLabel(c.daysUntil)})\n`;
    }
  }

  text += `\nDEBTORS (amounts owed to you — receivables)\n`;
  text += `-------------------------------------------\n`;
  if (lines.debtors.length === 0) {
    text += `(none in this window)\n`;
  } else {
    for (const d of lines.debtors) {
      text += `• ${d.name} — ${money(d.balance)} — ${d.dueDateKey} (${whenLabel(d.daysUntil)})\n`;
    }
  }

  text += `\n—\nSent automatically from your CashPlan dashboard. Configure RESEND_API_KEY on the server for email delivery.`;

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const rowHtml = (label: string, balance: number, due: string, days: number) =>
    `<tr><td>${esc(label)}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${money(balance)}</td><td>${esc(due)}</td><td>${esc(whenLabel(days))}</td></tr>`;

  let html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;font-size:14px;color:#111">`;
  html += `<h1 style="font-size:18px">CashPlan reminder</h1><p style="color:#444">${esc(todayKey)}</p>`;
  html += `<p>Open balances with a payment or collection date within the next 3 days (including today).</p>`;
  html += `<h2 style="font-size:15px;margin-top:20px">Creditors (payables)</h2>`;
  html += `<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:560px"><thead><tr><th align="left">Supplier</th><th align="right">Balance</th><th>Due date</th><th>When</th></tr></thead><tbody>`;
  if (lines.creditors.length === 0) {
    html += `<tr><td colspan="4">(none in this window)</td></tr>`;
  } else {
    for (const c of lines.creditors) html += rowHtml(c.name, c.balance, c.dueDateKey, c.daysUntil);
  }
  html += `</tbody></table>`;

  html += `<h2 style="font-size:15px;margin-top:20px">Debtors (receivables)</h2>`;
  html += `<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:560px"><thead><tr><th align="left">Customer</th><th align="right">Balance</th><th>Due date</th><th>When</th></tr></thead><tbody>`;
  if (lines.debtors.length === 0) {
    html += `<tr><td colspan="4">(none in this window)</td></tr>`;
  } else {
    for (const d of lines.debtors) html += rowHtml(d.name, d.balance, d.dueDateKey, d.daysUntil);
  }
  html += `</tbody></table>`;
  html += `<p style="margin-top:20px;font-size:12px;color:#666">SEIGEN Commerce — CashPlan</p></body></html>`;

  return { subject, text, html };
}

export const CASHPLAN_REMINDER_SENT_KEY_PREFIX = "seigen_cashplan_reminder_email_";

export function wasCashPlanReminderSentToday(todayKey: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(`${CASHPLAN_REMINDER_SENT_KEY_PREFIX}${todayKey}`) === "1";
  } catch {
    return true;
  }
}

export function markCashPlanReminderSentToday(todayKey: string): void {
  try {
    window.localStorage.setItem(`${CASHPLAN_REMINDER_SENT_KEY_PREFIX}${todayKey}`, "1");
  } catch {
    /* ignore */
  }
}
