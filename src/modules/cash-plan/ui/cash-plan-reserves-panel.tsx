"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CASHPLAN_RESERVES_UPDATED,
  cashPlanReserveAccountsStorageKey,
  cashPlanReserveMovementsStorageKey,
  cashPlanReserveQueueStorageKey,
  countReservesDueWithinDays,
  countReservesUnderfunded,
  createReserveAccount,
  fundReserve,
  listReserveAccounts,
  listReserveBehaviorSignals,
  reserveAccountWithHealth,
  submitReserveMetadataEditRequest,
  submitReserveReleaseRequest,
  submitReserveWithdrawalRequest,
  totalCashPlanReserveBalances,
  transferBetweenReserves,
  type ReserveHealth,
  type ReservePriority,
} from "@/modules/cash-plan/services/cash-plan-reserves";
import {
  emitCashPlanReserveApprovalRequestedBrainEvent,
  emitCashPlanReserveCreatedBrainEvent,
  emitCashPlanReserveFundedBrainEvent,
} from "@/modules/brain/brain-actions";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function healthStyles(h: ReserveHealth): string {
  switch (h) {
    case "healthy":
      return "border-emerald-500/35 bg-emerald-500/10 text-emerald-200";
    case "underfunded":
      return "border-amber-500/35 bg-amber-500/10 text-amber-200";
    case "at_risk":
      return "border-rose-500/40 bg-rose-500/10 text-rose-200";
    default:
      return "border-white/15 bg-white/[0.04] text-neutral-300";
  }
}

function healthLabel(h: ReserveHealth): string {
  switch (h) {
    case "healthy":
      return "Healthy";
    case "underfunded":
      return "Underfunded";
    case "at_risk":
      return "At risk";
    case "on_track":
      return "On track";
    default:
      return h;
  }
}

export type CashPlanReservesPanelProps = {
  actorLabel: string;
  /** Bump when reserves or queue data may have changed (same tab or parent). */
  dataVersion: string;
};

