"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AGENT_EVENT, listRemittances } from "@/modules/consignment-agent/services/agent-storage";
import {
  acceptPopAndApproveReceipt,
  agentConfirmReceipt,
  createDraftRemittance,
  submitRemittance,
  updateDraftRemittance,
} from "@/modules/consignment-agent/services/agent-remittance.service";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";

function useTick() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const on = () => setT((x) => x + 1);
    window.addEventListener(AGENT_EVENT, on);
    return () => window.removeEventListener(AGENT_EVENT, on);
  }, []);
  return t;
}

export default function AgentRemittancesPage() {
  const stall = useMemo(() => InventoryRepo.getDefaultTradingBranch() ?? InventoryRepo.getDefaultBranch(), []);
  const stallBranchId = stall.id;
  const actorLabel = "agent";
  const agentId = "agent_local";
  const agentName = "Agent";

  const _t = useTick();
  const rows = useMemo(
    () => listRemittances().filter((r) => r.stallBranchId === stallBranchId).slice(0, 50),
    [_t, stallBranchId],
  );

  const [err, setErr] = useState<string | null>(null);

  const draft = rows.find((r) => r.status === "draft") ?? null;

  return (
    <div className="mx-auto max-w-md px-3 py-4">
      <header className="mb-3">
        <div className="text-xs text-neutral-400">Agent</div>
        <div className="text-lg font-semibold text-neutral-100">Cash remittances</div>
        <div className="mt-2 flex gap-2">
          <Link className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-100" href="/dashboard/agent">
            Back to cart
          </Link>
          <button
            className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-50"
            disabled={Boolean(draft)}
            onClick={() => {
              setErr(null);
              const r = createDraftRemittance({ stallBranchId, agentId, agentName, actorLabel });
              if (!r.ok) setErr(r.error);
            }}
          >
            New remittance
          </button>
        </div>
      </header>

      {err ? <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{err}</div> : null}

      {draft ? (
        <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-sm font-semibold text-neutral-100">{draft.remittanceNumber} (Draft)</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs text-neutral-400">
              Amount
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2 text-base text-neutral-100"
                inputMode="decimal"
                value={String(draft.amountDeclared || "")}
                onChange={(e) => {
                  updateDraftRemittance({
                    remittanceId: draft.id,
                    actorLabel,
                    patch: { amountDeclared: Number(e.target.value) },
                  });
                }}
              />
            </label>
            <label className="text-xs text-neutral-400">
              Channel
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2 text-base text-neutral-100"
                value={draft.paymentChannel}
                onChange={(e) =>
                  updateDraftRemittance({ remittanceId: draft.id, actorLabel, patch: { paymentChannel: e.target.value as any } })
                }
              >
                <option value="cash_deposit">Cash deposit</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="mobile_money">Mobile money</option>
              </select>
            </label>
          </div>

          <label className="mt-2 block text-xs text-neutral-400">
            POP reference (txn / slip / deposit ref)
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2 text-base text-neutral-100"
              value={draft.popReference}
              onChange={(e) => updateDraftRemittance({ remittanceId: draft.id, actorLabel, patch: { popReference: e.target.value } })}
            />
          </label>

          <div className="mt-3 flex gap-2">
            <button
              className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-950"
              onClick={() => {
                setErr(null);
                const r = submitRemittance({ remittanceId: draft.id, actorLabel });
                if (!r.ok) setErr(r.error);
              }}
            >
              Submit for POP review
            </button>
          </div>

          <div className="mt-2 text-xs text-neutral-500">
            Accounting posts only after vendor accepts POP and confirms receipt.
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {rows
          .filter((r) => r.status !== "draft")
          .map((r) => (
            <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-neutral-100">{r.remittanceNumber}</div>
                  <div className="mt-0.5 text-xs text-neutral-400">{r.amountDeclared.toFixed(2)} · {r.paymentChannel.replaceAll("_", " ")}</div>
                  <div className="mt-1 text-xs text-neutral-500">Status: {r.status.replaceAll("_", " ")}</div>
                </div>
                {r.status === "received_approved" ? (
                  <button
                    className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-950"
                    onClick={() => {
                      setErr(null);
                      const res = agentConfirmReceipt({ remittanceId: r.id, actorLabel });
                      if (!res.ok) setErr(res.error);
                    }}
                  >
                    Confirm payment
                  </button>
                ) : null}
              </div>
              {r.status === "pop_rejected" ? (
                <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  Rejected: {r.rejectionReason}
                </div>
              ) : null}
            </div>
          ))}
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-semibold text-neutral-100">Vendor desk (demo)</div>
        <div className="mt-1 text-xs text-neutral-400">
          Use the vendor governance desk to accept/reject POP and post accounting.
        </div>
        <div className="mt-3">
          <Link className="rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm font-semibold text-neutral-100" href="/dashboard/desk/security/governance">
            Open vendor desk
          </Link>
        </div>
      </div>
    </div>
  );
}

