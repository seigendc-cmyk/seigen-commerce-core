import { mondayOfWeekContaining, parseDateKey } from "@/modules/cash-plan/services/cash-plan-funds-flow";
import type { FlowPeriod, CashPlanFlowSheet, FlowSheetColumn, FlowSheetRow } from "@/modules/cash-plan/services/cash-plan-funds-flow-sheet";
import type { DueCreditorRow } from "@/modules/financial/services/creditor-due";
import type { DueDebtorRow } from "@/modules/financial/services/debtor-due";
import { listCashBookEntries } from "@/modules/financial/services/cash-book-ledger";
import { listBankAccountEntries } from "@/modules/financial/services/bank-account-ledger";
import { cashBookBalance } from "@/modules/financial/services/cash-book-ledger";
import { bankAccountBalance } from "@/modules/financial/services/bank-account-ledger";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function yearKey(d: Date): string {
  return String(d.getFullYear());
}

function periodKeyForDate(d: Date, period: FlowPeriod): string {
  if (period === "year") return yearKey(d);
  if (period === "month") return monthKey(d);
  const mon = mondayOfWeekContaining(d);
  return localDateKey(mon);
}

function fmtColLabel(key: string, period: FlowPeriod): string {
  if (period === "year") return key;
  if (period === "month") {
    const d = new Date(key + "-01T12:00:00");
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
  }
  const start = parseDateKey(key);
  const end = addDays(start, 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

function windowColumns(period: FlowPeriod, today = new Date()): FlowSheetColumn[] {
  if (period === "year") {
    const y = today.getFullYear();
    return [
      { key: String(y - 1), label: String(y - 1), startIso: new Date(y - 1, 0, 1).toISOString(), endIso: new Date(y - 1, 11, 31).toISOString() },
      { key: String(y), label: String(y), startIso: new Date(y, 0, 1).toISOString(), endIso: new Date(y, 11, 31).toISOString() },
      { key: String(y + 1), label: String(y + 1), startIso: new Date(y + 1, 0, 1).toISOString(), endIso: new Date(y + 1, 11, 31).toISOString() },
    ];
  }
  if (period === "month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const cols: FlowSheetColumn[] = [];
    for (let i = -1; i <= 5; i++) {
      const d = new Date(first.getFullYear(), first.getMonth() + i, 1);
      const k = monthKey(d);
      cols.push({ key: k, label: fmtColLabel(k, "month"), startIso: d.toISOString() });
    }
    return cols;
  }
  const thisMonday = mondayOfWeekContaining(today);
  const cols: FlowSheetColumn[] = [];
  cols.push({ key: localDateKey(addDays(thisMonday, -7)), label: fmtColLabel(localDateKey(addDays(thisMonday, -7)), "week"), startIso: addDays(thisMonday, -7).toISOString() });
  for (let i = 0; i < 6; i++) {
    const start = addDays(thisMonday, i * 7);
    const key = localDateKey(start);
    cols.push({ key, label: fmtColLabel(key, "week"), startIso: start.toISOString() });
  }
  return cols;
}

function addCell(cells: Record<string, number>, k: string, amt: number) {
  cells[k] = roundMoney((cells[k] ?? 0) + amt);
}

function sumCells(cells: Record<string, number>, colKeys: string[]): number {
  let t = 0;
  for (const k of colKeys) t += cells[k] ?? 0;
  return roundMoney(t);
}

function bucketDueRows(rows: Array<{ dueDateKey: string; balance: number }>, period: FlowPeriod, allowed: Set<string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const d = parseDateKey(r.dueDateKey);
    const k = periodKeyForDate(d, period);
    if (!allowed.has(k)) continue;
    addCell(out, k, Math.max(0, r.balance));
  }
  return out;
}

export function buildCashUtilizationSheet(input: {
  period: FlowPeriod;
  creditorRows: DueCreditorRow[];
  debtorRows: DueDebtorRow[];
  today?: Date;
}): CashPlanFlowSheet {
  const today = input.today ?? new Date();
  const columns = windowColumns(input.period, today);
  const colKeys = columns.map((c) => c.key);
  const allowed = new Set(colKeys);

  // Opening balances (current snapshots, shown on first column only; subsequent columns are operational running).
  const openingCash = cashBookBalance();
  const openingBank = bankAccountBalance();

  // Cash in/out itemization per source
  const cashInCash: Record<string, number> = {};
  const cashOutCash: Record<string, number> = {};
  const cashInBank: Record<string, number> = {};
  const cashOutBank: Record<string, number> = {};

  for (const e of listCashBookEntries(600)) {
    const d = new Date(e.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const k = periodKeyForDate(d, input.period);
    if (!allowed.has(k)) continue;
    if (e.amount > 0) addCell(cashInCash, k, e.amount);
    if (e.amount < 0) addCell(cashOutCash, k, Math.abs(e.amount));
  }
  for (const e of listBankAccountEntries(600)) {
    const d = new Date(e.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const k = periodKeyForDate(d, input.period);
    if (!allowed.has(k)) continue;
    if (e.amount > 0) addCell(cashInBank, k, e.amount);
    if (e.amount < 0) addCell(cashOutBank, k, Math.abs(e.amount));
  }

  // Scheduled AR/AP (CashPlan effective dates) for clarity in utilization.
  const arCells = bucketDueRows(input.debtorRows, input.period, allowed);
  const apCells = bucketDueRows(input.creditorRows, input.period, allowed);

  const rows: FlowSheetRow[] = [];

  // Summary headers
  const cashInTotal: Record<string, number> = {};
  const cashOutTotal: Record<string, number> = {};
  for (const k of colKeys) {
    const cin = (cashInCash[k] ?? 0) + (cashInBank[k] ?? 0) + (arCells[k] ?? 0);
    const cout = (cashOutCash[k] ?? 0) + (cashOutBank[k] ?? 0) + (apCells[k] ?? 0);
    cashInTotal[k] = roundMoney(cin);
    cashOutTotal[k] = roundMoney(cout);
  }

  // Operational balance (opening from previous period) and available cash (running).
  const opBalCash: Record<string, number> = {};
  const opBalBank: Record<string, number> = {};
  const availableCash: Record<string, number> = {};
  const availableBank: Record<string, number> = {};
  let runCash = openingCash;
  let runBank = openingBank;
  for (let i = 0; i < colKeys.length; i++) {
    const k = colKeys[i];
    opBalCash[k] = i === 0 ? openingCash : runCash;
    opBalBank[k] = i === 0 ? openingBank : runBank;
    const netCash = roundMoney((cashInCash[k] ?? 0) - (cashOutCash[k] ?? 0));
    const netBank = roundMoney((cashInBank[k] ?? 0) - (cashOutBank[k] ?? 0));
    runCash = roundMoney(runCash + netCash);
    runBank = roundMoney(runBank + netBank);
    availableCash[k] = runCash;
    availableBank[k] = runBank;
  }

  rows.push({ id: "hdr_cash_in", label: "CASH IN", kind: "matrix", cells: cashInTotal, total: sumCells(cashInTotal, colKeys) });
  rows.push({ id: "cash_in_cash", label: "  Cash receipts / deposits (Cash Book)", kind: "revenue", cells: cashInCash, total: sumCells(cashInCash, colKeys) });
  rows.push({ id: "cash_in_bank", label: "  Bank receipts / deposits (Bank)", kind: "revenue", cells: cashInBank, total: sumCells(cashInBank, colKeys) });
  rows.push({ id: "cash_in_ar", label: "  AR collections (scheduled)", kind: "revenue", cells: arCells, total: sumCells(arCells, colKeys) });

  rows.push({ id: "hdr_cash_out", label: "CASH OUT", kind: "matrix", cells: cashOutTotal, total: sumCells(cashOutTotal, colKeys) });
  rows.push({ id: "cash_out_cash", label: "  Cash payments (Cash Book)", kind: "expense", cells: cashOutCash, total: sumCells(cashOutCash, colKeys) });
  rows.push({ id: "cash_out_bank", label: "  Bank payments (Bank)", kind: "expense", cells: cashOutBank, total: sumCells(cashOutBank, colKeys) });
  rows.push({ id: "cash_out_ap", label: "  AP payments (scheduled)", kind: "expense", cells: apCells, total: sumCells(apCells, colKeys) });

  rows.push({ id: "hdr_opbal", label: "Op. Bal (from previous period)", kind: "matrix", cells: {}, total: 0 });
  rows.push({ id: "opbal_cash", label: "  Op. Bal (cash)", kind: "opening", cells: opBalCash, total: opBalCash[colKeys[0]] ?? 0 });
  rows.push({ id: "opbal_bank", label: "  Op. Bal (bank)", kind: "opening", cells: opBalBank, total: opBalBank[colKeys[0]] ?? 0 });

  rows.push({ id: "hdr_available", label: "Available Cash", kind: "matrix", cells: {}, total: 0 });
  rows.push({ id: "avail_cash", label: "  Available cash (running)", kind: "closing", cells: availableCash, total: availableCash[colKeys[colKeys.length - 1]] ?? 0 });
  rows.push({ id: "avail_bank", label: "  Available bank (running)", kind: "closing", cells: availableBank, total: availableBank[colKeys[colKeys.length - 1]] ?? 0 });
  rows.push({
    id: "avail_total",
    label: "  Available total (cash + bank)",
    kind: "closing",
    cells: Object.fromEntries(colKeys.map((k) => [k, roundMoney((availableCash[k] ?? 0) + (availableBank[k] ?? 0))])),
    total: roundMoney((availableCash[colKeys[colKeys.length - 1]] ?? 0) + (availableBank[colKeys[colKeys.length - 1]] ?? 0)),
  });

  return {
    period: input.period,
    columns,
    rows,
    totalsRowLabel: "Available total (end)",
    totals: Object.fromEntries(colKeys.map((k) => [k, roundMoney((availableCash[k] ?? 0) + (availableBank[k] ?? 0))])),
    grandTotal: roundMoney((availableCash[colKeys[colKeys.length - 1]] ?? 0) + (availableBank[colKeys[colKeys.length - 1]] ?? 0)),
  };
}

