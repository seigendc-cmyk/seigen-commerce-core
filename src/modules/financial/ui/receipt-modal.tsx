"use client";

import { useEffect, useMemo, useState } from "react";
import { bankAccountBalance } from "@/modules/financial/services/bank-account-ledger";
import { cashBookBalance } from "@/modules/financial/services/cash-book-ledger";
import { postCashBankReceipt, RECEIPT_OFFSET_PRESETS } from "@/modules/financial/services/cashbook-postings";
import { formatCostCenterLabel } from "@/modules/financial/services/check-writer-posting";
import { COA_BANK_CODE, COA_CASH_CODE } from "@/modules/financial/services/general-journal-ledger";
import { finLight } from "@/modules/financial/ui/financial-light-fields";
import { WindowControls } from "@/components/ui/window-controls";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function ReceiptModal({
  open,
  onClose,
  onPosted,
  tick,
}: {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
  tick: number;
}) {
  void tick;
  const cashBal = useMemo(() => cashBookBalance(), [tick]);
  const bankBal = useMemo(() => bankAccountBalance(), [tick]);

  const [depositTo, setDepositTo] = useState<"cash" | "bank">("bank");
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [documentNumber, setDocumentNumber] = useState("");
  const [payerName, setPayerName] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [costCenter, setCostCenter] = useState<"shop" | "admin">("shop");
  const [presetIdx, setPresetIdx] = useState(0);
  const [lineMemo, setLineMemo] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setMinimized(false);
  }, [open]);

  if (!open) return null;

  const amt = Number(amountStr);
  const amountOk = Number.isFinite(amt) && amt > 0;
  const preset = RECEIPT_OFFSET_PRESETS[presetIdx] ?? RECEIPT_OFFSET_PRESETS[0]!;

  function submit() {
    setErr(null);
    if (!amountOk) {
      setErr("Enter a valid receipt amount.");
      return;
    }
    const r = postCashBankReceipt({
      target: depositTo,
      amount: amt,
      receiptDate,
      documentNumber: documentNumber.trim() || "—",
      payerName: payerName.trim() || "—",
      costCenter,
      lineMemo: lineMemo.trim() || `Credit · ${preset.name}`,
      offsetAccountCode: preset.code,
      offsetAccountName: preset.name,
    });
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    onPosted();
    onClose();
    setAmountStr("");
    setLineMemo("");
    setDocumentNumber("");
    setPayerName("");
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${finLight.backdrop}`} role="dialog">
      <div className={finLight.shell}>
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-600">Deposit voucher</p>
              <h2 className={finLight.title}>Receipt</h2>
              <p className={finLight.subtitle}>
                Record money received into cash or bank. The instrument block below must match the GL credit — one amount
                drives both sides (DR {COA_CASH_CODE} / {COA_BANK_CODE}, CR offset account).
              </p>
            </div>
            <WindowControls
              minimized={minimized}
              onMinimize={() => setMinimized(true)}
              onRestore={() => setMinimized(false)}
              onClose={onClose}
            />
          </div>
        </div>

        {minimized ? null : <div className="space-y-6 px-6 py-6">
          <div className={finLight.instrument}>
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-teal-600/15 blur-2xl" />
            <p className={finLight.label}>Receive into</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-700">
                <span className={finLight.label}>Cash / bank</span>
                <select
                  className={finLight.field}
                  value={depositTo}
                  onChange={(e) => setDepositTo(e.target.value as "cash" | "bank")}
                >
                  <option value="bank">
                    Bank ({COA_BANK_CODE}) — balance {money(bankBal)}
                  </option>
                  <option value="cash">
                    Cash on hand ({COA_CASH_CODE}) — balance {money(cashBal)}
                  </option>
                </select>
              </label>
              <label className="block text-sm text-slate-700">
                <span className={finLight.label}>Receipt date</span>
                <input
                  type="date"
                  className={finLight.field}
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                />
              </label>
              <label className="block text-sm text-slate-700">
                <span className={finLight.label}>Document / reference #</span>
                <input
                  className={`${finLight.field} ${finLight.fieldMono}`}
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="e.g. DEP-1042"
                />
              </label>
              <label className="block text-sm text-slate-700">
                <span className={finLight.label}>Paying person / entity</span>
                <input
                  className={finLight.field}
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  placeholder="Name as on deposit slip or transfer"
                />
              </label>
              <label className="block text-sm text-slate-700">
                <span className={finLight.label}>Amount received</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  className={`${finLight.field} text-lg font-semibold ${finLight.fieldMono}`}
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label className="block text-sm text-slate-700">
                <span className={finLight.label}>Cost center</span>
                <select
                  className={finLight.field}
                  value={costCenter}
                  onChange={(e) => setCostCenter(e.target.value as "shop" | "admin")}
                >
                  <option value="shop">Shop / operations</option>
                  <option value="admin">Admin / head office</option>
                </select>
              </label>
            </div>
          </div>

          <div className={finLight.glPanel}>
            <p className={finLight.label}>Double entry · credit (offset)</p>
            <p className="mt-1 text-sm font-medium text-slate-800">Apply to chart of accounts</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="block text-sm lg:col-span-2 text-slate-700">
                <span className={finLight.label}>Credit account</span>
                <select
                  className={finLight.field}
                  value={presetIdx}
                  onChange={(e) => setPresetIdx(Number(e.target.value))}
                >
                  {RECEIPT_OFFSET_PRESETS.map((p, i) => (
                    <option key={p.code} value={i}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm lg:col-span-2 text-slate-700">
                <span className={finLight.label}>Line memo</span>
                <input
                  className={finLight.field}
                  value={lineMemo}
                  onChange={(e) => setLineMemo(e.target.value)}
                  placeholder="Narrative for the GL and bank statement"
                />
              </label>
            </div>

            <div className={finLight.balanceOk}>
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-slate-600">
                  Debit · {depositTo === "bank" ? `Bank (${COA_BANK_CODE})` : `Cash (${COA_CASH_CODE})`}
                </span>
                <span className={`font-semibold ${finLight.fieldMono}`}>{amountOk ? money(amt) : "—"}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-t border-emerald-200/80 pt-2">
                <span className="text-slate-600">
                  Credit · {preset.code} {preset.name}
                </span>
                <span className={`font-semibold ${finLight.fieldMono}`}>{amountOk ? money(amt) : "—"}</span>
              </div>
              <p className="pt-1 text-center text-[11px] font-medium text-emerald-800">
                Cost center {formatCostCenterLabel(costCenter)} ·{" "}
                {amountOk ? "Balanced — ready to post" : "Enter an amount"}
              </p>
            </div>
          </div>

          {err ? <div className={finLight.err}>{err}</div> : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={onClose} className={finLight.btnGhost}>
              Cancel
            </button>
            <button type="button" disabled={!amountOk} onClick={() => submit()} className={finLight.btnPrimary}>
              Post receipt
            </button>
          </div>
        </div>}
      </div>
    </div>
  );
}
