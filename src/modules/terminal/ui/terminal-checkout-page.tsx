"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cartAmountDue } from "@/modules/pos/services/delivery-pricing";
import { loadIdeliverProviders } from "@/modules/pos/services/ideliver-repo";
import type { PaymentMethod } from "@/modules/pos/types/pos";
import {
  buildBranchReconciliationPackageV1,
  downloadBranchReconciliationPackageJson,
} from "@/modules/reconciliation/branch-reconciliation-package";
import { useTerminalSession } from "../state/terminal-session-context";
import { useTerminalCart } from "../state/terminal-cart-context";
import { completeTerminalSale } from "../services/terminal-sales-service";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  mobile_money: "Mobile money",
  bank: "Bank",
  other: "Other",
};

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function isContentionStatus(s: string | null): boolean {
  const t = (s ?? "").toLowerCase();
  return t.includes("stock changed while checking out") || t.includes("another terminal may have sold");
}

export function TerminalCheckoutPage() {
  const router = useRouter();
  const { profile, session, accessCode, openShift, terminalAllows } = useTerminalSession();
  const { cart, resetCart } = useTerminalCart();
  const [tenderLines, setTenderLines] = useState<Array<{ id: string; method: PaymentMethod; amount: string }>>([
    { id: "t1", method: "cash", amount: "" },
  ]);
  const [status, setStatus] = useState<string | null>(null);

  const providers = useMemo(() => loadIdeliverProviders(), []);
  const due = useMemo(() => cartAmountDue(cart, providers), [cart, providers]);

  function complete() {
    if (!profile || !session || !openShift) {
      setStatus("Session or shift not available.");
      return;
    }
    if (!terminalAllows("terminal.sale.create")) {
      setStatus("Not permitted to complete sales on this terminal.");
      return;
    }
    const payments = tenderLines
      .map((l) => ({ method: l.method, amount: Number(l.amount) }))
      .filter((p) => Number.isFinite(p.amount) && p.amount > 0);
    const result = completeTerminalSale({
      cart,
      payments,
      branchId: profile.branchId,
      terminalProfileId: profile.id,
      terminalSessionId: session.id,
      operatorLabel: profile.operatorLabel,
    });
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    resetCart();
    setTenderLines([{ id: "t1", method: "cash", amount: "" }]);
    setStatus(`Sale ${result.sale.receiptNumber} complete. Change ${money(result.sale.changeDue)}`);
    setTimeout(() => {
      router.push(`/terminal/${accessCode}/receipts`);
    }, 1200);
  }

  return (
    <div className="space-y-4 px-3 py-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-semibold uppercase text-slate-500">Amount due</div>
        <div className="mt-1 text-3xl font-bold text-slate-900">{money(due)}</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-semibold uppercase text-slate-500">Payment</div>
        <div className="mt-3 space-y-2">
          {tenderLines.map((l, idx) => (
            <div key={l.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <select
                className="vendor-field w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"
                value={l.method}
                onChange={(e) =>
                  setTenderLines((prev) =>
                    prev.map((x) => (x.id === l.id ? { ...x, method: e.target.value as PaymentMethod } : x)),
                  )
                }
              >
                {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_LABELS[m]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step="0.01"
                className="vendor-field w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"
                placeholder="Amount"
                value={l.amount}
                onChange={(e) =>
                  setTenderLines((prev) =>
                    prev.map((x) => (x.id === l.id ? { ...x, amount: e.target.value } : x)),
                  )
                }
              />
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 disabled:opacity-40"
                disabled={tenderLines.length <= 1}
                onClick={() => setTenderLines((prev) => prev.filter((x) => x.id !== l.id))}
                aria-label={`Remove tender line ${idx + 1}`}
              >
                −
              </button>
            </div>
          ))}
          <button
            type="button"
            className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-900"
            onClick={() =>
              setTenderLines((prev) => [
                ...prev,
                { id: `t${Date.now()}`, method: "mobile_money", amount: "" },
              ])
            }
          >
            Add split payment
          </button>
        </div>
      </div>

      {status ? (
        <div className="space-y-2">
          <p className="text-center text-sm text-orange-800">{status}</p>
          {isContentionStatus(status) && profile ? (
            <button
              type="button"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-900 shadow-sm"
              onClick={() => {
                const tenantId = profile.tenantId;
                const branchId = profile.branchId as any;
                const pkg = buildBranchReconciliationPackageV1({ tenantId, branchId });
                const ts = new Date().toISOString().replaceAll(":", "").slice(0, 15);
                downloadBranchReconciliationPackageJson(`recon_${tenantId}_${String(branchId)}_${ts}.json`, pkg);
                setStatus("Reconciliation package exported. Ask supervisor to compare packages (R2 diff).");
                setTimeout(() => setStatus(null), 3500);
              }}
            >
              Export reconciliation package (conflict helper)
            </button>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => complete()}
        disabled={cart.items.length === 0 || !openShift}
        className="w-full rounded-xl bg-orange-500 py-4 text-base font-bold text-white shadow-lg disabled:opacity-40"
      >
        Complete sale
      </button>
    </div>
  );
}
