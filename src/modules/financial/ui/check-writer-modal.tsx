"use client";

import { useEffect, useMemo, useState } from "react";
import { bankAccountBalance } from "@/modules/financial/services/bank-account-ledger";
import { cashBookBalance } from "@/modules/financial/services/cash-book-ledger";
import {
  CHECK_WRITER_EXPENSE_PRESETS,
  formatCostCenterLabel,
  postCheckWriterCreditor,
  postCheckWriterExpense,
} from "@/modules/financial/services/check-writer-posting";
import { COA_AP_CODE, COA_BANK_CODE, COA_CASH_CODE } from "@/modules/financial/services/general-journal-ledger";
import { listOutstandingCreditors } from "@/modules/financial/services/creditors-ledger";
import { finLight } from "@/modules/financial/ui/financial-light-fields";
import { WindowControls } from "@/components/ui/window-controls";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

type PayMode = "creditor" | "expense";

export function CheckWriterModal({
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
  const creditors = useMemo(() => listOutstandingCreditors(), [tick]);

  const [fund, setFund] = useState<"bank" | "cash">("bank");
  const [checkDate, setCheckDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [checkNumber, setCheckNumber] = useState("");
  const [payee, setPayee] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [costCenter, setCostCenter] = useState<"shop" | "admin">("shop");

  const [mode, setMode] = useState<PayMode>("creditor");
  const [supplierId, setSupplierId] = useState("");
  const [expensePreset, setExpensePreset] = useState(0);
  const [customExpenseCode, setCustomExpenseCode] = useState("");
  const [customExpenseName, setCustomExpenseName] = useState("");
  const [lineMemo, setLineMemo] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setMinimized(false);
    if (creditors.length && !supplierId) {
      setSupplierId(creditors[0]!.supplierId);
      setPayee(creditors[0]!.supplierName);
    }
  }, [open, creditors, supplierId]);

  useEffect(() => {
    if (mode !== "creditor") return;
    const c = creditors.find((x) => x.supplierId === supplierId);
    if (c) setPayee(c.supplierName);
  }, [supplierId, mode, creditors]);

  const amountNum = Number(amountStr);
  const amountOk = Number.isFinite(amountNum) && amountNum > 0;
  const fundBal = fund === "bank" ? bankBal : cashBal;

  const expenseCode =
    CHECK_WRITER_EXPENSE_PRESETS[expensePreset]?.code ?? CHECK_WRITER_EXPENSE_PRESETS[0]!.code;
  const expenseName =
    CHECK_WRITER_EXPENSE_PRESETS[expensePreset]?.name ?? CHECK_WRITER_EXPENSE_PRESETS[0]!.name;

  function submit() {
    setErr(null);
    if (!amountOk) {
      setErr("Enter a valid payment amount.");
      return;
    }
    if (amountNum > fundBal) {
      setErr(`Amount exceeds available ${fund === "bank" ? "bank" : "cash"} balance (${money(fundBal)}).`);
      return;
    }

    if (mode === "creditor") {
      const c = creditors.find((x) => x.supplierId === supplierId);
      if (!c) {
        setErr("Select a creditor with an open AP balance.");
        return;
      }
      const r = postCheckWriterCreditor({
        fund,
        amount: amountNum,
        checkDate,
        checkNumber: checkNumber.trim() || "—",
        payee: payee.trim() || c.supplierName,
        costCenter,
        supplierId: c.supplierId,
        supplierName: c.supplierName,
        lineMemo: lineMemo.trim() || `Payment on account`,
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
    } else {
      const code = customExpenseCode.trim() || expenseCode;
      const name = customExpenseName.trim() || expenseName;
      const r = postCheckWriterExpense({
        fund,
        amount: amountNum,
        checkDate,
        checkNumber: checkNumber.trim() || "—",
        payee: payee.trim() || "—",
        costCenter,
        expenseAccountCode: code,
        expenseAccountName: name,
        lineMemo: lineMemo.trim() || name,
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
    }

    onPosted();
    onClose();
    setAmountStr("");
    setLineMemo("");
    setCheckNumber("");
  }

  if (!open) return null;

  const coaDebitLabel =
    mode === "creditor"
      ? `${COA_AP_CODE} Accounts payable`
      : `${customExpenseCode.trim() || expenseCode} ${customExpenseName.trim() || expenseName}`;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${finLight.backdrop}`} role="dialog">
      <div className={finLight.shell}>
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-600">Payment voucher</p>
              <h2 className={finLight.title}>Check writer</h2>
              <p className={finLight.subtitle}>
                Funds leave the selected cash or bank account and are applied to the GL line below. Debits must equal
                credits — one payment amount drives both sides.
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
            <p className={finLight.label}>Pay from</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-700">
                <span className={finLight.label}>Cash / bank account</span>
                <select className={finLight.field} value={fund} onChange={(e) => setFund(e.target.value as "bank" | "cash")}>
                  <option value="bank">
                    Bank operating ({COA_BANK_CODE}) — {money(bankBal)} available
                  </option>
                  <option value="cash">
                    Cash on hand ({COA_CASH_CODE}) — {money(cashBal)} available
                  </option>
                </select>
              </label>
              <label className="block text-sm text-slate-700">
                <span className={finLight.label}>Payment date</span>
                <input type="date" className={finLight.field} value={checkDate} onChange={(e) => setCheckDate(e.target.value)} />
              </label>
              <label className="block text-sm text-slate-700">
                <span className={finLight.label}>Check / reference #</span>
                <input
                  className={`${finLight.field} ${finLight.fieldMono}`}
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                  placeholder="e.g. 1042"
                />
              </label>
              <label className="block text-sm text-slate-700">
                <span className={finLight.label}>Payee name</span>
                <input
                  className={finLight.field}
                  value={payee}
                  onChange={(e) => setPayee(e.target.value)}
                  placeholder="As printed on the instrument"
                />
              </label>
              <label className="block text-sm text-slate-700">
                <span className={finLight.label}>Amount paid</span>
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <p className={finLight.label}>Double entry</p>
                <p className="text-sm font-medium text-slate-900">Apply to chart of accounts</p>
              </div>
              <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setMode("creditor")}
                  className={
                    mode === "creditor"
                      ? "rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white"
                      : "rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                  }
                >
                  Creditor (AP)
                </button>
                <button
                  type="button"
                  onClick={() => setMode("expense")}
                  className={
                    mode === "expense"
                      ? "rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white"
                      : "rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                  }
                >
                  Expense / GL
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {mode === "creditor" ? (
                <>
                  <label className="block text-sm text-slate-700 lg:col-span-2">
                    <span className={finLight.label}>Accounts payable · creditor</span>
                    <select
                      className={finLight.field}
                      value={supplierId}
                      onChange={(e) => {
                        setSupplierId(e.target.value);
                        const row = creditors.find((c) => c.supplierId === e.target.value);
                        if (row) setPayee(row.supplierName);
                      }}
                    >
                      {creditors.length === 0 ? (
                        <option value="">No outstanding creditors</option>
                      ) : (
                        creditors.map((c) => (
                          <option key={c.supplierId} value={c.supplierId}>
                            {c.supplierName} · open AP {money(c.balance)}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label className="block text-sm text-slate-700 lg:col-span-2">
                    <span className={finLight.label}>Expense account</span>
                    <select className={finLight.field} value={expensePreset} onChange={(e) => setExpensePreset(Number(e.target.value))}>
                      {CHECK_WRITER_EXPENSE_PRESETS.map((p, i) => (
                        <option key={p.code} value={i}>
                          {p.code} — {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm text-slate-700">
                    <span className={finLight.label}>Custom code</span>
                    <input
                      className={`${finLight.field} text-xs ${finLight.fieldMono}`}
                      value={customExpenseCode}
                      onChange={(e) => setCustomExpenseCode(e.target.value)}
                      placeholder="Override code"
                    />
                  </label>
                  <label className="block text-sm text-slate-700">
                    <span className={finLight.label}>Custom name</span>
                    <input
                      className={finLight.field}
                      value={customExpenseName}
                      onChange={(e) => setCustomExpenseName(e.target.value)}
                      placeholder="Override label"
                    />
                  </label>
                </>
              )}

              <label className="block text-sm text-slate-700 lg:col-span-2">
                <span className={finLight.label}>Line memo</span>
                <input
                  className={finLight.field}
                  value={lineMemo}
                  onChange={(e) => setLineMemo(e.target.value)}
                  placeholder="Narrative for the GL and bank statement"
                />
              </label>

              <p className="text-xs text-slate-600 lg:col-span-2">
                Cost center <span className="font-semibold text-slate-800">{formatCostCenterLabel(costCenter)}</span>{" "}
                applies to both the cash/bank leg and the debit line above.
              </p>
            </div>

            <div className={finLight.balanceOk}>
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-slate-600">Debit · {coaDebitLabel}</span>
                <span className={`font-semibold ${finLight.fieldMono}`}>{amountOk ? money(amountNum) : "—"}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-t border-emerald-200/80 pt-2">
                <span className="text-slate-600">
                  Credit · {fund === "bank" ? `Bank (${COA_BANK_CODE})` : `Cash (${COA_CASH_CODE})`}
                </span>
                <span className={`font-semibold ${finLight.fieldMono}`}>{amountOk ? money(amountNum) : "—"}</span>
              </div>
              <p className="pt-1 text-center text-[11px] font-medium text-emerald-800">
                {amountOk ? "Balanced — ready to post" : "Enter an amount to validate"}
              </p>
            </div>
          </div>

          {err ? <div className={finLight.err}>{err}</div> : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={onClose} className={finLight.btnGhost}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!amountOk || (mode === "creditor" && creditors.length === 0)}
              onClick={() => submit()}
              className={finLight.btnPrimary}
            >
              Post check payment
            </button>
          </div>
        </div>}
      </div>
    </div>
  );
}
