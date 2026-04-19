import {
  appendBalancedJournalWithLedgers,
  COA_CASH_CODE,
  COA_BANK_CODE,
  COA_EQUITY_OPENING_CODE,
  COA_MISC_INCOME_CODE,
  type JournalLine,
} from "./general-journal-ledger";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
import {
  postCheckWriterCreditor,
  type PostCheckWriterResult,
} from "./check-writer-posting";

export {
  postCheckWriterCreditor,
  postCheckWriterExpense,
  CHECK_WRITER_EXPENSE_PRESETS,
  formatCostCenterLabel,
} from "./check-writer-posting";

/**
 * Legacy entry point — same as check writer creditor with default check metadata.
 * Prefer `postCheckWriterCreditor` for full cheque fields.
 */
export function postCreditorCheckPayment(input: {
  supplierId: string;
  supplierName: string;
  amount: number;
  fund: "cash" | "bank";
  memo: string;
}): PostCheckWriterResult {
  const today = new Date().toISOString().slice(0, 10);
  return postCheckWriterCreditor({
    fund: input.fund,
    amount: input.amount,
    checkDate: today,
    checkNumber: "—",
    payee: input.supplierName.trim() || "Supplier",
    costCenter: "shop",
    supplierId: input.supplierId,
    supplierName: input.supplierName,
    lineMemo: input.memo,
  });
}

/** Receive external funds into cash or bank with a credit to equity, revenue, or other GL account. */
export function postCashBankReceipt(input: {
  target: "cash" | "bank";
  amount: number;
  memo: string;
  offsetAccountCode: string;
  offsetAccountName: string;
}): { ok: true } | { ok: false; error: string } {
  const amt = roundMoney(input.amount);
  if (amt <= 0) return { ok: false, error: "Enter a positive amount." };

  const assetLine: JournalLine =
    input.target === "cash"
      ? { accountCode: COA_CASH_CODE, accountName: "Cash on hand", debit: amt, credit: 0 }
      : { accountCode: COA_BANK_CODE, accountName: "Bank — primary", debit: amt, credit: 0 };

  const lines: JournalLine[] = [
    assetLine,
    {
      accountCode: input.offsetAccountCode.trim() || COA_MISC_INCOME_CODE,
      accountName: input.offsetAccountName.trim() || "Offset",
      debit: 0,
      credit: amt,
    },
  ];

  return appendBalancedJournalWithLedgers({
    memo: input.memo.trim() || "Receipt",
    source: "receipt",
    lines,
  });
}

export const RECEIPT_OFFSET_PRESETS = [
  { code: COA_EQUITY_OPENING_CODE, name: "Opening balance equity" },
  { code: COA_MISC_INCOME_CODE, name: "Miscellaneous income" },
  { code: "4200", name: "Other revenue" },
] as const;
