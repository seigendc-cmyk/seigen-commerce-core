"use client";

import { useEffect, useMemo, useState } from "react";
import { useTerminalSession } from "../state/terminal-session-context";
import {
  closeTerminalShift,
  getMostRecentClosedTerminalShift,
  getOpenTerminalShift,
  openTerminalShift,
} from "../services/terminal-shift-service";
import { listSales, posSalesStorageKey } from "@/modules/pos/services/sales-service";
import {
  listCashMovementsForShift,
  recordShiftCashMovement,
  totalCashMovementsForShift,
} from "../services/terminal-cash-movement-service";
import { emitTerminalCashMovementRecordedBrainEventDurable } from "@/modules/brain/brain-outbox";
import {
  buildBranchReconciliationPackageV1,
  downloadBranchReconciliationPackageJson,
  readReconLastExportedAt,
  writeReconLastExportedAt,
} from "@/modules/reconciliation/branch-reconciliation-package";
import { ReconImportModal } from "@/modules/reconciliation/ui/recon-import-modal";

export function TerminalShiftPage() {
  const { profile, session, refreshShift, terminalAllows } = useTerminalSession();
  const [openingFloat, setOpeningFloat] = useState("0");
  const [closingCount, setClosingCount] = useState("");
  const [varianceReason, setVarianceReason] = useState("");
  const [cashMoveKind, setCashMoveKind] = useState<"cash_out" | "cash_in" | "paid_out">("paid_out");
  const [cashMoveAmount, setCashMoveAmount] = useState("");
  const [cashMoveMemo, setCashMoveMemo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [showReconImport, setShowReconImport] = useState(false);

  const openShift = profile ? getOpenTerminalShift(profile.id) : null;
  const lastClosedShift = profile ? getMostRecentClosedTerminalShift(profile.id) : null;
  const lastReconExportedAt = profile ? readReconLastExportedAt(profile.branchId as any) : null;

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const onSale = () => bump();
    const onStorage = (e: StorageEvent) => {
      if (e.key === posSalesStorageKey()) bump();
    };
    window.addEventListener("seigen-pos-sale-recorded", onSale);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("seigen-pos-sale-recorded", onSale);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const lastClosedSummary = useMemo(() => {
    void tick;
    if (!profile || !lastClosedShift?.closedAt) return null;
    const from = lastClosedShift.openedAt;
    const to = lastClosedShift.closedAt;
    const sales = listSales().filter(
      (s) =>
        s.status === "completed" &&
        s.surface === "terminal" &&
        s.terminalProfileId === profile.id &&
        s.branchId === lastClosedShift.branchId &&
        s.createdAt >= from &&
        s.createdAt <= to,
    );

    const byMethod = new Map<string, number>();
    let count = 0;
    let grossGoods = 0;
    let delivery = 0;
    let tax = 0;
    let amountDue = 0;
    let totalPaid = 0;
    let changeDue = 0;

    for (const s of sales) {
      count += 1;
      grossGoods += s.subtotal;
      delivery += s.deliveryFee;
      tax += s.salesTaxAmount ?? 0;
      amountDue += s.amountDue;
      totalPaid += s.totalPaid;
      changeDue += s.changeDue;
      for (const p of s.payments ?? []) {
        byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + (Number.isFinite(p.amount) ? p.amount : 0));
      }
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      from,
      to,
      count,
      grossGoods: round(grossGoods),
      delivery: round(delivery),
      tax: round(tax),
      amountDue: round(amountDue),
      totalPaid: round(totalPaid),
      changeDue: round(changeDue),
      byMethod: [...byMethod.entries()].map(([method, amount]) => ({ method, amount: round(amount) })),
    };
  }, [tick, profile, lastClosedShift]);

  const expectedCashForOpenShift = useMemo(() => {
    void tick;
    if (!profile || !openShift) return null;
    const from = openShift.openedAt;
    const sales = listSales().filter(
      (s) =>
        s.status === "completed" &&
        s.surface === "terminal" &&
        s.terminalProfileId === profile.id &&
        s.branchId === openShift.branchId &&
        s.createdAt >= from,
    );
    let cashPaid = 0;
    let changeDue = 0;
    for (const s of sales) {
      changeDue += s.changeDue;
      for (const p of s.payments ?? []) {
        if (p.method === "cash") cashPaid += Number.isFinite(p.amount) ? p.amount : 0;
      }
    }
    const moves = totalCashMovementsForShift(openShift.id);
    const round = (n: number) => Math.round(n * 100) / 100;
    return round(openShift.openingFloat + cashPaid - changeDue + moves.cashIn - moves.cashOut);
  }, [tick, profile, openShift]);

  const cashMovementsForOpenShift = useMemo(() => {
    void tick;
    if (!openShift) return [];
    return listCashMovementsForShift(openShift.id);
  }, [tick, openShift]);

  function openShiftAction() {
    if (!profile || !session) return;
    if (!terminalAllows("terminal.shift.open")) {
      setMsg("Not allowed to open a shift on this terminal.");
      return;
    }
    const v = Number(openingFloat);
    if (!Number.isFinite(v) || v < 0) {
      setMsg("Enter a valid opening float.");
      return;
    }
    openTerminalShift({
      terminalProfileId: profile.id,
      branchId: profile.branchId,
      session,
      openingFloat: v,
      operatorLabel: profile.operatorLabel,
    });
    refreshShift();
    setMsg("Shift opened.");
    setTimeout(() => setMsg(null), 2500);
  }

  function closeShiftAction() {
    if (!profile || !openShift) return;
    if (!terminalAllows("terminal.shift.close")) {
      setMsg("Not allowed to close this shift.");
      return;
    }
    const v = Number(closingCount);
    if (!Number.isFinite(v) || v < 0) {
      setMsg("Enter a valid closing count.");
      return;
    }
    const expected = expectedCashForOpenShift;
    const variance = expected != null ? Math.round((v - expected) * 100) / 100 : null;
    if (variance != null && Math.abs(variance) >= 0.01) {
      const r = varianceReason.trim();
      if (!r) {
        setMsg("Variance reason is required when counted cash differs from expected.");
        return;
      }
    }
    closeTerminalShift(openShift, {
      closingCount: v,
      expectedCashAtClose: expected,
      cashVariance: variance,
      cashVarianceReason: variance != null && Math.abs(variance) >= 0.01 ? varianceReason.trim() : null,
      operatorLabel: profile.operatorLabel,
      tenantId: profile.tenantId,
    });
    refreshShift();
    setClosingCount("");
    setVarianceReason("");
    setMsg("Shift closed.");
    setTimeout(() => setMsg(null), 2500);
  }

  async function recordCashMoveAction() {
    if (!profile || !openShift) return;
    if (!terminalAllows("terminal.cash.movement")) {
      setMsg("Not allowed to record cash movements on this terminal.");
      return;
    }
    const res = recordShiftCashMovement({
      profile,
      shift: openShift,
      kind: cashMoveKind,
      amount: Number(cashMoveAmount),
      memo: cashMoveMemo,
    });
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    const movement = res.movement;
    const correlationId = `cash_move_${movement.id}_${Date.now()}`;
    await emitTerminalCashMovementRecordedBrainEventDurable({
      tenantId: movement.tenantId,
      branchId: String(movement.branchId),
      terminalProfileId: movement.terminalProfileId,
      shiftId: movement.shiftId,
      movementId: movement.id,
      kind: movement.kind,
      amount: movement.amount,
      memo: movement.memo,
      correlationId,
      occurredAt: movement.createdAt,
    });
    setCashMoveAmount("");
    setCashMoveMemo("");
    setTick((t) => t + 1);
    setMsg("Cash movement recorded.");
    setTimeout(() => setMsg(null), 2500);
  }

  return (
    <div className="space-y-4 px-3 py-4">
      {msg ? <p className="rounded-xl bg-slate-900 px-3 py-2 text-center text-sm text-white">{msg}</p> : null}

      {profile ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Drift visibility (multi-terminal)</h2>
          <p className="mt-1 text-xs text-slate-500">
            Export a reconciliation package for this branch when stock seems “off” or when multiple terminals are selling.
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Last export:{" "}
            <span className="font-semibold">
              {lastReconExportedAt ? new Date(lastReconExportedAt).toLocaleString() : "—"}
            </span>
          </p>
          <button
            type="button"
            className="mt-3 w-full rounded-xl border border-slate-300 bg-slate-50 py-3 text-sm font-bold text-slate-900"
            onClick={() => {
              const tenantId = profile.tenantId;
              const branchId = profile.branchId as any;
              const pkg = buildBranchReconciliationPackageV1({ tenantId, branchId });
              const ts = new Date().toISOString().replaceAll(":", "").slice(0, 15);
              downloadBranchReconciliationPackageJson(`recon_${tenantId}_${String(branchId)}_${ts}.json`, pkg);
              writeReconLastExportedAt(branchId, new Date().toISOString());
              setMsg("Reconciliation package exported.");
              setTimeout(() => setMsg(null), 2500);
            }}
          >
            Export reconciliation package (JSON)
          </button>
          <button
            type="button"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white py-3 text-sm font-bold text-slate-900"
            onClick={() => setShowReconImport(true)}
          >
            Import reconciliation package (MVP)
          </button>
        </div>
      ) : null}

      {!openShift && lastClosedSummary ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Last closed shift</h2>
          <p className="mt-1 text-xs text-slate-500">
            {new Date(lastClosedSummary.from).toLocaleString()} → {new Date(lastClosedSummary.to).toLocaleString()}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-800">
            <div>
              <p className="text-xs text-slate-500">Sales</p>
              <p className="font-semibold">{lastClosedSummary.count}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Amount due</p>
              <p className="font-semibold">{lastClosedSummary.amountDue.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Goods</p>
              <p className="font-semibold">{lastClosedSummary.grossGoods.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Tax</p>
              <p className="font-semibold">{lastClosedSummary.tax.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Delivery</p>
              <p className="font-semibold">{lastClosedSummary.delivery.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Change</p>
              <p className="font-semibold">{lastClosedSummary.changeDue.toFixed(2)}</p>
            </div>
          </div>

          {lastClosedSummary.byMethod.length > 0 ? (
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tender breakdown</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-800">
                {lastClosedSummary.byMethod.map((r) => (
                  <li key={r.method} className="flex items-center justify-between">
                    <span className="capitalize">{r.method.replace("_", " ")}</span>
                    <span className="font-semibold">{r.amount.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {!openShift ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Open shift</h2>
          <p className="mt-1 text-xs text-slate-500">Opening float is required before sales.</p>
          <label className="mt-3 block text-xs font-medium text-slate-600" htmlFor="open-float">
            Opening float
          </label>
          <input
            id="open-float"
            type="number"
            min={0}
            step="0.01"
            className="vendor-field mt-1 w-full rounded-xl border border-slate-200 px-4 py-3"
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
          />
          <button
            type="button"
            onClick={() => openShiftAction()}
            className="mt-4 w-full rounded-xl bg-orange-500 py-3 text-sm font-bold text-white"
          >
            Open shift
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Active shift</h2>
          <p className="text-xs text-slate-500">Opened {new Date(openShift.openedAt).toLocaleString()}</p>
          <p className="text-sm text-slate-700">
            Opening float: <span className="font-semibold">{openShift.openingFloat.toFixed(2)}</span>
          </p>
          {expectedCashForOpenShift != null ? (
            <p className="text-sm text-slate-700">
              Expected cash now: <span className="font-semibold">{expectedCashForOpenShift.toFixed(2)}</span>
            </p>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cash movements (this shift)</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select
                className="vendor-field w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                value={cashMoveKind}
                onChange={(e) => setCashMoveKind(e.target.value as any)}
              >
                <option value="paid_out">Paid out</option>
                <option value="cash_out">Cash out (other)</option>
                <option value="cash_in">Cash in (float top-up)</option>
              </select>
              <input
                type="number"
                min={0}
                step="0.01"
                className="vendor-field w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                placeholder="Amount"
                value={cashMoveAmount}
                onChange={(e) => setCashMoveAmount(e.target.value)}
              />
            </div>
            <textarea
              className="vendor-field mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
              rows={2}
              placeholder="Memo (required)"
              value={cashMoveMemo}
              onChange={(e) => setCashMoveMemo(e.target.value)}
            />
            <button
              type="button"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white py-3 text-sm font-bold text-slate-900"
              onClick={() => void recordCashMoveAction()}
            >
              Record cash movement
            </button>

            {cashMovementsForOpenShift.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm text-slate-800">
                {cashMovementsForOpenShift.slice(-6).map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-2">
                    <span className="text-xs text-slate-600">
                      {new Date(m.createdAt).toLocaleTimeString()} · {m.kind === "cash_out" ? "Out" : "In"} · {m.memo}
                    </span>
                    <span className="font-semibold">{m.amount.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-slate-500">No cash movement rows yet.</p>
            )}
          </div>
          <label className="mt-2 block text-xs font-medium text-slate-600" htmlFor="close-count">
            Closing count
          </label>
          <input
            id="close-count"
            type="number"
            min={0}
            step="0.01"
            className="vendor-field mt-1 w-full rounded-xl border border-slate-200 px-4 py-3"
            value={closingCount}
            onChange={(e) => setClosingCount(e.target.value)}
          />
          {expectedCashForOpenShift != null ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Variance reason (if needed)</p>
              <p className="mt-1 text-xs text-slate-600">
                If counted cash differs from expected, record why (paid-outs, float top-up, counting error, etc.).
              </p>
              <textarea
                rows={2}
                value={varianceReason}
                onChange={(e) => setVarianceReason(e.target.value)}
                className="vendor-field mt-2 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm"
                placeholder="Reason for variance…"
              />
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => closeShiftAction()}
            className="mt-3 w-full rounded-xl border border-slate-300 bg-slate-50 py-3 text-sm font-bold text-slate-900"
          >
            Close shift
          </button>
        </div>
      )}

      {profile ? (
        <ReconImportModal
          open={showReconImport}
          onClose={() => setShowReconImport(false)}
          tenantId={profile.tenantId}
          branchId={profile.branchId as any}
          operatorLabel={profile.operatorLabel}
        />
      ) : null}
    </div>
  );
}
