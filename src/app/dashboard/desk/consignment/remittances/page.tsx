"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listRemittances, AGENT_EVENT } from "@/modules/consignment-agent/services/agent-storage";
import { acceptPopAndApproveReceipt, rejectPop } from "@/modules/consignment-agent/services/agent-remittance.service";

function useTick() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const on = () => setT((x) => x + 1);
    window.addEventListener(AGENT_EVENT, on);
    return () => window.removeEventListener(AGENT_EVENT, on);
  }, []);
  return t;
}

export default function VendorRemittanceQueuePage() {
  const _t = useTick();
  const pending = useMemo(() => listRemittances().filter((r) => r.status === "pending_pop_review").slice(0, 100), [_t]);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-neutral-400">Vendor desk</div>
          <div className="text-xl font-semibold text-neutral-100">Remittance POP review</div>
          <div className="mt-1 text-sm text-neutral-400">Approve receipt to post accounting. Reject requires a reason.</div>
        </div>
        <Link
          href="/dashboard/desk/security/governance"
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
        >
          Back to governance
        </Link>
      </header>

      {err ? <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{err}</div> : null}

      <div className="grid gap-3">
        {pending.map((r) => (
          <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-neutral-100">{r.remittanceNumber}</div>
                <div className="mt-1 text-sm text-neutral-300">
                  {r.amountDeclared.toFixed(2)} · {r.stallName} · {r.agentName}
                </div>
                <div className="mt-1 text-xs text-neutral-500">POP: {r.popReference || "attached"}</div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-950"
                  onClick={() => {
                    setErr(null);
                    const res = acceptPopAndApproveReceipt({
                      remittanceId: r.id,
                      actorLabel: "vendor",
                      receivingAccount: r.paymentChannel === "bank_transfer" ? "bank" : r.paymentChannel === "mobile_money" ? "mobile_money" : "cashbook",
                      receivingAccountLabel: "Vendor receiving",
                    });
                    if (!res.ok) setErr(res.error);
                  }}
                >
                  Accept POP + approve receipt
                </button>
                <button
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/15"
                  onClick={() => {
                    const reason = window.prompt("Reason for rejection?");
                    if (!reason) return;
                    setErr(null);
                    const res = rejectPop({ remittanceId: r.id, actorLabel: "vendor", rejectionReason: reason });
                    if (!res.ok) setErr(res.error);
                  }}
                >
                  Reject POP
                </button>
              </div>
            </div>
          </div>
        ))}

        {pending.length < 1 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-300">
            No remittances awaiting POP review.
          </div>
        ) : null}
      </div>
    </div>
  );
}

