"use client";

import { useMemo, useState } from "react";
import type { Id } from "@/modules/inventory/types/models";
import type { Sale } from "@/modules/pos/types/pos";
import { returnSale } from "@/modules/pos/services/sales-service";
import { emitPosSaleReturnedBrainEventDurable } from "@/modules/brain/brain-outbox";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

type Props = {
  sale: Sale;
  onClose: () => void;
  onReturned?: () => void;
};

export function PosReturnModal({ sale, onClose, onReturned }: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [qtyByProductId, setQtyByProductId] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const ln of sale.lines) o[ln.productId] = "0";
    return o;
  });

  const picks = useMemo(() => {
    const out: Array<{ productId: Id; qty: number }> = [];
    for (const [pid, raw] of Object.entries(qtyByProductId)) {
      const q = Math.floor(Number(raw));
      if (Number.isFinite(q) && q > 0) out.push({ productId: pid as any, qty: q });
    }
    return out;
  }, [qtyByProductId]);

  const subtotal = useMemo(() => {
    let s = 0;
    for (const p of picks) {
      const ln = sale.lines.find((x) => x.productId === p.productId);
      if (!ln) continue;
      s += (Number(ln.unitPrice) || 0) * p.qty;
    }
    return Math.round(s * 100) / 100;
  }, [picks, sale.lines]);

  async function submit() {
    if (busy) return;
    setMsg(null);
    const r = reason.trim();
    if (!r) {
      setMsg("Return reason is required.");
      return;
    }
    setBusy(true);
    try {
      const res = returnSale({
        saleId: sale.id,
        reason: r,
        lines: picks,
        surface: "desktop",
      });
      if (!res.ok) {
        setMsg(res.error);
        return;
      }

      const corr =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? `pos_return_${crypto.randomUUID()}`
          : `pos_return_${Date.now()}_${Math.random().toString(16).slice(2)}`;

      void emitPosSaleReturnedBrainEventDurable({
        sale,
        returnId: res.ret.id,
        correlationId: corr,
        reason: r,
        returnPayload: {
          subtotal: res.ret.subtotal,
          salesTaxAmount: res.ret.salesTaxAmount,
          taxableNetBase: res.ret.taxableNetBase,
          lineCount: res.ret.lines.length,
          lines: res.ret.lines.map((l) => ({
            productId: l.productId,
            sku: l.sku,
            name: l.name,
            qty: l.qty,
            lineTotal: l.lineTotal,
          })),
        },
      });

      setMsg("Return recorded.");
      onReturned?.();
      window.setTimeout(() => onClose(), 700);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Return against receipt</h2>
            <p className="pos-data-log-muted mt-0.5 text-xs">
              {sale.receiptNumber} · select quantities to return (partial returns allowed)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reason (required)</p>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="e.g. Wrong item, damaged, customer changed mind…"
              autoComplete="off"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-white text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2">Sold qty</th>
                  <th className="px-3 py-2">Return qty</th>
                  <th className="px-3 py-2">Unit price</th>
                  <th className="px-3 py-2">Line</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {sale.lines.map((ln) => {
                  const q = qtyByProductId[ln.productId] ?? "0";
                  const rq = Math.max(0, Math.floor(Number(q) || 0));
                  const line = Math.round((Number(ln.unitPrice) || 0) * rq * 100) / 100;
                  return (
                    <tr key={ln.productId}>
                      <td className="px-3 py-2 font-semibold text-slate-900">
                        <div>{ln.name}</div>
                        <div className="text-xs font-medium text-slate-500">{ln.sku}</div>
                      </td>
                      <td className="px-3 py-2">{ln.unit}</td>
                      <td className="px-3 py-2">{ln.qty}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="w-24 rounded-lg border border-slate-200 px-3 py-2"
                          value={q}
                          onChange={(e) =>
                            setQtyByProductId((prev) => ({ ...prev, [ln.productId]: e.target.value }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2">{money(ln.unitPrice)}</td>
                      <td className="px-3 py-2 font-semibold">{money(line)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-700">
              Subtotal return (goods): <span className="font-bold">{money(subtotal)}</span>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? "…" : "Record return"}
            </button>
          </div>

          {msg ? <p className="text-sm font-semibold text-rose-700">{msg}</p> : null}
        </div>
      </div>
    </div>
  );
}

