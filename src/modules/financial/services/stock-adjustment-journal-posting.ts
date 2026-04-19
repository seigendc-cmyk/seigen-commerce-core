import {
  appendJournalBatchRecordOnly,
  COA_INVENTORY_ASSET_CODE,
  COA_INVENTORY_COUNT_GAIN_CODE,
  COA_INVENTORY_SHRINKAGE_EXPENSE_CODE,
  type JournalLine,
} from "./general-journal-ledger";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Posts GL-only journal: shrinkage → DR expense / CR inventory; overage → DR inventory / CR gain.
 * Call when inventory quantity is already updated (e.g. after stocktake).
 */
export function postStockAdjustmentJournalFromLines(
  stocktakeId: string,
  memo: string,
  lines: { valueImpact: number }[],
): { ok: true } | { ok: false; error: string } {
  let shrink = 0;
  let gain = 0;
  for (const ln of lines) {
    if (ln.valueImpact < 0) shrink += -ln.valueImpact;
    else if (ln.valueImpact > 0) gain += ln.valueImpact;
  }
  shrink = roundMoney(shrink);
  gain = roundMoney(gain);
  const jl: JournalLine[] = [];
  if (shrink > 0) {
    jl.push(
      {
        accountCode: COA_INVENTORY_SHRINKAGE_EXPENSE_CODE,
        accountName: "Inventory shrinkage & waste",
        debit: shrink,
        credit: 0,
      },
      {
        accountCode: COA_INVENTORY_ASSET_CODE,
        accountName: "Merchandise inventory",
        debit: 0,
        credit: shrink,
      },
    );
  }
  if (gain > 0) {
    jl.push(
      {
        accountCode: COA_INVENTORY_ASSET_CODE,
        accountName: "Merchandise inventory",
        debit: gain,
        credit: 0,
      },
      {
        accountCode: COA_INVENTORY_COUNT_GAIN_CODE,
        accountName: "Inventory count gain",
        debit: 0,
        credit: gain,
      },
    );
  }
  if (jl.length === 0) return { ok: true };
  const ref = stocktakeId.length > 10 ? stocktakeId.slice(-10) : stocktakeId;
  const m = memo.trim() || "Stocktake";
  const result = appendJournalBatchRecordOnly({
    memo: `Stock adjustment · ${ref} · ${m}`,
    source: "journal",
    lines: jl,
  });
  if (!result.ok) return result;
  return { ok: true };
}
