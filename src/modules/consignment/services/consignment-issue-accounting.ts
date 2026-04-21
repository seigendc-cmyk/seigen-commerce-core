import { appendJournalBatchRecordOnly } from "@/modules/financial/services/general-journal-ledger";
import { COA_INVENTORY_ASSET_CODE } from "@/modules/financial/services/general-journal-ledger";
import type { ConsignmentIssueInvoice } from "@/modules/consignment/types/consignment-issue-invoice";

/** Subledger: inventory physically with agent / on consignment (distinct from warehouse SOH). */
export const COA_INVENTORY_ON_CONSIGNMENT_CODE = "1215";
export const COA_INVENTORY_ON_CONSIGNMENT_NAME = "Inventory on consignment (agent custody)";

/**
 * Double entry: stock leaves vendor warehouse custody (CR inventory SOH) and is recognised as
 * inventory held for the agent (DR consignment inventory). Lines balance to invoice total.
 * Traceability: journal memo + documentNumber tie to the consignment issue invoice.
 */
export function postConsignmentIssueInvoiceJournal(input: {
  invoice: ConsignmentIssueInvoice;
  preparedByLabel: string;
}): { ok: true; journalBatchId: string } | { ok: false; error: string } {
  const inv = input.invoice;
  const total = round2(inv.totalValue);
  if (total <= 0) return { ok: false, error: "Invoice total must be positive to post." };

  const memo = `Consignment issue ${inv.documentNumber} → ${inv.agentName} (${inv.agentStallName})`;
  const businessDate = inv.invoiceDate.slice(0, 10);

  const res = appendJournalBatchRecordOnly({
    memo,
    source: "journal",
    documentNumber: inv.documentNumber,
    businessDate,
    preparedBy: input.preparedByLabel,
    lines: [
      {
        accountCode: COA_INVENTORY_ON_CONSIGNMENT_CODE,
        accountName: COA_INVENTORY_ON_CONSIGNMENT_NAME,
        debit: total,
        credit: 0,
      },
      {
        accountCode: COA_INVENTORY_ASSET_CODE,
        accountName: "Inventory — warehouse / stock on hand",
        debit: 0,
        credit: total,
      },
    ],
  });

  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, journalBatchId: res.batch.id };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
