import type { DueCreditorRow } from "@/modules/financial/services/creditor-due";
import type { DueDebtorRow } from "@/modules/financial/services/debtor-due";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Monday 00:00 local of the week containing `d`. */
export function mondayOfWeekContaining(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatWeekLabel(start: Date): string {
  const end = addDays(start, 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

export function parseDateKey(key: string): Date {
  return new Date(key.slice(0, 10) + "T12:00:00");
}

/**
 * Seven calendar weeks (Monday–Sunday): one full week **before** the current week for context, then the **next six
 * weeks** starting with the current ISO week (current + five ahead). Matches “start a week before + six weeks forward.”
 */
export function buildFundsFlowWeekWindows(today = new Date()): { weekStart: Date; label: string }[] {
  const thisMonday = mondayOfWeekContaining(today);
  const out: { weekStart: Date; label: string }[] = [];
  out.push({ weekStart: addDays(thisMonday, -7), label: formatWeekLabel(addDays(thisMonday, -7)) });
  for (let i = 0; i < 6; i++) {
    const weekStart = addDays(thisMonday, i * 7);
    out.push({ weekStart, label: formatWeekLabel(weekStart) });
  }
  return out;
}

function weekIndexForDateKey(dateKey: string, weekStarts: Date[]): number {
  const t = parseDateKey(dateKey).getTime();
  for (let i = 0; i < weekStarts.length; i++) {
    const a = weekStarts[i].getTime();
    const b = addDays(weekStarts[i], 7).getTime();
    if (t >= a && t < b) return i;
  }
  return -1;
}

export type FundsFlowWeekColumn = {
  index: number;
  label: string;
  weekStartIso: string;
  /** Projected collections (AR) attributed to this week from CashPlan effective dates. */
  debtorInflows: number;
  /** Projected supplier payments (AP) attributed to this week from CashPlan effective dates. */
  creditorOutflows: number;
  net: number;
  /** Running liquid after applying this week (starts from openingLiquid). */
  closingLiquid: number;
};

export type FundsFlowProjection = {
  weeks: FundsFlowWeekColumn[];
  /** Balances with effective dates outside the 7-week grid (still outstanding). */
  unscheduledDebtorIn: number;
  unscheduledCreditorOut: number;
  openingLiquid: number;
};

/**
 * Read-only projection: full outstanding balance for each supplier/customer is placed in the week of its
 * **effective** due / collection date (same basis as CashPlan calendars). Does not post payments or change ledgers.
 */
export function buildFundsFlowProjection(input: {
  openingLiquid: number;
  creditorRows: DueCreditorRow[];
  debtorRows: DueDebtorRow[];
  today?: Date;
}): FundsFlowProjection {
  const today = input.today ?? new Date();
  const windows = buildFundsFlowWeekWindows(today);
  const weekStarts = windows.map((w) => w.weekStart);

  const debtorIn = new Array(7).fill(0) as number[];
  const creditorOut = new Array(7).fill(0) as number[];
  let unscheduledDebtorIn = 0;
  let unscheduledCreditorOut = 0;

  for (const r of input.debtorRows) {
    const ix = weekIndexForDateKey(r.dueDateKey, weekStarts);
    if (ix < 0) unscheduledDebtorIn = roundMoney(unscheduledDebtorIn + r.balance);
    else debtorIn[ix] = roundMoney(debtorIn[ix] + r.balance);
  }

  for (const r of input.creditorRows) {
    const ix = weekIndexForDateKey(r.dueDateKey, weekStarts);
    if (ix < 0) unscheduledCreditorOut = roundMoney(unscheduledCreditorOut + r.balance);
    else creditorOut[ix] = roundMoney(creditorOut[ix] + r.balance);
  }

  let running = roundMoney(input.openingLiquid);
  const weeks: FundsFlowWeekColumn[] = [];

  for (let i = 0; i < 7; i++) {
    const di = debtorIn[i];
    const co = creditorOut[i];
    const net = roundMoney(di - co);
    running = roundMoney(running + net);
    weeks.push({
      index: i,
      label: windows[i].label,
      weekStartIso: weekStarts[i].toISOString(),
      debtorInflows: di,
      creditorOutflows: co,
      net,
      closingLiquid: running,
    });
  }

  return {
    weeks,
    unscheduledDebtorIn,
    unscheduledCreditorOut,
    openingLiquid: roundMoney(input.openingLiquid),
  };
}

/**
 * When "respect liquidity" is on: scheduled creditor outflows cannot exceed projected cash at the start of that week
 * (after prior weeks). Unpaid amounts roll forward into the next week’s required outflow (planning aid only).
 */
export function buildFundsFlowProjectionCappedByLiquid(input: {
  openingLiquid: number;
  creditorRows: DueCreditorRow[];
  debtorRows: DueDebtorRow[];
  today?: Date;
}): FundsFlowProjection {
  const base = buildFundsFlowProjection({
    openingLiquid: input.openingLiquid,
    creditorRows: input.creditorRows,
    debtorRows: input.debtorRows,
    today: input.today,
  });

  let carryCreditor = 0;
  let running = base.openingLiquid;
  const weeks: FundsFlowWeekColumn[] = [];

  for (let i = 0; i < 7; i++) {
    const raw = base.weeks[i];
    const di = raw.debtorInflows;
    const scheduledOut = roundMoney(raw.creditorOutflows + carryCreditor);
    const availableBefore = roundMoney(running + di);
    const paidOut = Math.min(Math.max(0, scheduledOut), Math.max(0, availableBefore));
    carryCreditor = roundMoney(scheduledOut - paidOut);
    const net = roundMoney(di - paidOut);
    running = roundMoney(running + net);
    weeks.push({
      ...raw,
      debtorInflows: di,
      creditorOutflows: paidOut,
      net,
      closingLiquid: running,
    });
  }

  return {
    weeks,
    unscheduledDebtorIn: base.unscheduledDebtorIn,
    unscheduledCreditorOut: roundMoney(base.unscheduledCreditorOut + carryCreditor),
    openingLiquid: base.openingLiquid,
  };
}
