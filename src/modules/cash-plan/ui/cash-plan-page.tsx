"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/components/dashboard/workspace-context";
import { readDemoSession } from "@/lib/demo-session";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import {
  emitCashPlanScheduleChangeRequestedBrainEvent,
  emitCreditorPaymentBrainEvent,
} from "@/modules/brain/brain-actions";
import { FINANCIAL_LEDGERS_UPDATED_EVENT } from "@/modules/financial/services/financial-events";
import { CashPlanScheduleApprovalsPanel } from "@/modules/cash-plan/ui/cash-plan-schedule-approvals";
import { CashPlanLiquidityDiscipline } from "@/modules/cash-plan/ui/cash-plan-liquidity-discipline";
import { CashPlanReserveApprovalsPanel } from "@/modules/cash-plan/ui/cash-plan-reserve-approvals";
import { CashPlanReservesPanel } from "@/modules/cash-plan/ui/cash-plan-reserves-panel";
import {
  CashPlanCreditorsAgeingTab,
  CashPlanDebtorsAgeingTab,
} from "@/modules/cash-plan/ui/cash-plan-ageing-views";
import { CashPlanFundsFlowTab } from "@/modules/cash-plan/ui/cash-plan-funds-flow-tab";
import { CashPlanCashUtilizationTab } from "@/modules/cash-plan/ui/cash-plan-cash-utilization-tab";
import { WindowControls } from "@/components/ui/window-controls";
import {
  CASHPLAN_RESERVES_UPDATED,
  RESERVE_APPROVAL_QUEUE_UPDATED,
} from "@/modules/cash-plan/services/cash-plan-reserves";
import { getCashPlanSnapshot } from "@/modules/cash-plan/services/cash-plan-snapshot";
import { runCashPlanDueReminderOnce } from "@/modules/cash-plan/services/cashplan-reminder-runner";
import { isCreditorPaymentMissed, isDebtorCollectionMissed } from "@/modules/financial/services/cashplan-schedule-missed";
import {
  effectiveDueDateKeyForSupplier,
  outstandingCreditorsWithDueDates,
  type DueCreditorRow,
} from "@/modules/financial/services/creditor-due";
import {
  effectiveCollectionDateKeyForCustomer,
  outstandingDebtorsWithDueDates,
  type DueDebtorRow,
} from "@/modules/financial/services/debtor-due";
import {
  DEBTOR_SCHEDULE_UPDATED,
  getScheduledDebtorCollectionDate,
  setScheduledDebtorCollectionDate,
} from "@/modules/financial/services/debtor-schedule";
import {
  listDebtorEntries,
  listDebtorEntriesForCustomer,
  listOutstandingDebtors,
} from "@/modules/financial/services/debtors-ledger";
import { payCreditorsFromCogsReserve, type CreditorAllocation } from "@/modules/financial/services/creditor-payments-from-cogs";
import {
  SCHEDULE_APPROVAL_QUEUE_UPDATED,
  submitScheduleChangeRequest,
} from "@/modules/financial/services/schedule-change-queue";
import {
  CREDITOR_SCHEDULE_UPDATED,
  getScheduledNextDueDate,
  setScheduledNextDueDate,
} from "@/modules/financial/services/creditor-schedule";
import {
  listCreditorEntries,
  listCreditorEntriesForSupplier,
  listOutstandingCreditors,
} from "@/modules/financial/services/creditors-ledger";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoToDateInputValue(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return localDateKey(d);
}

