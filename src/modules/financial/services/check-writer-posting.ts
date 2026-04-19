import { bankAccountBalance, appendBankAccountEntry } from "./bank-account-ledger";
import type { CostCenterCode } from "./cash-book-ledger";
import { cashBookBalance, appendCashBookEntry } from "./cash-book-ledger";
import { balanceBySupplierId, recordCreditorPaymentEntry } from "./creditors-ledger";
import {
  appendJournalBatchRecordOnly,
  COA_AP_CODE,
  COA_BANK_CODE,
  COA_CASH_CODE,
  type JournalLine,
} from "./general-journal-ledger";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function moneyFmt(n: number): string {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function batchUid(): string {
  return `chk_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export type CostCenter = "shop" | "admin";

export function formatCostCenterLabel(cc: CostCenter): string {
  return cc === "shop" ? "Shop" : "Admin";
}

/** Preset expense / GL lines for check writer (extend when COA is wired to Settings). */
export const CHECK_WRITER_EXPENSE_PRESETS = [
  { code: "6100", name: "Rent expense" },
  { code: "6150", name: "Shop fit-out & maintenance" },
  { code: "6200", name: "Office & supplies" },
  { code: "6250", name: "Marketing & advertising" },
  { code: "6300", name: "Utilities" },
  { code: "6350", name: "Insurance" },
  { code: "6400", name: "Professional fees" },
  { code: "6500", name: "Travel & entertainment" },
  { code: "6600", name: "Bank & payment fees" },
] as const;

function buildCheckMemo(input: {
  checkNumber: string;
  checkDate: string;
  payee: string;
  costCenter: CostCenter;
  detail: string;
}): string {
  const d = input.checkDate.slice(0, 10);
  const num = input.checkNumber.trim() || "—";
  const payee = input.payee.trim() || "—";
  const tail = input.detail.trim();
  return `CHK #${num} · ${d} · ${formatCostCenterLabel(input.costCenter)} · To: ${payee}${tail ? ` · ${tail}` : ""}`;
}

type FundMeta = {
  fund: "cash" | "bank";
  amount: number;
  memo: string;
  checkNumber: string;
  checkDate: string;
  payee: string;
  costCenter: CostCenterCode;
};

function appendFundOutflow(m: FundMeta) {
  const common = {
    memo: m.memo,
    amount: -m.amount,
    kind: "check_payment" as const,
    checkNumber: m.checkNumber,
    checkDate: m.checkDate,
    payee: m.payee,
    costCenter: m.costCenter,
  };
  if (m.fund === "cash") {
    appendCashBookEntry(common);
  } else {
    appendBankAccountEntry(common);
  }
}

export type PostCheckWriterCreditorInput = {
  fund: "cash" | "bank";
  amount: number;
  checkDate: string;
  checkNumber: string;
  payee: string;
  costCenter: CostCenter;
  supplierId: string;
  supplierName: string;
  lineMemo: string;
};

export type PostCheckWriterExpenseInput = {
  fund: "cash" | "bank";
  amount: number;
  checkDate: string;
  checkNumber: string;
  payee: string;
  costCenter: CostCenter;
  expenseAccountCode: string;
  expenseAccountName: string;
  lineMemo: string;
};

export type PostCheckWriterResult = { ok: true } | { ok: false; error: string };

/**
 * Pay a creditor (DR Accounts Payable, CR Cash/Bank) with full check metadata.
 */
export function postCheckWriterCreditor(input: PostCheckWriterCreditorInput): PostCheckWriterResult {
  const amt = roundMoney(input.amount);
  if (amt <= 0) return { ok: false, error: "Enter a positive amount." };

  const owed = balanceBySupplierId().get(input.supplierId) ?? 0;
  if (owed <= 0) return { ok: false, error: "No open balance for this creditor." };
  if (amt > owed) {
    return { ok: false, error: `Amount exceeds open AP (${moneyFmt(owed)}).` };
  }

  const fundBal = input.fund === "cash" ? cashBookBalance() : bankAccountBalance();
  if (amt > fundBal) {
    return {
      ok: false,
      error: `Insufficient ${input.fund === "cash" ? "cash" : "bank"} balance (available ${moneyFmt(fundBal)}).`,
    };
  }

  const paymentBatchId = batchUid();
  const name = input.supplierName.trim() || "Supplier";
  const refHint = `CHK #${input.checkNumber.trim() || "—"} · ${input.checkDate.slice(0, 10)} · ${formatCostCenterLabel(input.costCenter)} · ${name}`;

  recordCreditorPaymentEntry({
    supplierId: input.supplierId,
    supplierName: name,
    amount: amt,
    paymentBatchId,
    referenceHint: refHint,
  });

  const memo = buildCheckMemo({
    checkNumber: input.checkNumber,
    checkDate: input.checkDate,
    payee: input.payee.trim() || name,
    costCenter: input.costCenter,
    detail: input.lineMemo || `AP · ${name}`,
  });

  appendFundOutflow({
    fund: input.fund,
    amount: amt,
    memo,
    checkNumber: input.checkNumber,
    checkDate: input.checkDate,
    payee: input.payee.trim() || name,
    costCenter: input.costCenter,
  });

  const cc = formatCostCenterLabel(input.costCenter);
  const lines: JournalLine[] = [
    {
      accountCode: COA_AP_CODE,
      accountName: `Accounts payable — ${name} · ${cc}`,
      debit: amt,
      credit: 0,
    },
    {
      accountCode: input.fund === "cash" ? COA_CASH_CODE : COA_BANK_CODE,
      accountName: input.fund === "cash" ? `Cash on hand · ${cc}` : `Bank — primary · ${cc}`,
      debit: 0,
      credit: amt,
    },
  ];

  const jr = appendJournalBatchRecordOnly({ memo, source: "check", lines });
  if (!jr.ok) return jr;
  return { ok: true };
}

/**
 * Operating expense (DR expense, CR Cash/Bank). Amounts must match one payment line.
 */
export function postCheckWriterExpense(input: PostCheckWriterExpenseInput): PostCheckWriterResult {
  const amt = roundMoney(input.amount);
  if (amt <= 0) return { ok: false, error: "Enter a positive amount." };

  const fundBal = input.fund === "cash" ? cashBookBalance() : bankAccountBalance();
  if (amt > fundBal) {
    return {
      ok: false,
      error: `Insufficient ${input.fund === "cash" ? "cash" : "bank"} balance (available ${moneyFmt(fundBal)}).`,
    };
  }

  const code = input.expenseAccountCode.trim() || "6000";
  const baseName = input.expenseAccountName.trim() || "Expense";
  const cc = formatCostCenterLabel(input.costCenter);

  const memo = buildCheckMemo({
    checkNumber: input.checkNumber,
    checkDate: input.checkDate,
    payee: input.payee.trim() || "—",
    costCenter: input.costCenter,
    detail: input.lineMemo || baseName,
  });

  appendFundOutflow({
    fund: input.fund,
    amount: amt,
    memo,
    checkNumber: input.checkNumber,
    checkDate: input.checkDate,
    payee: input.payee.trim() || "—",
    costCenter: input.costCenter,
  });

  const lines: JournalLine[] = [
    {
      accountCode: code,
      accountName: `${baseName} · ${cc}`,
      debit: amt,
      credit: 0,
    },
    {
      accountCode: input.fund === "cash" ? COA_CASH_CODE : COA_BANK_CODE,
      accountName: input.fund === "cash" ? `Cash on hand · ${cc}` : `Bank — primary · ${cc}`,
      debit: 0,
      credit: amt,
    },
  ];

  const jr = appendJournalBatchRecordOnly({ memo, source: "check", lines });
  if (!jr.ok) return jr;
  return { ok: true };
}
