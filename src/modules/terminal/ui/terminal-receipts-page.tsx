"use client";

import { useEffect, useMemo, useState } from "react";
import { listSales } from "@/modules/pos/services/sales-service";
import type { Sale } from "@/modules/pos/types/pos";
import { receiptMetaForLocalSale } from "@/modules/pos/services/receipt-meta";
import { ReceiptDetailPanel } from "@/modules/pos/ui/receipt-detail-panel";
import { voidSale } from "@/modules/pos/services/sales-service";
import { emitPosSaleVoidedBrainEventDurable } from "@/modules/brain/brain-outbox";
import { auditTerminalDesk } from "../services/terminal-audit-desk";
import { useTerminalSession } from "../state/terminal-session-context";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function TerminalReceiptsPage() {
  const { profile, openShift, terminalAllows } = useTerminalSession();
  const [salesTick, setSalesTick] = useState(0);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function correlationId(prefix: string) {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `${prefix}_${crypto.randomUUID()}`
      : `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  useEffect(() => {
    const onSale = () => setSalesTick((t) => t + 1);
    window.addEventListener("seigen-pos-sale-recorded", onSale);
    return () => window.removeEventListener("seigen-pos-sale-recorded", onSale);
  }, []);

  const rows: Sale[] = useMemo(() => {
    void salesTick;
    return listSales().filter((s) => {
      if (s.surface !== "terminal") return false;
      if (!profile) return false;
      return s.terminalProfileId === profile.id;
    });
  }, [profile, salesTick]);

  return (
    <div className="space-y-3 px-3 py-4">
      <p className="text-xs text-slate-500">Receipts from this terminal profile only ({rows.length}).</p>

      {selected ? (
        <div className="space-y-2">
          <ReceiptDetailPanel
            sale={selected}
            meta={receiptMetaForLocalSale(selected)}
            title="Receipt"
            onDismiss={() => setSelected(null)}
            dismissLabel="Back to list"
          />
          {selected.status === "completed" && terminalAllows("terminal.sale.void") ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={voiding}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 hover:border-rose-300 disabled:opacity-60"
                onClick={() => {
                  if (!profile) return;
                  if (!openShift) {
                    setMsg("Open a shift before voiding a sale.");
                    setTimeout(() => setMsg(null), 3500);
                    return;
                  }
                  const reason = window.prompt("Void reason (required).", "");
                  if (reason == null) return;
                  const trimmed = reason.trim();
                  if (!trimmed) {
                    setMsg("Void reason is required.");
                    setTimeout(() => setMsg(null), 3500);
                    return;
                  }
                  setVoiding(true);
                  try {
                    const corr = correlationId("terminal_void");
                    const r = voidSale({
                      saleId: selected.id,
                      reason: trimmed,
                      actorLabel: `Terminal · ${profile.operatorLabel}`,
                    });
                    if (!r.ok) {
                      setMsg(r.error);
                      setTimeout(() => setMsg(null), 4500);
                      return;
                    }
                    setSelected(r.sale);

                    auditTerminalDesk({
                      action: "terminal.sale.voided",
                      actorLabel: profile.operatorLabel,
                      entityType: "sale",
                      entityId: r.sale.id,
                      correlationId: corr,
                      afterState: {
                        receiptNumber: r.sale.receiptNumber,
                        branchId: r.sale.branchId,
                        terminalProfileId: profile.id,
                        voidedReason: trimmed,
                      },
                    });
                    void emitPosSaleVoidedBrainEventDurable({
                      sale: r.sale,
                      correlationId: corr,
                      reason: trimmed,
                      payloadExtras: { terminalProfileId: profile.id },
                    });

                    setMsg("Sale voided.");
                    setTimeout(() => setMsg(null), 2500);
                  } finally {
                    setVoiding(false);
                  }
                }}
              >
                Void this sale
              </button>
              <p className="text-[11px] text-slate-500">Restores stock and removes local ledger effects.</p>
            </div>
          ) : null}
          {msg ? <p className="text-[11px] font-semibold text-rose-700">{msg}</p> : null}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-center text-sm text-slate-500">No terminal sales yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, 40).map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSelected(s)}
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm active:scale-[0.99]"
              >
                <div className="flex justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900">{s.receiptNumber}</div>
                    <div className="text-xs text-slate-500">{new Date(s.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="text-right text-sm font-semibold">{money(s.amountDue)}</div>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Tap to open receipt · Print/PDF/Share available offline
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
