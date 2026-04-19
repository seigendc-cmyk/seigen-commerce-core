import { appendBankAccountEntry } from "./bank-account-ledger";
import { appendCashBookEntry } from "./cash-book-ledger";
import {
  recordTransferInToCogsFromBank,
  recordTransferInToCogsFromCash,
  recordTransferOutFromCogsToCash,
} from "./cogs-reserves-ledger";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Move funds from physical cash into COGS Reserves (inventory funding). */
export function transferCashToCogsReserves(amount: number, memo?: string): { ok: true } | { ok: false; error: string } {
  const a = roundMoney(amount);
  if (a <= 0) return { ok: false, error: "Amount must be greater than zero." };
  appendCashBookEntry({
    memo: memo?.trim() ? memo.trim() : "Transfer to COGS Reserves",
    amount: -a,
    kind: "transfer_to_cogs",
  });
  recordTransferInToCogsFromCash(a, memo);
  return { ok: true };
}

/** Move funds from bank into COGS Reserves (inventory funding). */
export function transferBankToCogsReserves(amount: number, memo?: string): { ok: true } | { ok: false; error: string } {
  const a = roundMoney(amount);
  if (a <= 0) return { ok: false, error: "Amount must be greater than zero." };
  appendBankAccountEntry({
    memo: memo?.trim() ? memo.trim() : "Transfer to COGS Reserves",
    amount: -a,
    kind: "transfer_to_cogs",
  });
  recordTransferInToCogsFromBank(a, memo);
  return { ok: true };
}

/** Return funds from COGS Reserves to cash (e.g. draw). */
export function transferCogsReservesToCash(amount: number, memo?: string): { ok: true } | { ok: false; error: string } {
  const a = roundMoney(amount);
  if (a <= 0) return { ok: false, error: "Amount must be greater than zero." };
  recordTransferOutFromCogsToCash(a, memo);
  appendCashBookEntry({
    memo: memo?.trim() ? memo.trim() : "Transfer from COGS Reserves",
    amount: a,
    kind: "transfer_from_cogs",
  });
  return { ok: true };
}