function monthMatrix(year: number, monthIndex: number): (Date | null)[][] {
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, monthIndex, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function openPrintableLedgerReport(title: string, bodyHtml: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 18px; }
    h2 { font-size: 15px; margin-top: 20px; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
    th { background: #f4f4f4; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    @media print { body { padding: 12px; } }
  </style></head><body>
  <h1>${title}</h1>
  ${bodyHtml}
  <script>window.onload = function() { window.print(); }</script>
  </body></html>`);
  w.document.close();
}

function buildDayPrintHtml(dateKey: string, rows: DueCreditorRow[]): string {
  let html = `<p style="color:#444;font-size:13px">Due date (calendar): ${dateKey}</p>`;
  for (const r of rows) {
    const lines = listCreditorEntriesForSupplier(r.supplierId);
    html += `<h2>${r.supplierName}</h2>`;
    html += `<p><strong>Outstanding balance:</strong> ${money(r.balance)}</p>`;
    html += `<table><thead><tr><th>When</th><th>Ref</th><th>Type</th><th class="num">Amount</th></tr></thead><tbody>`;
    for (const e of lines) {
      const kind = e.amount < 0 ? "Payment" : "Invoice";
      html += `<tr><td>${new Date(e.createdAt).toLocaleString()}</td><td>${e.poReference}</td><td>${kind}</td><td class="num">${money(e.amount)}</td></tr>`;
    }
    html += `</tbody></table>`;
  }
  return html;
}

function buildDebtorDayPrintHtml(dateKey: string, rows: DueDebtorRow[]): string {
  let html = `<p style="color:#444;font-size:13px">Collection date (calendar): ${dateKey}</p>`;
  for (const r of rows) {
    const lines = listDebtorEntriesForCustomer(r.customerId);
    html += `<h2>${r.customerName}</h2>`;
    html += `<p><strong>Outstanding balance:</strong> ${money(r.balance)}</p>`;
    html += `<table><thead><tr><th>When</th><th>Ref</th><th>Type</th><th class="num">Amount</th></tr></thead><tbody>`;
    for (const e of lines) {
      const kind = e.amount < 0 ? "Payment" : "Invoice";
      html += `<tr><td>${new Date(e.createdAt).toLocaleString()}</td><td>${e.reference}</td><td>${kind}</td><td class="num">${money(e.amount)}</td></tr>`;
    }
    html += `</tbody></table>`;
  }
  return html;
}

/** When no creditor is “due” on that day yet, print all outstanding for planning. */
function buildOutstandingCreditorsPlanningHtml(
  dateKey: string,
  rows: Array<{ supplierId: string; supplierName: string; balance: number }>,
): string {
  let html = `<p style="color:#444;font-size:13px">Planning payment date: <strong>${dateKey}</strong> — all open supplier balances</p>`;
  for (const r of rows) {
    const lines = listCreditorEntriesForSupplier(r.supplierId);
    html += `<h2>${r.supplierName}</h2>`;
    html += `<p><strong>Outstanding balance:</strong> ${money(r.balance)}</p>`;
    html += `<table><thead><tr><th>When</th><th>Ref</th><th>Type</th><th class="num">Amount</th></tr></thead><tbody>`;
    for (const e of lines) {
      const kind = e.amount < 0 ? "Payment" : "Invoice";
      html += `<tr><td>${new Date(e.createdAt).toLocaleString()}</td><td>${e.poReference}</td><td>${kind}</td><td class="num">${money(e.amount)}</td></tr>`;
    }
    html += `</tbody></table>`;
  }
  return html;
}

function buildOutstandingDebtorsPlanningHtml(
  dateKey: string,
  rows: Array<{ customerId: string; customerName: string; balance: number }>,
): string {
  let html = `<p style="color:#444;font-size:13px">Planning collection date: <strong>${dateKey}</strong> — all open receivables</p>`;
  for (const r of rows) {
    const lines = listDebtorEntriesForCustomer(r.customerId);
    html += `<h2>${r.customerName}</h2>`;
    html += `<p><strong>Outstanding balance:</strong> ${money(r.balance)}</p>`;
    html += `<table><thead><tr><th>When</th><th>Ref</th><th>Type</th><th class="num">Amount</th></tr></thead><tbody>`;
    for (const e of lines) {
      const kind = e.amount < 0 ? "Payment" : "Invoice";
      html += `<tr><td>${new Date(e.createdAt).toLocaleString()}</td><td>${e.reference}</td><td>${kind}</td><td class="num">${money(e.amount)}</td></tr>`;
    }
    html += `</tbody></table>`;
  }
  return html;
}

/** Next payment date shown when opening a calendar day: saved schedule, else clicked day, else invoice-derived due. */
function creditorCalendarDateInputValue(
  supplierId: string,
  clickedDateKey: string,
  creditorEntries: ReturnType<typeof listCreditorEntries>,
): string {
  const sched = getScheduledNextDueDate(supplierId);
  if (sched) return isoToDateInputValue(sched);
  return clickedDateKey || effectiveDueDateKeyForSupplier(supplierId, creditorEntries) || "";
}

function debtorCalendarDateInputValue(
  customerId: string,
  clickedDateKey: string,
  debtorEntries: ReturnType<typeof listDebtorEntries>,
): string {
  const sched = getScheduledDebtorCollectionDate(customerId);
  if (sched) return isoToDateInputValue(sched);
  return clickedDateKey || effectiveCollectionDateKeyForCustomer(customerId, debtorEntries) || "";
}

function CollapseChevron({ expanded }: { expanded: boolean }) {
  return (
    <span
      className={`mt-0.5 inline-flex shrink-0 text-neutral-400 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
      aria-hidden
    >
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

function MonthNav({
  calYear,
  calMonth,
  setCalYear,
  setCalMonth,
}: {
  calYear: number;
  calMonth: number;
  setCalYear: (y: number) => void;
  setCalMonth: (m: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/5"
        onClick={() => {
          const d = new Date(calYear, calMonth - 1, 1);
          setCalYear(d.getFullYear());
          setCalMonth(d.getMonth());
        }}
      >
        ←
      </button>
      <span className="min-w-[140px] text-center text-sm font-medium text-neutral-200">
        {new Date(calYear, calMonth, 1).toLocaleString(undefined, { month: "long", year: "numeric" })}
      </span>
      <button
        type="button"
        className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/5"
        onClick={() => {
          const d = new Date(calYear, calMonth + 1, 1);
          setCalYear(d.getFullYear());
          setCalMonth(d.getMonth());
        }}
      >
        →
      </button>
    </div>
  );
}

function CalendarGrid<T extends { dueDateKey: string }>({
  calendarRows,
  localDateKey,
  dueByDate,
  accent,
  onPickDay,
}: {
  calendarRows: (Date | null)[][];
  localDateKey: (d: Date) => string;
  dueByDate: Map<string, T[]>;
  accent: "rose" | "sky";
  onPickDay: (key: string) => void;
}) {
  const filled =
    accent === "rose"
      ? "border-rose-500/35 bg-rose-500/10 text-white hover:bg-rose-500/20"
      : "border-sky-500/35 bg-sky-500/10 text-white hover:bg-sky-500/20";
  const label = accent === "rose" ? "text-rose-200/90" : "text-sky-200/90";

  return (
    <>
      <div className="mt-6 grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid gap-1">
        {calendarRows.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((cell, di) => {
              if (!cell) {
                return <div key={di} className="min-h-[72px] rounded-lg bg-white/[0.02]" />;
              }
              const key = localDateKey(cell);
              const rows = dueByDate.get(key) ?? [];
              const count = rows.length;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onPickDay(key)}
                  aria-label={
                    count > 0
                      ? `${cell.getDate()}: ${count} outstanding — open to manage`
                      : `${cell.getDate()}: plan payment or collection`
                  }
                  className={`flex min-h-[72px] flex-col rounded-lg border p-2 text-left text-sm transition ${
                    count ? filled : "border-white/[0.06] bg-white/[0.03] text-neutral-200 hover:bg-white/[0.07]"
                  }`}
                >
                  <div className="flex w-full items-start justify-between gap-1">
                    <span className="font-mono text-neutral-300">{cell.getDate()}</span>
                    {count > 0 ? (
                      <span
                        className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-orange-400 ring-2 ring-orange-400/30"
                        title="Outstanding payment due this day"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  {count > 0 ? (
                    <span className={`mt-auto text-[10px] font-semibold uppercase tracking-wide ${label}`}>
                      {count} due
                    </span>
                  ) : (
                    <span className="mt-auto text-[10px] text-neutral-500">Plan</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

export function CashPlanPage() {
  const workspace = useWorkspace();
  const [ledgerTick, setLedgerTick] = useState(0);
  const [scheduleTick, setScheduleTick] = useState(0);
  const [reserveTick, setReserveTick] = useState(0);

  type CashPlanTab = "overview" | "creditors_ageing" | "debtors_ageing" | "funds_flow" | "cash_utilization";
  const [cashPlanTab, setCashPlanTab] = useState<CashPlanTab>("overview");

  useEffect(() => {
    const fn = () => setLedgerTick((t) => t + 1);
    window.addEventListener(FINANCIAL_LEDGERS_UPDATED_EVENT, fn);
    return () => window.removeEventListener(FINANCIAL_LEDGERS_UPDATED_EVENT, fn);
  }, []);

  useEffect(() => {
    const fn = () => setScheduleTick((t) => t + 1);
    window.addEventListener(CREDITOR_SCHEDULE_UPDATED, fn);
    window.addEventListener(DEBTOR_SCHEDULE_UPDATED, fn);
    window.addEventListener(SCHEDULE_APPROVAL_QUEUE_UPDATED, fn);
    return () => {
      window.removeEventListener(CREDITOR_SCHEDULE_UPDATED, fn);
      window.removeEventListener(DEBTOR_SCHEDULE_UPDATED, fn);
      window.removeEventListener(SCHEDULE_APPROVAL_QUEUE_UPDATED, fn);
    };
  }, []);

  useEffect(() => {
    const fn = () => setReserveTick((t) => t + 1);
    window.addEventListener(CASHPLAN_RESERVES_UPDATED, fn);
    window.addEventListener(RESERVE_APPROVAL_QUEUE_UPDATED, fn);
    return () => {
      window.removeEventListener(CASHPLAN_RESERVES_UPDATED, fn);
      window.removeEventListener(RESERVE_APPROVAL_QUEUE_UPDATED, fn);
    };
  }, []);

  const dataVersion = `${ledgerTick}:${scheduleTick}:${reserveTick}`;

  const actorLabel =
    workspace?.user?.email?.trim() || readDemoSession()?.email?.trim() || "User";

  useEffect(() => {
    const vendorEmail = workspace?.user?.email?.trim() || readDemoSession()?.email?.trim() || undefined;
    void runCashPlanDueReminderOnce(vendorEmail);
  }, [workspace?.user?.email, dataVersion]);
  const snap = useMemo(() => getCashPlanSnapshot(), [dataVersion]);
  const creditorEntries = useMemo(() => listCreditorEntries(500), [dataVersion]);
  const debtorEntries = useMemo(() => listDebtorEntries(500), [dataVersion]);
  const outstanding = useMemo(() => listOutstandingCreditors(), [dataVersion]);
  const outstandingDebtors = useMemo(() => listOutstandingDebtors(), [dataVersion]);

  const dueRows = useMemo(
    () => outstandingCreditorsWithDueDates(outstanding, creditorEntries),
    [outstanding, creditorEntries, dataVersion],
  );

  const dueByDate = useMemo(() => {
    const m = new Map<string, DueCreditorRow[]>();
    for (const r of dueRows) {
      const arr = m.get(r.dueDateKey) ?? [];
      arr.push(r);
      m.set(r.dueDateKey, arr);
    }
    return m;
  }, [dueRows]);

  const debtorDueRows = useMemo(
    () => outstandingDebtorsWithDueDates(outstandingDebtors, debtorEntries),
    [outstandingDebtors, debtorEntries, dataVersion],
  );

  const debtorDueByDate = useMemo(() => {
    const m = new Map<string, DueDebtorRow[]>();
    for (const r of debtorDueRows) {
      const arr = m.get(r.dueDateKey) ?? [];
      arr.push(r);
      m.set(r.dueDateKey, arr);
    }
    return m;
  }, [debtorDueRows]);

  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

  /** Calendars start collapsed to save vertical space; expand to interact. */
  const [creditorCalendarOpen, setCreditorCalendarOpen] = useState(false);
  const [debtorCalendarOpen, setDebtorCalendarOpen] = useState(false);

  const calendarMonthLabel = useMemo(
    () => new Date(calYear, calMonth, 1).toLocaleString(undefined, { month: "long", year: "numeric" }),
    [calYear, calMonth],
  );

  const [creditorModalOpen, setCreditorModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [payModalMinimized, setPayModalMinimized] = useState(false);
  const [calendarModalMinimized, setCalendarModalMinimized] = useState(false);

  /** supplierId -> partial pay amount when selected */
  const [payAmounts, setPayAmounts] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [calendarModal, setCalendarModal] = useState<{
    dateKey: string;
    kind: "creditor" | "debtor";
  } | null>(null);

  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!calendarModal) return;
    setCalendarModalMinimized(false);
  }, [calendarModal]);

  const submitCreditorDateChange = useCallback(
    (supplierId: string, supplierName: string, iso: string) => {
      const prev = effectiveDueDateKeyForSupplier(supplierId, creditorEntries) ?? undefined;
      if (isCreditorPaymentMissed(supplierId, creditorEntries)) {
        const req = submitScheduleChangeRequest({
          kind: "creditor",
          entityId: supplierId,
          entityName: supplierName,
          proposedDateIso: iso,
          previousDateKey: prev,
        });
        const b = InventoryRepo.getDefaultBranch();
        void emitCashPlanScheduleChangeRequestedBrainEvent({
          requestId: req.id,
          kind: "creditor",
          entityId: supplierId,
          entityName: supplierName,
          proposedDateIso: iso,
          previousDateKey: prev,
          branchId: b.id,
          correlationId: req.id,
        });
        setScheduleNotice(
          "Missed payment date: submitted for approval. The calendar updates after an approver confirms.",
        );
        window.setTimeout(() => setScheduleNotice(null), 9000);
      } else {
        setScheduledNextDueDate(supplierId, iso);
      }
    },
    [creditorEntries],
  );

  const submitDebtorDateChange = useCallback(
    (customerId: string, customerName: string, iso: string) => {
      const prev = effectiveCollectionDateKeyForCustomer(customerId, debtorEntries) ?? undefined;
      if (isDebtorCollectionMissed(customerId, debtorEntries)) {
        const req = submitScheduleChangeRequest({
          kind: "debtor",
          entityId: customerId,
          entityName: customerName,
          proposedDateIso: iso,
          previousDateKey: prev,
        });
        const b = InventoryRepo.getDefaultBranch();
        void emitCashPlanScheduleChangeRequestedBrainEvent({
          requestId: req.id,
          kind: "debtor",
          entityId: customerId,
          entityName: customerName,
          proposedDateIso: iso,
          previousDateKey: prev,
          branchId: b.id,
          correlationId: req.id,
        });
        setScheduleNotice(
          "Missed collection date: submitted for approval. The calendar updates after an approver confirms.",
        );
        window.setTimeout(() => setScheduleNotice(null), 9000);
      } else {
        setScheduledDebtorCollectionDate(customerId, iso);
      }
    },
    [debtorEntries],
  );

  const resetSelection = useCallback(() => {
    const next: Record<string, number> = {};
    const sel = new Set<string>();
    for (const r of outstanding) {
      next[r.supplierId] = r.balance;
      sel.add(r.supplierId);
    }
    setPayAmounts(next);
    setSelectedIds(sel);
  }, [outstanding]);

  useEffect(() => {
    if (creditorModalOpen) resetSelection();
  }, [creditorModalOpen, resetSelection]);

  const openCreditorFlow = () => {
    setPayError(null);
    setCreditorModalOpen(true);
  };

  const scrollToCashPlanCalendars = () => {
    setCreditorCalendarOpen(true);
    setDebtorCalendarOpen(true);
    window.requestAnimationFrame(() => {
      document.getElementById("cashplan-calendars")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const scrollToDebtorCalendar = () => {
    setDebtorCalendarOpen(true);
    window.requestAnimationFrame(() => {
      document.getElementById("debtor-due-calendar")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const toggleSelect = (supplierId: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(supplierId)) n.delete(supplierId);
      else n.add(supplierId);
      return n;
    });
  };

  const goToPayStep = () => {
    setPayError(null);
    const hasOne =
      [...selectedIds].some((id) => (payAmounts[id] ?? 0) > 0);
    if (!hasOne) {
      setPayError("Select at least one creditor and enter a payment amount.");
      return;
    }
    setPayModalOpen(true);
  };

  const buildAllocations = (): CreditorAllocation[] => {
    const out: CreditorAllocation[] = [];
    for (const id of selectedIds) {
      const amt = Math.round(((payAmounts[id] ?? 0) + Number.EPSILON) * 100) / 100;
      if (amt <= 0) continue;
      const row = outstanding.find((o) => o.supplierId === id);
      if (!row) continue;
      out.push({ supplierId: id, supplierName: row.supplierName, amount: amt });
    }
    return out;
  };

  const confirmPay = async () => {
    setPayError(null);
    const allocations = buildAllocations();
    const res = payCreditorsFromCogsReserve(allocations);
    if (!res.ok) {
      setPayError(res.error);
      return;
    }
    const branch = InventoryRepo.getDefaultBranch();
    const corr =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : res.batchId;
    void emitCreditorPaymentBrainEvent({
      batchId: res.batchId,
      total: res.total,
      branchId: branch.id,
      correlationId: corr,
      allocations,
    });
    setPayModalOpen(false);
    setCreditorModalOpen(false);
  };

  const payTotal = useMemo(() => {
    let s = 0;
    for (const id of selectedIds) {
      const amt = payAmounts[id] ?? 0;
      if (amt > 0) s += amt;
    }
    return Math.round(s * 100) / 100;
  }, [selectedIds, payAmounts]);

  const calendarRows = useMemo(() => monthMatrix(calYear, calMonth), [calYear, calMonth]);

  const creditorModalDueOnDay =
    calendarModal?.kind === "creditor" ? dueByDate.get(calendarModal.dateKey) ?? [] : [];
  const debtorModalDueOnDay =
    calendarModal?.kind === "debtor" ? debtorDueByDate.get(calendarModal.dateKey) ?? [] : [];

  return (
    <>
      <DashboardTopBar
        title="CashPlan"
        subtitle="Supplier payables, debtor receivables, and laybye goods — one place to see who owes whom."
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-white/10 px-4 pt-4 sm:px-6">
          <nav className="flex flex-wrap gap-1.5" aria-label="CashPlan views">
            {(
              [
                ["overview", "Overview"],
                ["creditors_ageing", "Creditors ageing"],
                ["debtors_ageing", "Debtors ageing"],
                ["funds_flow", "Funds cash flow"],
                ["cash_utilization", "Cash Utilization"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setCashPlanTab(id)}
                className={`rounded-t-lg border border-b-0 px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                  cashPlanTab === id
                    ? "border-white/20 bg-white/[0.08] text-white"
                    : "border-transparent text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-300"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        {cashPlanTab === "overview" ? (
      <div className="flex-1 space-y-6 px-4 py-6 sm:px-6">
        <p className="max-w-3xl text-sm leading-relaxed text-neutral-500">
          CashPlan rolls up operational cash exposure: what you still owe suppliers, what customers on terms owe you, and
          stock tied to laybye (goods held until final payment). Pay suppliers from COGS Reserves when you have funded
          the reserve from Cash Book or Bank. If a supplier or customer payment date is <span className="text-neutral-300">missed</span> (overdue balance), changing the next date sends a request for approval — Brain notifies staff; the calendar updates only after approval. While you are signed in, we also send at most one email per day to your vendor (sign-in) address listing creditors and debtors due within the next three days (including today), when RESEND_API_KEY is configured; otherwise your mail app may open with the same summary.
        </p>

        {scheduleNotice ? (
          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {scheduleNotice}
          </div>
        ) : null}

        <CashPlanLiquidityDiscipline snap={snap} />

        <CashPlanScheduleApprovalsPanel />

        <CashPlanReserveApprovalsPanel />

        <CashPlanReservesPanel actorLabel={actorLabel} dataVersion={dataVersion} />

        <div className="grid gap-4 lg:grid-cols-3">
          <button
            type="button"
            onClick={openCreditorFlow}
            className="vendor-panel-soft flex cursor-pointer flex-col rounded-2xl p-6 text-left transition hover:ring-2 hover:ring-rose-400/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
          >
            <h2 className="text-xs font-semibold uppercase tracking-wide text-rose-200/90">Suppliers (payables)</h2>
            <p className="mt-2 text-sm text-neutral-400">Open amounts owed to suppliers — unpaid purchasing / GRNI.</p>
            <p className="mt-4 font-mono text-3xl font-bold text-white">{money(snap.supplierPayablesTotal)}</p>
            <p className="mt-4 text-xs text-neutral-500">
              {snap.supplierPayablesTotal <= 0
                ? "No supplier payables on file yet."
                : "Click to review creditors, pay from COGS Reserves, or schedule the next payment."}
            </p>
          </button>

          <button
            type="button"
            onClick={scrollToDebtorCalendar}
            className="vendor-panel-soft flex cursor-pointer flex-col rounded-2xl p-6 text-left transition hover:ring-2 hover:ring-sky-400/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
          >
            <h2 className="text-xs font-semibold uppercase tracking-wide text-sky-200/90">Debtors (receivables)</h2>
            <p className="mt-2 text-sm text-neutral-400">What is owed to you by customers buying on credit.</p>
            <p className="mt-4 font-mono text-3xl font-bold text-white">{money(snap.debtorReceivablesTotal)}</p>
            <p className="mt-4 text-xs text-neutral-500">
              {snap.debtorReceivablesTotal <= 0
                ? "No debtor balances on file yet — open the calendar below to plan collection dates when AR is active."
                : "Click to open the debtor calendar — plan collection dates and print ledger cards."}
            </p>
          </button>

          <section className="vendor-panel-soft flex flex-col rounded-2xl p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">Laybye (goods held)</h2>
            <p className="mt-2 text-sm text-neutral-400">Inventory value reserved for laybye until the customer completes payment.</p>
            <p className="mt-4 font-mono text-3xl font-bold text-white">{money(snap.laybyeGoodsValue)}</p>
            <p className="mt-4 text-xs text-neutral-500">
              {snap.laybyeGoodsValue <= 0
                ? "No active laybye holds yet."
                : "SKU-level holds when laybye checkout is enabled."}
            </p>
          </section>
        </div>

        <div id="cashplan-calendars" className="space-y-6">
        <section id="creditor-due-calendar" className="vendor-panel-soft rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <button
              type="button"
              aria-expanded={creditorCalendarOpen}
              onClick={() => setCreditorCalendarOpen((v) => !v)}
              className="flex min-w-0 flex-1 items-start gap-3 rounded-xl text-left outline-none transition hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-rose-400/50"
            >
              <CollapseChevron expanded={creditorCalendarOpen} />
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-white">Creditor payments due</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Click any date to list every open supplier balance and allocate the next payment date (the day you
                  clicked is suggested until you save a schedule). Highlighted days have at least one payment due or
                  planned.
                </p>
              </div>
            </button>
            {!creditorCalendarOpen ? (
              <span className="shrink-0 text-sm font-medium text-neutral-500">{calendarMonthLabel}</span>
            ) : null}
          </div>

          {creditorCalendarOpen ? (
            <>
              <div className="mt-4 flex justify-end">
                <MonthNav calYear={calYear} calMonth={calMonth} setCalYear={setCalYear} setCalMonth={setCalMonth} />
              </div>
              <CalendarGrid
                calendarRows={calendarRows}
                localDateKey={localDateKey}
                dueByDate={dueByDate}
                accent="rose"
                onPickDay={(key) => setCalendarModal({ dateKey: key, kind: "creditor" })}
              />
            </>
          ) : (
            <p className="mt-3 text-xs text-neutral-500">Collapsed — expand to view the month and pick dates.</p>
          )}
        </section>

        <section id="debtor-due-calendar" className="vendor-panel-soft rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <button
              type="button"
              aria-expanded={debtorCalendarOpen}
              onClick={() => setDebtorCalendarOpen((v) => !v)}
              className="flex min-w-0 flex-1 items-start gap-3 rounded-xl text-left outline-none transition hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-sky-400/50"
            >
              <CollapseChevron expanded={debtorCalendarOpen} />
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-white">Debtor collections due</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Click any date to list every open receivable and allocate the next collection date (the clicked day is
                  suggested until you save). Highlighted days show scheduled or invoice-based collection dates.
                </p>
              </div>
            </button>
            {!debtorCalendarOpen ? (
              <span className="shrink-0 text-sm font-medium text-neutral-500">{calendarMonthLabel}</span>
            ) : null}
          </div>

          {debtorCalendarOpen ? (
            <>
              <div className="mt-4 flex justify-end">
                <MonthNav calYear={calYear} calMonth={calMonth} setCalYear={setCalYear} setCalMonth={setCalMonth} />
              </div>
              <CalendarGrid
                calendarRows={calendarRows}
                localDateKey={localDateKey}
                dueByDate={debtorDueByDate}
                accent="sky"
                onPickDay={(key) => setCalendarModal({ dateKey: key, kind: "debtor" })}
              />
            </>
          ) : (
            <p className="mt-3 text-xs text-neutral-500">Collapsed — expand to view the month and pick dates.</p>
          )}
        </section>
        </div>
      </div>
        ) : null}

        {cashPlanTab === "creditors_ageing" ? (
          <CashPlanCreditorsAgeingTab dataVersion={dataVersion} />
        ) : null}
        {cashPlanTab === "debtors_ageing" ? (
          <CashPlanDebtorsAgeingTab dataVersion={dataVersion} />
        ) : null}
        {cashPlanTab === "funds_flow" ? (
          <CashPlanFundsFlowTab dataVersion={dataVersion} snap={snap} />
        ) : null}
        {cashPlanTab === "cash_utilization" ? (
          <CashPlanCashUtilizationTab dataVersion={dataVersion} snap={snap} />
        ) : null}
      </div>

      {creditorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
          <div className="flex max-h-[92vh] min-h-[min(70vh,820px)] w-full max-w-[min(96vw,84rem)] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 shadow-2xl ring-1 ring-black/5">
            <div className="overflow-y-auto px-6 py-6 sm:px-10 sm:py-8">
            <h3 className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
              Creditors with outstanding balances
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Choose who to pay and how much (defaults to full balance). Payments settle from COGS Reserves only.
            </p>

            {outstanding.length === 0 ? (
              <p className="mt-8 text-sm text-neutral-500">No open supplier balances.</p>
            ) : (
              <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="border-b border-neutral-200 bg-neutral-100/90 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                    <tr>
                      <th className="px-4 py-3">Pay</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3 text-right">Balance</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Next payment</th>
                    </tr>
                  </thead>
                  <tbody className="text-neutral-800">
                    {outstanding.map((r) => (
                      <tr key={r.supplierId} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/80">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(r.supplierId)}
                            onChange={() => toggleSelect(r.supplierId)}
                            className="h-4 w-4 rounded border-neutral-300 text-rose-600 focus:ring-rose-500"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-neutral-900">{r.supplierName}</td>
                        <td className="px-4 py-3 text-right font-mono text-neutral-800">{money(r.balance)}</td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            disabled={!selectedIds.has(r.supplierId)}
                            value={payAmounts[r.supplierId] ?? ""}
                            onChange={(e) =>
                              setPayAmounts((prev) => ({
                                ...prev,
                                [r.supplierId]: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="w-28 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-right font-mono text-neutral-900 shadow-sm disabled:bg-neutral-100 disabled:opacity-50"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="date"
                            value={
                              isoToDateInputValue(getScheduledNextDueDate(r.supplierId)) ||
                              effectiveDueDateKeyForSupplier(r.supplierId, creditorEntries) ||
                              ""
                            }
                            className="w-full min-w-[140px] rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-900 shadow-sm"
                            onChange={(e) => {
                              const v = e.target.value;
                              if (!v) return;
                              submitCreditorDateChange(
                                r.supplierId,
                                r.supplierName,
                                new Date(`${v}T12:00:00`).toISOString(),
                              );
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {payError && <p className="mt-4 text-sm font-medium text-rose-700">{payError}</p>}

            <div className="mt-8 flex flex-wrap gap-3 border-t border-neutral-200/80 pt-6">
              <button
                type="button"
                className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-40"
                disabled={outstanding.length === 0}
                onClick={goToPayStep}
              >
                Continue to payment
              </button>
              <button
                type="button"
                className="rounded-xl border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-100"
                onClick={() => {
                  setCreditorModalOpen(false);
                  scrollToCashPlanCalendars();
                }}
              >
                Skip payment — plan in calendar
              </button>
              <button
                type="button"
                className="rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
                onClick={() => setCreditorModalOpen(false)}
              >
                Close
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {payModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-[min(96vw,56rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Pay from COGS Reserves</h3>
                <p className="mt-1 text-sm text-slate-600">Allocate settlements to suppliers and post the COGS reserve payment.</p>
              </div>
              <WindowControls
                minimized={payModalMinimized}
                onMinimize={() => setPayModalMinimized(true)}
                onRestore={() => setPayModalMinimized(false)}
                onClose={() => setPayModalOpen(false)}
              />
            </div>
            {payModalMinimized ? null : (
              <div className="px-6 py-6">
                <p className="text-sm text-slate-700">
                  Total allocation: <span className="font-mono font-semibold text-slate-900">{money(payTotal)}</span>
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  COGS Reserves balance:{" "}
                  <span className="font-mono font-semibold text-emerald-700">{money(snap.cogsReservesBalance)}</span>
                </p>
            {payTotal > snap.cogsReservesBalance + 1e-9 && (
              <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                This allocation exceeds COGS Reserves. Fund the reserve under Financial → COGS / CashBook before paying.
              </p>
            )}
            {payError && <p className="mt-3 text-sm text-rose-700">{payError}</p>}
            <ul className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700">
              {buildAllocations().map((a) => (
                <li key={a.supplierId} className="flex justify-between border-b border-slate-200 px-3 py-2 last:border-0">
                  <span className="text-slate-800">{a.supplierName}</span>
                  <span className="font-mono font-semibold text-slate-900">{money(a.amount)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
                disabled={payTotal <= 0 || payTotal > snap.cogsReservesBalance + 1e-9}
                onClick={() => void confirmPay()}
              >
                Confirm payment
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setPayModalOpen(false)}
              >
                Back
              </button>
            </div>
              </div>
            )}
          </div>
        </div>
      )}

      {calendarModal?.kind === "creditor" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4">
          <div className="max-h-[94vh] w-full max-w-[min(96vw,84rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Creditor payments — {calendarModal.dateKey}</h3>
                <p className="mt-1 text-sm text-slate-600">
              Every open supplier balance is listed. If the obligation is <span className="text-neutral-200">missed</span>{" "}
              (overdue), your new date is submitted for approval and does not apply until approved. Otherwise it saves
              immediately.
                </p>
              </div>
              <WindowControls
                minimized={calendarModalMinimized}
                onMinimize={() => setCalendarModalMinimized(true)}
                onRestore={() => setCalendarModalMinimized(false)}
                onClose={() => setCalendarModal(null)}
              />
            </div>
            {calendarModalMinimized ? null : (
              <div className="overflow-y-auto px-6 py-6">
            {creditorModalDueOnDay.length > 0 && (
              <p className="mt-2 text-xs text-rose-700">
                {creditorModalDueOnDay.length} creditor(s) already due or scheduled on this date.
              </p>
            )}
            {outstanding.length === 0 ? (
              <p className="mt-6 text-sm text-slate-600">No outstanding supplier payables.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-white text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Supplier</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                      <th className="px-3 py-2">Next payment date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstanding.map((r) => (
                      <tr key={r.supplierId} className="border-b border-slate-200 last:border-0">
                        <td className="px-3 py-2 text-slate-900">{r.supplierName}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">{money(r.balance)}</td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={creditorCalendarDateInputValue(
                              r.supplierId,
                              calendarModal.dateKey,
                              creditorEntries,
                            )}
                            className="w-full min-w-[140px] rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900"
                            onChange={(e) => {
                              const v = e.target.value;
                              if (!v) return;
                              submitCreditorDateChange(
                                r.supplierId,
                                r.supplierName,
                                new Date(`${v}T12:00:00`).toISOString(),
                              );
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                disabled={outstanding.length === 0}
                onClick={() => {
                  const iso = new Date(`${calendarModal.dateKey}T12:00:00`).toISOString();
                  let nPending = 0;
                  let nDirect = 0;
                  const b = InventoryRepo.getDefaultBranch();
                  for (const r of outstanding) {
                    if (isCreditorPaymentMissed(r.supplierId, creditorEntries)) {
                      const prev = effectiveDueDateKeyForSupplier(r.supplierId, creditorEntries) ?? undefined;
                      const req = submitScheduleChangeRequest({
                        kind: "creditor",
                        entityId: r.supplierId,
                        entityName: r.supplierName,
                        proposedDateIso: iso,
                        previousDateKey: prev,
                      });
                      void emitCashPlanScheduleChangeRequestedBrainEvent({
                        requestId: req.id,
                        kind: "creditor",
                        entityId: r.supplierId,
                        entityName: r.supplierName,
                        proposedDateIso: iso,
                        previousDateKey: prev,
                        branchId: b.id,
                        correlationId: req.id,
                      });
                      nPending++;
                    } else {
                      setScheduledNextDueDate(r.supplierId, iso);
                      nDirect++;
                    }
                  }
                  if (nPending > 0) {
                    setScheduleNotice(
                      `Submitted ${nPending} missed creditor date(s) for approval.${nDirect ? ` ${nDirect} updated directly (not overdue).` : ""}`,
                    );
                    window.setTimeout(() => setScheduleNotice(null), 10000);
                  }
                }}
              >
                Apply {calendarModal.dateKey} to all creditors
              </button>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
                disabled={outstanding.length === 0}
                onClick={() => {
                  const key = calendarModal.dateKey;
                  if (creditorModalDueOnDay.length > 0) {
                    openPrintableLedgerReport(`Creditor dues ${key}`, buildDayPrintHtml(key, creditorModalDueOnDay));
                  } else {
                    openPrintableLedgerReport(
                      `Outstanding creditors — ${key}`,
                      buildOutstandingCreditorsPlanningHtml(key, outstanding),
                    );
                  }
                }}
              >
                {creditorModalDueOnDay.length > 0 ? "Print ledger (due this date)" : "Print outstanding (planning)"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setCalendarModal(null)}
              >
                Close
              </button>
            </div>
              </div>
            )}
          </div>
        </div>
      )}

      {calendarModal?.kind === "debtor" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4">
          <div className="max-h-[94vh] w-full max-w-[min(96vw,84rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Debtor collections — {calendarModal.dateKey}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Every open receivable is listed. Missed collection dates follow the same approval rule as creditors:
                  submit for approval; Brain notifies staff; the calendar updates when approved.
                </p>
              </div>
              <WindowControls
                minimized={calendarModalMinimized}
                onMinimize={() => setCalendarModalMinimized(true)}
                onRestore={() => setCalendarModalMinimized(false)}
                onClose={() => setCalendarModal(null)}
              />
            </div>
            {calendarModalMinimized ? null : (
              <div className="overflow-y-auto px-6 py-6">
            {debtorModalDueOnDay.length > 0 && (
              <p className="mt-2 text-xs text-sky-700">
                {debtorModalDueOnDay.length} debtor(s) currently scheduled or due on this date.
              </p>
            )}
            {outstandingDebtors.length === 0 ? (
              <p className="mt-6 text-sm text-slate-600">No outstanding debtor balances yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-white text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                      <th className="px-3 py-2">Next collection date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstandingDebtors.map((r) => (
                      <tr key={r.customerId} className="border-b border-slate-200 last:border-0">
                        <td className="px-3 py-2 text-slate-900">{r.customerName}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">{money(r.balance)}</td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={debtorCalendarDateInputValue(
                              r.customerId,
                              calendarModal.dateKey,
                              debtorEntries,
                            )}
                            className="w-full min-w-[140px] rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900"
                            onChange={(e) => {
                              const v = e.target.value;
                              if (!v) return;
                              submitDebtorDateChange(
                                r.customerId,
                                r.customerName,
                                new Date(`${v}T12:00:00`).toISOString(),
                              );
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/20 disabled:opacity-40"
                disabled={outstandingDebtors.length === 0}
                onClick={() => {
                  const iso = new Date(`${calendarModal.dateKey}T12:00:00`).toISOString();
                  let nPending = 0;
                  let nDirect = 0;
                  const b = InventoryRepo.getDefaultBranch();
                  for (const r of outstandingDebtors) {
                    if (isDebtorCollectionMissed(r.customerId, debtorEntries)) {
                      const prev = effectiveCollectionDateKeyForCustomer(r.customerId, debtorEntries) ?? undefined;
                      const req = submitScheduleChangeRequest({
                        kind: "debtor",
                        entityId: r.customerId,
                        entityName: r.customerName,
                        proposedDateIso: iso,
                        previousDateKey: prev,
                      });
                      void emitCashPlanScheduleChangeRequestedBrainEvent({
                        requestId: req.id,
                        kind: "debtor",
                        entityId: r.customerId,
                        entityName: r.customerName,
                        proposedDateIso: iso,
                        previousDateKey: prev,
                        branchId: b.id,
                        correlationId: req.id,
                      });
                      nPending++;
                    } else {
                      setScheduledDebtorCollectionDate(r.customerId, iso);
                      nDirect++;
                    }
                  }
                  if (nPending > 0) {
                    setScheduleNotice(
                      `Submitted ${nPending} missed debtor date(s) for approval.${nDirect ? ` ${nDirect} updated directly (not overdue).` : ""}`,
                    );
                    window.setTimeout(() => setScheduleNotice(null), 10000);
                  }
                }}
              >
                Apply {calendarModal.dateKey} to all debtors
              </button>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-40"
                disabled={outstandingDebtors.length === 0}
                onClick={() => {
                  const key = calendarModal.dateKey;
                  if (debtorModalDueOnDay.length > 0) {
                    openPrintableLedgerReport(
                      `Debtor collections ${key}`,
                      buildDebtorDayPrintHtml(key, debtorModalDueOnDay),
                    );
                  } else {
                    openPrintableLedgerReport(
                      `Outstanding debtors — ${key}`,
                      buildOutstandingDebtorsPlanningHtml(key, outstandingDebtors),
                    );
                  }
                }}
              >
                {debtorModalDueOnDay.length > 0 ? "Print ledger (due this date)" : "Print outstanding (planning)"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setCalendarModal(null)}
              >
                Close
              </button>
            </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