export function CashPlanReservesPanel({ actorLabel, dataVersion }: CashPlanReservesPanelProps) {
  const [tick, setTick] = useState(0);
  const actor = actorLabel.trim() || "User";

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(CASHPLAN_RESERVES_UPDATED, bump);
    const keys = [
      cashPlanReserveAccountsStorageKey(),
      cashPlanReserveMovementsStorageKey(),
      cashPlanReserveQueueStorageKey(),
    ];
    const onStorage = (e: StorageEvent) => {
      if (e.key && keys.includes(e.key)) bump();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CASHPLAN_RESERVES_UPDATED, bump);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    setTick((t) => t + 1);
  }, [dataVersion]);

  const accountsRaw = useMemo(() => listReserveAccounts(), [tick]);
  const withHealth = useMemo(() => accountsRaw.map((a) => reserveAccountWithHealth(a)), [accountsRaw]);
  const totalHeld = useMemo(() => totalCashPlanReserveBalances(), [tick]);
  const underfunded = useMemo(() => countReservesUnderfunded(), [tick]);
  const dueSoon = useMemo(() => countReservesDueWithinDays(7), [tick]);
  const signals = useMemo(() => listReserveBehaviorSignals(12), [tick]);

  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState("");
  const [cPurpose, setCPurpose] = useState("");
  const [cTarget, setCTarget] = useState("");
  const [cDue, setCDue] = useState("");
  const [cPriority, setCPriority] = useState<ReservePriority>("medium");
  const [cNotes, setCNotes] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? withHealth.find((x) => x.id === selectedId) : undefined;

  const [fundAmt, setFundAmt] = useState("");
  const [fundMemo, setFundMemo] = useState("");
  const [xferTo, setXferTo] = useState("");
  const [xferAmt, setXferAmt] = useState("");
  const [xferMemo, setXferMemo] = useState("");
  const [wdAmt, setWdAmt] = useState("");
  const [wdReason, setWdReason] = useState("");
  const [relAmt, setRelAmt] = useState("");
  const [relReason, setRelReason] = useState("");
  const [mTarget, setMTarget] = useState("");
  const [mDue, setMDue] = useState("");
  const [mPurpose, setMPurpose] = useState("");
  const [mReason, setMReason] = useState("");

  const branchName = (id: string) => InventoryRepo.getBranch(id)?.name ?? id;

  return (
    <section className="vendor-panel-soft rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Reserve accounts (discipline)</h2>
          <p className="mt-1 max-w-3xl text-sm text-neutral-400">
            Earmark cash for future obligations (rent, salaries, tax, buffer). Funding here is a planning movement — it
            reduces “free” cash in CashPlan without posting to your bank or till ledgers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen((v) => !v)}
          className="shrink-0 rounded-lg border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/25"
        >
          {createOpen ? "Close form" : "New reserve"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Total in reserves</p>
          <p className="mt-1 font-mono text-xl font-bold text-white">{money(totalHeld)}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">Underfunded / at risk</p>
          <p className="mt-1 font-mono text-xl font-bold text-amber-100">{underfunded}</p>
        </div>
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-200/90">Due within 7 days</p>
          <p className="mt-1 font-mono text-xl font-bold text-sky-100">{dueSoon}</p>
        </div>
      </div>

      {createOpen ? (
        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-medium text-neutral-200">Create reserve</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-neutral-500">
              Name
              <input
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                placeholder="e.g. Rent reserve"
              />
            </label>
            <label className="block text-xs text-neutral-500">
              Priority
              <select
                value={cPriority}
                onChange={(e) => setCPriority(e.target.value as ReservePriority)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label className="col-span-full block text-xs text-neutral-500">
              Purpose
              <input
                value={cPurpose}
                onChange={(e) => setCPurpose(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-neutral-500">
              Target amount (optional)
              <input
                type="number"
                step="0.01"
                min={0}
                value={cTarget}
                onChange={(e) => setCTarget(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-neutral-500">
              Due date (optional)
              <input
                type="date"
                value={cDue}
                onChange={(e) => setCDue(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="col-span-full block text-xs text-neutral-500">
              Notes
              <input
                value={cNotes}
                onChange={(e) => setCNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>
          <button
            type="button"
            className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
            onClick={() => {
              const t = parseFloat(cTarget);
              const row = createReserveAccount({
                name: cName,
                purpose: cPurpose,
                targetAmount: cTarget.trim() && Number.isFinite(t) && t > 0 ? t : null,
                dueDate: cDue.trim() || null,
                priority: cPriority,
                notes: cNotes,
                actorLabel: actor,
              });
              const b = InventoryRepo.getDefaultBranch();
              void emitCashPlanReserveCreatedBrainEvent({
                reserveId: row.id,
                name: row.name,
                purpose: row.purpose,
                targetAmount: row.targetAmount,
                dueDate: row.dueDate,
                priority: row.priority,
                branchId: b.id,
                correlationId: row.id,
              });
              setCName("");
              setCPurpose("");
              setCTarget("");
              setCDue("");
              setCNotes("");
              setSelectedId(row.id);
              setCreateOpen(false);
            }}
          >
            Create reserve
          </button>
        </div>
      ) : null}

      {withHealth.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">No reserve accounts yet — create one to start earmarking cash.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
              <tr>
                <th className="px-3 py-2">Reserve</th>
                <th className="px-3 py-2">Branch</th>
                <th className="px-3 py-2 text-right">Balance</th>
                <th className="px-3 py-2 text-right">Target / gap</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2">Health</th>
                <th className="px-3 py-2">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {withHealth.map((a) => (
                <tr
                  key={a.id}
                  className={`cursor-pointer border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03] ${
                    selectedId === a.id ? "bg-white/[0.06]" : ""
                  }`}
                  onClick={() => {
                    setSelectedId(a.id);
                    setMPurpose(a.purpose);
                    setMTarget(a.targetAmount != null ? String(a.targetAmount) : "");
                    setMDue(a.dueDate ?? "");
                  }}
                >
                  <td className="px-3 py-2">
                    <p className="font-medium text-neutral-100">{a.name}</p>
                    <p className="text-xs text-neutral-500">{a.purpose}</p>
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-400">{branchName(a.branchId)}</td>
                  <td className="px-3 py-2 text-right font-mono text-neutral-200">{money(a.balance)}</td>
                  <td className="px-3 py-2 text-right text-xs text-neutral-400">
                    {a.targetAmount != null ? `${money(a.targetAmount)} · need ${money(a.amountStillNeeded ?? 0)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-400">{a.dueDate ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${healthStyles(a.health)}`}>
                      {healthLabel(a.health)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-500">
                    {a.lastDepositAt ? `In: ${new Date(a.lastDepositAt).toLocaleDateString()}` : "—"}
                    <br />
                    {a.lastWithdrawalAt ? `Out: ${new Date(a.lastWithdrawalAt).toLocaleDateString()}` : ""}
                    <br />
                    <span className="text-neutral-600">by {a.lastChangedByLabel}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <div className="mt-6 space-y-5 rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-4">
          <p className="text-sm font-semibold text-violet-100">Actions — {selected.name}</p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
              <p className="text-[10px] font-semibold uppercase text-neutral-500">Fund (immediate)</p>
              <input
                type="number"
                step="0.01"
                min={0}
                value={fundAmt}
                onChange={(e) => setFundAmt(e.target.value)}
                placeholder="Amount"
                className="mt-2 w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white"
              />
              <input
                value={fundMemo}
                onChange={(e) => setFundMemo(e.target.value)}
                placeholder="Memo"
                className="mt-2 w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white"
              />
              <button
                type="button"
                className="mt-2 w-full rounded bg-emerald-600/90 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                onClick={() => {
                  const n = parseFloat(fundAmt);
                  if (!Number.isFinite(n) || n <= 0) return;
                  const res = fundReserve({
                    reserveId: selected.id,
                    amount: n,
                    memo: fundMemo,
                    actorLabel: actor,
                  });
                  if (!res.ok) return;
                  const corr =
                    typeof crypto !== "undefined" && "randomUUID" in crypto
                      ? crypto.randomUUID()
                      : `${selected.id}-fund`;
                  void emitCashPlanReserveFundedBrainEvent({
                    reserveId: selected.id,
                    reserveName: selected.name,
                    amount: n,
                    branchId: selected.branchId,
                    correlationId: corr,
                  });
                  setFundAmt("");
                  setFundMemo("");
                }}
              >
                Apply funding
              </button>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
              <p className="text-[10px] font-semibold uppercase text-neutral-500">Transfer (immediate)</p>
              <select
                value={xferTo}
                onChange={(e) => setXferTo(e.target.value)}
                className="mt-2 w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white"
              >
                <option value="">To reserve…</option>
                {withHealth
                  .filter((x) => x.id !== selected.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
              <input
                type="number"
                step="0.01"
                min={0}
                value={xferAmt}
                onChange={(e) => setXferAmt(e.target.value)}
                placeholder="Amount"
                className="mt-2 w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white"
              />
              <input
                value={xferMemo}
                onChange={(e) => setXferMemo(e.target.value)}
                placeholder="Memo"
                className="mt-2 w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white"
              />
              <button
                type="button"
                className="mt-2 w-full rounded bg-white/10 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
                onClick={() => {
                  const n = parseFloat(xferAmt);
                  if (!xferTo || !Number.isFinite(n) || n <= 0) return;
                  transferBetweenReserves({
                    fromReserveId: selected.id,
                    toReserveId: xferTo,
                    amount: n,
                    memo: xferMemo,
                    actorLabel: actor,
                  });
                  setXferAmt("");
                  setXferMemo("");
                }}
              >
                Transfer
              </button>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
              <p className="text-[10px] font-semibold uppercase text-neutral-500">Withdraw (approval)</p>
              <input
                type="number"
                step="0.01"
                min={0}
                value={wdAmt}
                onChange={(e) => setWdAmt(e.target.value)}
                placeholder="Amount"
                className="mt-2 w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white"
              />
              <input
                value={wdReason}
                onChange={(e) => setWdReason(e.target.value)}
                placeholder="Reason"
                className="mt-2 w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white"
              />
              <button
                type="button"
                className="mt-2 w-full rounded bg-amber-600/80 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                onClick={() => {
                  const n = parseFloat(wdAmt);
                  if (!Number.isFinite(n) || n <= 0) return;
                  const r = submitReserveWithdrawalRequest({
                    reserveId: selected.id,
                    amount: n,
                    reason: wdReason,
                    requestedByLabel: actor,
                  });
                  if (!r.ok) return;
                  void emitCashPlanReserveApprovalRequestedBrainEvent({
                    requestId: r.request.id,
                    approvalKind: r.request.kind,
                    reserveId: selected.id,
                    reserveName: selected.name,
                    branchId: selected.branchId,
                    amount: n,
                    correlationId: r.request.id,
                  });
                  setWdAmt("");
                  setWdReason("");
                }}
              >
                Submit request
              </button>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
              <p className="text-[10px] font-semibold uppercase text-neutral-500">Release to free cash (approval)</p>
              <input
                type="number"
                step="0.01"
                min={0}
                value={relAmt}
                onChange={(e) => setRelAmt(e.target.value)}
                placeholder="Amount"
                className="mt-2 w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white"
              />
              <input
                value={relReason}
                onChange={(e) => setRelReason(e.target.value)}
                placeholder="Reason"
                className="mt-2 w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white"
              />
              <button
                type="button"
                className="mt-2 w-full rounded bg-rose-600/80 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"
                onClick={() => {
                  const n = parseFloat(relAmt);
                  if (!Number.isFinite(n) || n <= 0) return;
                  const r = submitReserveReleaseRequest({
                    reserveId: selected.id,
                    amount: n,
                    reason: relReason,
                    requestedByLabel: actor,
                  });
                  if (!r.ok) return;
                  void emitCashPlanReserveApprovalRequestedBrainEvent({
                    requestId: r.request.id,
                    approvalKind: r.request.kind,
                    reserveId: selected.id,
                    reserveName: selected.name,
                    branchId: selected.branchId,
                    amount: n,
                    correlationId: r.request.id,
                  });
                  setRelAmt("");
                  setRelReason("");
                }}
              >
                Submit request
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <p className="text-[10px] font-semibold uppercase text-neutral-500">Edit target / due / purpose (approval)</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <input
                type="number"
                step="0.01"
                min={0}
                value={mTarget}
                onChange={(e) => setMTarget(e.target.value)}
                placeholder="New target (blank = clear)"
                className="rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white"
              />
              <input
                type="date"
                value={mDue}
                onChange={(e) => setMDue(e.target.value)}
                className="rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white"
              />
              <input
                value={mPurpose}
                onChange={(e) => setMPurpose(e.target.value)}
                placeholder="Purpose"
                className="rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white"
              />
            </div>
            <input
              value={mReason}
              onChange={(e) => setMReason(e.target.value)}
              placeholder="Reason for change"
              className="mt-2 w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white"
            />
            <button
              type="button"
              className="mt-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-neutral-200 hover:bg-white/10"
              onClick={() => {
                const mt = mTarget.trim();
                const nt =
                  mt === ""
                    ? null
                    : (() => {
                        const v = parseFloat(mt);
                        return Number.isFinite(v) && v > 0 ? v : null;
                      })();
                const r = submitReserveMetadataEditRequest({
                  reserveId: selected.id,
                  newTargetAmount: nt,
                  newDueDate: mDue.trim() || null,
                  newPurpose: mPurpose,
                  reason: mReason,
                  requestedByLabel: actor,
                });
                if (!r.ok) return;
                void emitCashPlanReserveApprovalRequestedBrainEvent({
                  requestId: r.request.id,
                  approvalKind: r.request.kind,
                  reserveId: selected.id,
                  reserveName: selected.name,
                  branchId: selected.branchId,
                  correlationId: r.request.id,
                });
                setMReason("");
              }}
            >
              Submit metadata change
            </button>
          </div>
        </div>
      ) : null}

      {signals.length > 0 ? (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Recent signals (BI-style)</p>
          <ul className="mt-2 space-y-1.5 text-xs text-neutral-400">
            {signals.map((s) => (
              <li key={s.id} className="flex flex-wrap gap-2 border-b border-white/[0.04] pb-1.5">
                <span className="text-neutral-600">{new Date(s.createdAt).toLocaleString()}</span>
                <span className={s.severity === "warning" ? "text-amber-200/90" : "text-neutral-300"}>{s.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
