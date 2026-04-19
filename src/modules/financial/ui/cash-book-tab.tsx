"use client";

import { useCallback, useMemo, useState } from "react";
import { bankAccountBalance, bankAccountLedgerStorageKey, listBankAccountEntries } from "@/modules/financial/services/bank-account-ledger";
import { cashBookBalance, cashBookLedgerStorageKey, listCashBookEntries } from "@/modules/financial/services/cash-book-ledger";
import { postCashBankReceipt, RECEIPT_OFFSET_PRESETS } from "@/modules/financial/services/cashbook-postings";
import { CheckWriterModal } from "@/modules/financial/ui/check-writer-modal";
import {
  appendBalancedJournalWithLedgers,
  COA_BANK_CODE,
  COA_CASH_CODE,
  generalJournalStorageKey,
  listJournalBatches,
  type JournalLine,
} from "@/modules/financial/services/general-journal-ledger";
import { transferBankToCogsReserves, transferCashToCogsReserves, transferCogsReservesToCash } from "@/modules/financial/services/financial-transfers";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

type JournalDraftLine = { accountCode: string; accountName: string; debit: string; credit: string };

function emptyJournalLine(): JournalDraftLine {
  return { accountCode: "", accountName: "", debit: "", credit: "" };
}

export function CashBookTab({
  tick,
  onRefresh,
}: {
  tick: number;
  onRefresh: () => void;
}) {
  void tick;
  const cashEntries = useMemo(() => listCashBookEntries(100), [tick]);
  const bankEntries = useMemo(() => listBankAccountEntries(100), [tick]);
  const journalBatches = useMemo(() => listJournalBatches(50), [tick]);
  const cashBal = useMemo(() => cashBookBalance(), [tick]);
  const bankBal = useMemo(() => bankAccountBalance(), [tick]);
  const [cashInAmt, setCashInAmt] = useState("");
  const [cashInMemo, setCashInMemo] = useState("");
  const [bankInAmt, setBankInAmt] = useState("");
  const [bankInMemo, setBankInMemo] = useState("");
  const [cogsOutAmt, setCogsOutAmt] = useState("");
  const [cogsOutMemo, setCogsOutMemo] = useState("");
  const [xferMsg, setXferMsg] = useState<string | null>(null);

  const [checkOpen, setCheckOpen] = useState(false);

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [rcTarget, setRcTarget] = useState<"cash" | "bank">("cash");
  const [rcAmt, setRcAmt] = useState("");
  const [rcMemo, setRcMemo] = useState("");
  const [rcPreset, setRcPreset] = useState(0);
  const [rcErr, setRcErr] = useState<string | null>(null);

  const [jrOpen, setJrOpen] = useState(false);
  const [jrMemo, setJrMemo] = useState("");
  const [jrLines, setJrLines] = useState<JournalDraftLine[]>([emptyJournalLine(), emptyJournalLine()]);
  const [jrErr, setJrErr] = useState<string | null>(null);

  const refresh = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-neutral-400">
        Move funds between physical cash, bank, and COGS Reserves. Transfers to COGS increase the inventory pool used to
        pay <span className="text-neutral-200">cash</span> purchase orders. Use the tools below for AP checks, receipts,
        and the general journal (double-entry; codes default to 1010/1020/2100 — align with Settings → COA when wired).
      </p>
      <p className="text-xs text-neutral-500">
        Configure shortcuts under Settings → Cash Book / Bank accounts.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-brand-orange hover:text-brand-orange"
          onClick={() => setCheckOpen(true)}
        >
          Check writer
        </button>
        <button
          type="button"
          className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-brand-orange hover:text-brand-orange"
          onClick={() => {
            setRcErr(null);
            setReceiptOpen(true);
          }}
        >
          Receipt
        </button>
        <button
          type="button"
          className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-brand-orange hover:text-brand-orange"
          onClick={() => {
            setJrErr(null);
            setJrOpen(true);
          }}
        >
          Journal
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="vendor-panel-soft rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-base font-semibold text-white">Cash transactions</h2>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase text-neutral-500">Balance</p>
              <p className="font-mono text-xl font-bold text-white">{money(cashBal)}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-neutral-500 font-mono">{cashBookLedgerStorageKey()}</p>

          <div className="mt-4 space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-semibold text-neutral-300">Transfer cash → COGS Reserves</p>
            <div className="flex flex-wrap gap-2">
              <input
                className="vendor-field min-w-[100px] flex-1 rounded-lg px-2 py-2 text-sm"
                placeholder="Amount"
                type="number"
                min={0}
                step="any"
                value={cashInAmt}
                onChange={(e) => setCashInAmt(e.target.value)}
              />
              <input
                className="vendor-field min-w-[120px] flex-[2] rounded-lg px-2 py-2 text-sm"
                placeholder="Memo"
                value={cashInMemo}
                onChange={(e) => setCashInMemo(e.target.value)}
              />
              <button
                type="button"
                className="rounded-lg bg-brand-orange px-3 py-2 text-sm font-semibold text-white hover:bg-brand-orange-hover"
                onClick={() => {
                  const r = transferCashToCogsReserves(Number(cashInAmt), cashInMemo);
                  if (r.ok) {
                    setCashInAmt("");
                    setCashInMemo("");
                    setXferMsg(null);
                    refresh();
                  } else setXferMsg(r.error);
                }}
              >
                Apply
              </button>
            </div>
          </div>

          <div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white/[0.06] text-neutral-400">
                <tr>
                  <th className="px-2 py-2">When</th>
                  <th className="px-2 py-2">Memo</th>
                  <th className="px-2 py-2 text-right">Amt</th>
                </tr>
              </thead>
              <tbody>
                {cashEntries.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-6 text-center text-neutral-500">
                      No cash entries yet.
                    </td>
                  </tr>
                ) : (
                  cashEntries.map((e) => (
                    <tr key={e.id} className="border-t border-white/10">
                      <td className="px-2 py-2 text-neutral-500">
                        {new Date(e.createdAt).toLocaleDateString(undefined, { dateStyle: "short" })}
                      </td>
                      <td className="px-2 py-2 text-neutral-300">{e.memo}</td>
                      <td className="px-2 py-2 text-right font-mono text-neutral-200">{money(e.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="vendor-panel-soft rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-base font-semibold text-white">Bank account</h2>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase text-neutral-500">Balance</p>
              <p className="font-mono text-xl font-bold text-white">{money(bankBal)}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-neutral-500 font-mono">{bankAccountLedgerStorageKey()}</p>

          <div className="mt-4 space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-semibold text-neutral-300">Transfer bank → COGS Reserves</p>
            <div className="flex flex-wrap gap-2">
              <input
                className="vendor-field min-w-[100px] flex-1 rounded-lg px-2 py-2 text-sm"
                placeholder="Amount"
                type="number"
                min={0}
                step="any"
                value={bankInAmt}
                onChange={(e) => setBankInAmt(e.target.value)}
              />
              <input
                className="vendor-field min-w-[120px] flex-[2] rounded-lg px-2 py-2 text-sm"
                value={bankInMemo}
                onChange={(e) => setBankInMemo(e.target.value)}
                placeholder="Memo"
              />
              <button
                type="button"
                className="rounded-lg bg-brand-orange px-3 py-2 text-sm font-semibold text-white hover:bg-brand-orange-hover"
                onClick={() => {
                  const r = transferBankToCogsReserves(Number(bankInAmt), bankInMemo);
                  if (r.ok) {
                    setBankInAmt("");
                    setBankInMemo("");
                    setXferMsg(null);
                    refresh();
                  } else setXferMsg(r.error);
                }}
              >
                Apply
              </button>
            </div>
          </div>

          <div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white/[0.06] text-neutral-400">
                <tr>
                  <th className="px-2 py-2">When</th>
                  <th className="px-2 py-2">Memo</th>
                  <th className="px-2 py-2 text-right">Amt</th>
                </tr>
              </thead>
              <tbody>
                {bankEntries.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-6 text-center text-neutral-500">
                      No bank entries yet.
                    </td>
                  </tr>
                ) : (
                  bankEntries.map((e) => (
                    <tr key={e.id} className="border-t border-white/10">
                      <td className="px-2 py-2 text-neutral-500">
                        {new Date(e.createdAt).toLocaleDateString(undefined, { dateStyle: "short" })}
                      </td>
                      <td className="px-2 py-2 text-neutral-300">{e.memo}</td>
                      <td className="px-2 py-2 text-right font-mono text-neutral-200">{money(e.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="vendor-panel-soft rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white">Return funds · COGS Reserves → Cash Book</h3>
        <p className="mt-1 text-xs text-neutral-500">Reduces COGS Reserves and increases cash on hand (local model).</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="vendor-field w-32 rounded-lg px-2 py-2 text-sm"
            placeholder="Amount"
            type="number"
            min={0}
            step="any"
            value={cogsOutAmt}
            onChange={(e) => setCogsOutAmt(e.target.value)}
          />
          <input
            className="vendor-field min-w-[160px] flex-1 rounded-lg px-2 py-2 text-sm"
            placeholder="Memo"
            value={cogsOutMemo}
            onChange={(e) => setCogsOutMemo(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-brand-orange"
            onClick={() => {
              const r = transferCogsReservesToCash(Number(cogsOutAmt), cogsOutMemo);
              if (r.ok) {
                setCogsOutAmt("");
                setCogsOutMemo("");
                setXferMsg(null);
                refresh();
              } else setXferMsg(r.error);
            }}
          >
            Apply
          </button>
        </div>
        {xferMsg ? <p className="mt-2 text-xs text-amber-300">{xferMsg}</p> : null}
      </section>

      <section className="vendor-panel-soft rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white">General journal (recent)</h3>
        <p className="mt-1 text-xs text-neutral-500 font-mono">{generalJournalStorageKey()}</p>
        <div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-white/10">
          {journalBatches.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-neutral-500">No journal batches yet.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {journalBatches.map((b) => (
                <li key={b.id} className="px-3 py-3 text-xs">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-neutral-200">{b.memo}</span>
                    <span className="text-neutral-500">
                      {new Date(b.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                      <span className="uppercase">{b.source}</span>
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1 font-mono text-neutral-400">
                    {b.lines.map((l, i) => (
                      <li key={`${b.id}-${i}`}>
                        {l.accountCode} {l.accountName} — DR {money(l.debit)} CR {money(l.credit)}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <CheckWriterModal
        open={checkOpen}
        onClose={() => setCheckOpen(false)}
        onPosted={refresh}
        tick={tick}
      />

      {receiptOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog">
          <div className="vendor-panel max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white">Receipt</h3>
            <p className="mt-2 text-sm text-neutral-400">
              Record cash or bank intake. Debits {COA_CASH_CODE}/{COA_BANK_CODE} and credits the offset account (e.g.
              equity or revenue).
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-neutral-400">
                Deposit to
                <select
                  className="vendor-field mt-1 w-full rounded-lg px-2 py-2 text-sm"
                  value={rcTarget}
                  onChange={(e) => setRcTarget(e.target.value as "cash" | "bank")}
                >
                  <option value="cash">Cash on hand ({COA_CASH_CODE})</option>
                  <option value="bank">Bank ({COA_BANK_CODE})</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-neutral-400">
                Credit (offset)
                <select
                  className="vendor-field mt-1 w-full rounded-lg px-2 py-2 text-sm"
                  value={rcPreset}
                  onChange={(e) => setRcPreset(Number(e.target.value))}
                >
                  {RECEIPT_OFFSET_PRESETS.map((p, i) => (
                    <option key={p.code} value={i}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-neutral-400">
                Amount
                <input
                  className="vendor-field mt-1 w-full rounded-lg px-2 py-2 text-sm"
                  type="number"
                  min={0}
                  step="any"
                  value={rcAmt}
                  onChange={(e) => setRcAmt(e.target.value)}
                />
              </label>
              <label className="block text-xs font-semibold text-neutral-400">
                Memo
                <input
                  className="vendor-field mt-1 w-full rounded-lg px-2 py-2 text-sm"
                  value={rcMemo}
                  onChange={(e) => setRcMemo(e.target.value)}
                />
              </label>
            </div>
            {rcErr ? <p className="mt-3 text-sm text-amber-300">{rcErr}</p> : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-brand-orange"
                onClick={() => setReceiptOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-hover"
                onClick={() => {
                  setRcErr(null);
                  const preset = RECEIPT_OFFSET_PRESETS[rcPreset] ?? RECEIPT_OFFSET_PRESETS[0];
                  const r = postCashBankReceipt({
                    target: rcTarget,
                    amount: Number(rcAmt),
                    memo: rcMemo,
                    offsetAccountCode: preset.code,
                    offsetAccountName: preset.name,
                  });
                  if (!r.ok) {
                    setRcErr(r.error);
                    return;
                  }
                  setReceiptOpen(false);
                  setRcAmt("");
                  setRcMemo("");
                  refresh();
                }}
              >
                Post receipt
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {jrOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog">
          <div className="vendor-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white">General journal</h3>
            <p className="mt-2 text-sm text-neutral-400">
              Balanced entry: total debits must equal total credits. Use account codes{" "}
              <span className="font-mono">{COA_CASH_CODE}</span> (cash) and <span className="font-mono">{COA_BANK_CODE}</span>{" "}
              (bank) to move funds between physical cash and bank; other lines update the GL only (e.g. opening equity).
            </p>
            <label className="mt-4 block text-xs font-semibold text-neutral-400">
              Batch memo
              <input
                className="vendor-field mt-1 w-full rounded-lg px-2 py-2 text-sm"
                value={jrMemo}
                onChange={(e) => setJrMemo(e.target.value)}
                placeholder="e.g. Bank transfer, Opening balance"
              />
            </label>
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-[1fr_1fr_80px_80px] gap-2 text-[10px] font-semibold uppercase text-neutral-500">
                <span>Code</span>
                <span>Name</span>
                <span className="text-right">Debit</span>
                <span className="text-right">Credit</span>
              </div>
              {jrLines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_80px_80px] gap-2">
                  <input
                    className="vendor-field rounded px-2 py-1.5 text-xs font-mono"
                    placeholder="1010"
                    value={line.accountCode}
                    onChange={(e) => {
                      const next = [...jrLines];
                      next[idx] = { ...line, accountCode: e.target.value };
                      setJrLines(next);
                    }}
                  />
                  <input
                    className="vendor-field rounded px-2 py-1.5 text-xs"
                    placeholder="Account name"
                    value={line.accountName}
                    onChange={(e) => {
                      const next = [...jrLines];
                      next[idx] = { ...line, accountName: e.target.value };
                      setJrLines(next);
                    }}
                  />
                  <input
                    className="vendor-field rounded px-2 py-1.5 text-right text-xs font-mono"
                    placeholder="0"
                    value={line.debit}
                    onChange={(e) => {
                      const next = [...jrLines];
                      next[idx] = { ...line, debit: e.target.value };
                      setJrLines(next);
                    }}
                  />
                  <input
                    className="vendor-field rounded px-2 py-1.5 text-right text-xs font-mono"
                    placeholder="0"
                    value={line.credit}
                    onChange={(e) => {
                      const next = [...jrLines];
                      next[idx] = { ...line, credit: e.target.value };
                      setJrLines(next);
                    }}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-brand-orange hover:underline"
              onClick={() => setJrLines([...jrLines, emptyJournalLine()])}
            >
              + Add line
            </button>
            {jrErr ? <p className="mt-3 text-sm text-amber-300">{jrErr}</p> : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-brand-orange"
                onClick={() => setJrOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-hover"
                onClick={() => {
                  setJrErr(null);
                  const lines: JournalLine[] = jrLines
                    .map((l) => ({
                      accountCode: l.accountCode.trim(),
                      accountName: l.accountName.trim(),
                      debit: Number(l.debit) || 0,
                      credit: Number(l.credit) || 0,
                    }))
                    .filter((l) => l.accountCode.length > 0);
                  const r = appendBalancedJournalWithLedgers({
                    memo: jrMemo,
                    source: "journal",
                    lines,
                  });
                  if (!r.ok) {
                    setJrErr(r.error);
                    return;
                  }
                  setJrOpen(false);
                  setJrMemo("");
                  setJrLines([emptyJournalLine(), emptyJournalLine()]);
                  refresh();
                }}
              >
                Post journal
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
