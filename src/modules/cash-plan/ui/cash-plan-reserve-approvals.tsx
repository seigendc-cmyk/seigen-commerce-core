"use client";

import { useEffect, useState } from "react";
import {
  approveReserveRequest,
  listPendingReserveApprovals,
  rejectReserveRequest,
  RESERVE_APPROVAL_QUEUE_UPDATED,
  type ReserveApprovalRequest,
} from "@/modules/cash-plan/services/cash-plan-reserves";
import { emitCashPlanReserveApprovalResolvedBrainEvent } from "@/modules/brain/brain-actions";

function money(n: number | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function kindLabel(k: ReserveApprovalRequest["kind"]): string {
  switch (k) {
    case "withdrawal":
      return "Withdrawal";
    case "release_to_free_cash":
      return "Release to free cash";
    case "metadata_edit":
      return "Edit target / due / purpose";
    case "transfer_out":
      return "Transfer out";
    default:
      return k;
  }
}

export function CashPlanReserveApprovalsPanel() {
  const [pending, setPending] = useState<ReserveApprovalRequest[]>([]);

  useEffect(() => {
    const load = () => setPending(listPendingReserveApprovals());
    load();
    window.addEventListener(RESERVE_APPROVAL_QUEUE_UPDATED, load);
    return () => window.removeEventListener(RESERVE_APPROVAL_QUEUE_UPDATED, load);
  }, []);

  if (pending.length === 0) return null;

  return (
    <section className="vendor-panel-soft rounded-2xl p-6">
      <h2 className="text-base font-semibold text-white">Pending reserve approvals</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Sensitive withdrawals, releases, and metadata edits queue here. Approve or reject to apply or discard; outcomes
        are logged and surfaced in Brain.
      </p>
      <ul className="mt-4 space-y-3">
        {pending.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-violet-500/25 bg-violet-500/5 px-4 py-3"
          >
            <div className="min-w-0 text-sm">
              <p className="font-medium text-neutral-100">
                {kindLabel(r.kind)} — {r.reserveName}
              </p>
              <p className="mt-0.5 text-xs text-neutral-400">
                Requested by {r.requestedByLabel} · {new Date(r.createdAt).toLocaleString()}
              </p>
              {r.amount != null && r.amount > 0 ? (
                <p className="mt-1 font-mono text-xs text-neutral-300">Amount: {money(r.amount)}</p>
              ) : null}
              {r.kind === "metadata_edit" ? (
                <p className="mt-1 text-xs text-neutral-400">
                  Proposed purpose: {r.newPurpose?.trim() || "(unchanged)"}
                  {r.newTargetAmount != null ? ` · Target: ${money(r.newTargetAmount)}` : ""}
                  {r.newDueDate ? ` · Due: ${r.newDueDate}` : ""}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-neutral-500">Reason: {r.reason}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                className="rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                onClick={() => {
                  const row = { ...r };
                  const res = approveReserveRequest(row.id);
                  if (!res.ok) return;
                  void emitCashPlanReserveApprovalResolvedBrainEvent({
                    requestId: row.id,
                    approvalKind: row.kind,
                    reserveId: row.reserveId,
                    reserveName: row.reserveName,
                    resolution: "approved",
                    branchId: row.branchId,
                    correlationId: row.id,
                    amount: row.amount,
                  });
                }}
              >
                Approve
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-white/5"
                onClick={() => {
                  const row = { ...r };
                  const res = rejectReserveRequest(row.id);
                  if (!res.ok) return;
                  void emitCashPlanReserveApprovalResolvedBrainEvent({
                    requestId: row.id,
                    approvalKind: row.kind,
                    reserveId: row.reserveId,
                    reserveName: row.reserveName,
                    resolution: "rejected",
                    branchId: row.branchId,
                    correlationId: row.id,
                    amount: row.amount,
                  });
                }}
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
