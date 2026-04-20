import { addDays, mondayOfWeekContaining, parseDateKey } from "@/modules/cash-plan/services/cash-plan-funds-flow";
import { cashBookBalance } from "@/modules/financial/services/cash-book-ledger";
import { bankAccountBalance } from "@/modules/financial/services/bank-account-ledger";
import { listCashBookEntries } from "@/modules/financial/services/cash-book-ledger";
import { listBankAccountEntries } from "@/modules/financial/services/bank-account-ledger";
import { listJournalBatches } from "@/modules/financial/services/general-journal-ledger";
import {
  COA_BANK_CODE,
  COA_CASH_CODE,
  COA_INVENTORY_ASSET_CODE,
  COA_MISC_INCOME_CODE,
  type JournalLine,
} from "@/modules/financial/services/general-journal-ledger";
import { listAllReserveMovements, totalCashPlanReserveBalances } from "@/modules/cash-plan/services/cash-plan-reserves";
import { listCogsReservesEntries, totalCogsReservesBalance } from "@/modules/financial/services/cogs-reserves-ledger";
import type { FundsFlowProjection } from "@/modules/cash-plan/services/cash-plan-funds-flow";
import type { CashPlanUserFlowProjection } from "@/modules/cash-plan/services/cash-plan-flow-user-projections";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type FlowPeriod = "week" | "month" | "year";

export type FlowSheetColumn = { key: string; label: string; startIso: string; endIso?: string };

export type FlowSheetRow = {
  id: string;
  label: string;
  kind: "opening" | "revenue" | "expense" | "projection" | "net" | "closing" | "matrix";
  cells: Record<string, number>;
  total: number;
};

export type CashPlanFlowSheet = {
  period: FlowPeriod;
  columns: FlowSheetColumn[];
  rows: FlowSheetRow[];
  totalsRowLabel: string;
  totals: Record<string, number>;
  grandTotal: number;
};

export function formatFlowColumnLabel(key: string, period: FlowPeriod): string {
  return fmtColLabel(key, period);
}

