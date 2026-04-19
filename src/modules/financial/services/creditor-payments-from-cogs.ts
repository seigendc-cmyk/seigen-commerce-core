import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import {
  recordCreditorSettlementFromCogs,
  totalCogsReservesBalance,
} from "@/modules/financial/services/cogs-reserves-ledger";
import { balanceBySupplierId, recordCreditorPaymentEntry } from "@/modules/financial/services/creditors-ledger";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function uid(): string {
  return `pay_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export type CreditorAllocation = {
  supplierId: string;
  supplierName: string;
  amount: number;
};

/**
 * Settle supplier AP from COGS Reserves. Fails if COGS balance insufficient or allocation exceeds open AP.
 */
export function payCreditorsFromCogsReserve(
  allocations: CreditorAllocation[],
): { ok: true; batchId: string; total: number } | { ok: false; error: string } {
  const cleaned = allocations
    .map((a) => ({
      supplierId: a.supplierId,
      supplierName: a.supplierName.trim() || "Supplier",
      amount: roundMoney(a.amount),
    }))
    .filter((a) => a.amount > 0);

  if (cleaned.length === 0) {
    return { ok: false, error: "Enter at least one positive payment amount." };
  }

  const total = roundMoney(cleaned.reduce((s, a) => s + a.amount, 0));
  if (total <= 0) {
    return { ok: false, error: "Total payment must be greater than zero." };
  }

  const balances = balanceBySupplierId();
  for (const a of cleaned) {
    const open = balances.get(a.supplierId) ?? 0;
    if (a.amount > open + 1e-9) {
      return {
        ok: false,
        error: `Payment for ${a.supplierName} (${a.amount.toFixed(2)}) exceeds open balance (${open.toFixed(2)}).`,
      };
    }
  }

  const cogs = totalCogsReservesBalance();
  if (total > cogs + 1e-9) {
    return {
      ok: false,
      error: `COGS Reserves (${cogs.toFixed(2)}) is insufficient for this payment (${total.toFixed(2)}). Fund COGS from Financial → CashBook first.`,
    };
  }

  const batchId = uid();
  for (const a of cleaned) {
    const name =
      InventoryRepo.getSupplier(a.supplierId)?.name?.trim() || a.supplierName;
    recordCreditorPaymentEntry({
      supplierId: a.supplierId,
      supplierName: name,
      amount: a.amount,
      paymentBatchId: batchId,
    });
  }

  const memo = `Supplier AP · batch ${batchId.slice(-10)} · ${cleaned.length} supplier(s)`;
  recordCreditorSettlementFromCogs(total, batchId, memo);

  return { ok: true, batchId, total };
}