export function normalizeFlowColumnKey(input: string, period: FlowPeriod): string {
  const s = input.trim();
  if (period === "year") {
    const y = /^\d{4}$/.test(s) ? s : String(new Date().getFullYear());
    return y;
  }
  if (period === "month") {
    // YYYY-MM
    if (/^\d{4}-\d{2}$/.test(s)) return s;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  // week -> expect Monday YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return localDateKey(mondayOfWeekContaining(new Date()));
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

function columnKeyForDate(d: Date, period: FlowPeriod): string {
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
  // week
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
  // week: align to existing 7-week window (1 lookback + 6 forward)
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

function sumCells(cells: Record<string, number>, colKeys: string[]): number {
  let t = 0;
  for (const k of colKeys) t += cells[k] ?? 0;
  return roundMoney(t);
}

function journalLineNet(line: JournalLine): number {
  return roundMoney((line.credit ?? 0) - (line.debit ?? 0));
}

function isRevenueLine(l: JournalLine): boolean {
  // Very small local-first heuristic: income codes are 4xxx (and misc income template).
  const code = l.accountCode?.trim() ?? "";
  return code.startsWith("4") || code === COA_MISC_INCOME_CODE;
}

function isExpenseLine(l: JournalLine): boolean {
  // Expense codes are 5xxx+ in this demo COA.
  const code = l.accountCode?.trim() ?? "";
  return code.startsWith("5") || code.startsWith("6") || code.startsWith("7") || code.startsWith("8") || code.startsWith("9");
}

function isCapexAssetLine(l: JournalLine): boolean {
  const code = (l.accountCode || "").trim();
  const name = (l.accountName || "").toLowerCase();
  if (!code) return false;
  // Exclusions: not CAPEX (working capital / liquidity).
  if (code === COA_CASH_CODE || code === COA_BANK_CODE || code === COA_INVENTORY_ASSET_CODE) return false;

  // Heuristic: fixed assets commonly 15xx-18xx (varies) OR named asset keywords.
  if (/^(15|16|17|18)\d{2,}/.test(code)) return true;
  if (/\b(fixed\s+asset|asset|plant|equipment|vehicle|computer|laptop|furniture|fixture|machinery)\b/.test(name)) return true;
  return false;
}

function lineLabel(l: JournalLine): string {
  const name = (l.accountName || "").trim();
  const code = (l.accountCode || "").trim();
  return name ? `${name} (${code})` : code || "Line";
}

function batchDateForGrouping(b: { businessDate?: string; createdAt: string }): Date {
  const key = b.businessDate?.slice(0, 10);
  if (key) {
    const d = new Date(key + "T12:00:00");
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(b.createdAt);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function addToMapCell(map: Record<string, number>, k: string, amount: number) {
  map[k] = roundMoney((map[k] ?? 0) + amount);
}

function sumMovementsByPeriod(
  createdAtIsoAmounts: Array<{ createdAt: string; amount: number }>,
  period: FlowPeriod,
  allowedKeys: string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  const allow = new Set(allowedKeys);
  for (const m of createdAtIsoAmounts) {
    const d = new Date(m.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const k = columnKeyForDate(d, period);
    if (!allow.has(k)) continue;
    addToMapCell(out, k, m.amount);
  }
  return out;
}

export function buildCashPlanFlowSheet(input: {
  period: FlowPeriod;
  fundsFlowProjection: FundsFlowProjection;
  userProjections: CashPlanUserFlowProjection[];
  today?: Date;
}): CashPlanFlowSheet {
  const today = input.today ?? new Date();
  const columns = windowColumns(input.period, today);
  const colKeys = columns.map((c) => c.key);

  const openingLiquid = roundMoney(cashBookBalance() + bankAccountBalance());

  const revenueCells: Record<string, number> = {};
  const expenseCells: Record<string, number> = {};
  const revenueByLabel = new Map<string, Record<string, number>>();
  const expenseByLabel = new Map<string, Record<string, number>>();
  const capexByPeriod: Record<string, number> = {};
  const capexFromJournalsByPeriod: Record<string, number> = {};

  // Cash / bank receipts & payments (typed by kind)
  const cash = listCashBookEntries(500);
  const bank = listBankAccountEntries(500);
  const txs = [
    ...cash.map((e) => ({ ...e, source: "cash" as const })),
    ...bank.map((e) => ({ ...e, source: "bank" as const })),
  ];

  for (const t of txs) {
    const d = new Date(t.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const k = columnKeyForDate(d, input.period);
    if (!colKeys.includes(k)) continue;

    if (t.kind === "receipt") {
      revenueCells[k] = roundMoney((revenueCells[k] ?? 0) + Math.max(0, t.amount));
      const label = `Receipts (${t.source})`;
      if (!revenueByLabel.has(label)) revenueByLabel.set(label, {});
      const cells = revenueByLabel.get(label)!;
      cells[k] = roundMoney((cells[k] ?? 0) + Math.max(0, t.amount));
    } else if (t.kind === "ap_payment" || t.kind === "check_payment") {
      const out = Math.max(0, -t.amount);
      expenseCells[k] = roundMoney((expenseCells[k] ?? 0) + out);
      const label = t.kind === "ap_payment" ? `Supplier payments (${t.source})` : `Checks (${t.source})`;
      if (!expenseByLabel.has(label)) expenseByLabel.set(label, {});
      const cells = expenseByLabel.get(label)!;
      cells[k] = roundMoney((cells[k] ?? 0) + out);
    }

    // CAPEX classification (non-invasive): if user tags a cash/bank outflow memo with "capex",
    // we surface it in a separate matrix row (does not change net calculation).
    if (t.amount < 0 && typeof t.memo === "string" && /(^|\b)capex(\b|$)/i.test(t.memo)) {
      addToMapCell(capexByPeriod, k, Math.max(0, -t.amount));
    }
  }

  // Journal batches (for itemized P&L lines).
  for (const b of listJournalBatches(200)) {
    const d = batchDateForGrouping(b);
    const k = columnKeyForDate(d, input.period);
    if (!colKeys.includes(k)) continue;
    for (const l of b.lines) {
      const net = journalLineNet(l);
      const label = lineLabel(l);

      if (isRevenueLine(l) && net > 0) {
        revenueCells[k] = roundMoney((revenueCells[k] ?? 0) + net);
        if (!revenueByLabel.has(label)) revenueByLabel.set(label, {});
        const cells = revenueByLabel.get(label)!;
        cells[k] = roundMoney((cells[k] ?? 0) + net);
      } else if (isExpenseLine(l) && net < 0) {
        const out = Math.abs(net);
        expenseCells[k] = roundMoney((expenseCells[k] ?? 0) + out);
        if (!expenseByLabel.has(label)) expenseByLabel.set(label, {});
        const cells = expenseByLabel.get(label)!;
        cells[k] = roundMoney((cells[k] ?? 0) + out);
      }

      // CAPEX (auto-detected): debit to a likely fixed-asset account.
      if (l.debit > 0 && isCapexAssetLine(l)) {
        addToMapCell(capexFromJournalsByPeriod, k, l.debit);
      }
    }
  }

  const rows: FlowSheetRow[] = [];

  rows.push({
    id: "opening",
    label: "Opening liquid (cash + bank)",
    kind: "opening",
    cells: Object.fromEntries(colKeys.map((k, i) => [k, i === 0 ? openingLiquid : 0])),
    total: openingLiquid,
  });

  // Revenue section
  for (const [label, cells] of [...revenueByLabel.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    rows.push({ id: `rev:${label}`, label, kind: "revenue", cells, total: sumCells(cells, colKeys) });
  }

  // Expense section
  for (const [label, cells] of [...expenseByLabel.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    rows.push({ id: `exp:${label}`, label, kind: "expense", cells, total: sumCells(cells, colKeys) });
  }

  // User projections (editable)
  for (const p of input.userProjections) {
    rows.push({
      id: `proj:${p.id}`,
      label: p.label,
      kind: "projection",
      cells: Object.fromEntries(colKeys.map((k) => [k, roundMoney(p.cells[k] ?? 0)])),
      total: sumCells(p.cells, colKeys),
    });
  }

  const netCells: Record<string, number> = {};
  for (const k of colKeys) {
    const rev = revenueCells[k] ?? 0;
    const exp = expenseCells[k] ?? 0;
    const projNet = input.userProjections.reduce((s, p) => {
      // For user rows we allow storing values on any period key; when viewing a different period,
      // we bucket them by converting the key into a representative date.
      const v =
        p.cells[k] ??
        (() => {
          let sum = 0;
          for (const [pk, pv] of Object.entries(p.cells)) {
            const d =
              /^\d{4}-\d{2}-\d{2}$/.test(pk) ? parseDateKey(pk) : /^\d{4}-\d{2}$/.test(pk) ? new Date(pk + "-01T12:00:00") : new Date(pk + "-01-01T12:00:00");
            if (columnKeyForDate(d, input.period) === k) sum += pv;
          }
          return sum;
        })();
      return s + (p.direction === "inflow" ? v : -v);
    }, 0);
    netCells[k] = roundMoney(rev - exp + projNet);
  }

  rows.push({ id: "net", label: "Net cash flow", kind: "net", cells: netCells, total: sumCells(netCells, colKeys) });

  const closingCells: Record<string, number> = {};
  let running = 0;
  for (let i = 0; i < colKeys.length; i++) {
    const k = colKeys[i];
    if (i === 0) running = roundMoney(openingLiquid + (netCells[k] ?? 0));
    else running = roundMoney(running + (netCells[k] ?? 0));
    closingCells[k] = running;
  }
  rows.push({
    id: "closing",
    label: "Ending liquid (opening + net, running)",
    kind: "closing",
    cells: closingCells,
    total: closingCells[colKeys[colKeys.length - 1]] ?? 0,
  });

  // ---------------------------
  // Financial matrix (ecosystem)
  // ---------------------------
  const reserveBalance = totalCashPlanReserveBalances();
  const reserveMovements = listAllReserveMovements(500).map((m) => ({ createdAt: m.createdAt, amount: m.amount }));
  const reserveMoveCells = sumMovementsByPeriod(reserveMovements, input.period, colKeys);

  const cogsReserveBalance = totalCogsReservesBalance();
  const cogsMoves = listCogsReservesEntries(500).map((e) => ({ createdAt: e.createdAt, amount: e.totalCogs }));
  const cogsMoveCells = sumMovementsByPeriod(cogsMoves, input.period, colKeys);

  rows.push({
    id: "matrix:capex_tagged",
    label: "CAPEX (tag outflow memo with “CAPEX”)",
    kind: "matrix",
    cells: capexByPeriod,
    total: sumCells(capexByPeriod, colKeys),
  });
  rows.push({
    id: "matrix:capex_journal",
    label: "CAPEX (auto-detected from General Journal asset debits)",
    kind: "matrix",
    cells: capexFromJournalsByPeriod,
    total: sumCells(capexFromJournalsByPeriod, colKeys),
  });
  rows.push({
    id: "matrix:cashplan_reserves_move",
    label: "Reserves account movements (CashPlan discipline)",
    kind: "matrix",
    cells: reserveMoveCells,
    total: sumCells(reserveMoveCells, colKeys),
  });
  rows.push({
    id: "matrix:cashplan_reserves_balance",
    label: "Reserves account balance (held)",
    kind: "matrix",
    cells: Object.fromEntries(colKeys.map((k, i) => [k, i === 0 ? reserveBalance : 0])),
    total: reserveBalance,
  });
  rows.push({
    id: "matrix:cogs_reserves_move",
    label: "COGS Reserves movements (inventory funding pool)",
    kind: "matrix",
    cells: cogsMoveCells,
    total: sumCells(cogsMoveCells, colKeys),
  });
  rows.push({
    id: "matrix:cogs_reserves_balance",
    label: "COGS Reserves balance",
    kind: "matrix",
    cells: Object.fromEntries(colKeys.map((k, i) => [k, i === 0 ? cogsReserveBalance : 0])),
    total: cogsReserveBalance,
  });

  // Totals row in print is net per column.
  const totals = netCells;
  const grandTotal = sumCells(netCells, colKeys);

  return {
    period: input.period,
    columns,
    rows,
    totalsRowLabel: "Net (sum)",
    totals: netCells,
    grandTotal,
  };
}

