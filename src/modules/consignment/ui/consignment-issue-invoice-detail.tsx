"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { approveIssueInvoice, cancelIssueInvoice, getIssueInvoice, rejectIssueInvoice } from "@/modules/consignment/services/consignment-issue-invoice.service";
import { listInvoiceAudit } from "@/modules/consignment/services/consignment-issue-invoice-storage";
import { CONSIGNMENT_ISSUE_INVOICE_EVENT } from "@/modules/consignment/services/consignment-issue-invoice-storage";
import { getConsignmentActorLabel } from "@/modules/consignment/services/consignment-actor";
import type { ConsignmentIssueInvoicePermissionSnapshot } from "@/modules/consignment/services/consignment-issue-permissions";
import { loadIssueInvoicePermissions } from "@/modules/consignment/services/consignment-issue-permissions";
import { ConsignmentIssueInvoiceStatusBadge } from "@/modules/consignment/ui/consignment-issue-invoice-status-badge";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function ConsignmentIssueInvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const [tick, setTick] = useState(0);
  const [perms, setPerms] = useState<ConsignmentIssueInvoicePermissionSnapshot | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(CONSIGNMENT_ISSUE_INVOICE_EVENT, on);
    return () => window.removeEventListener(CONSIGNMENT_ISSUE_INVOICE_EVENT, on);
  }, []);

  const inv = useMemo(() => {
    void tick;
    return getIssueInvoice(invoiceId);
  }, [invoiceId, tick]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Scope to issuing branch when available (branch-scoped permissions).
      const snap = await loadIssueInvoicePermissions({ scopeEntityId: inv?.issuingBranchId });
      if (cancelled) return;
      setPerms(snap);
    })();
    return () => {
      cancelled = true;
    };
  }, [inv?.issuingBranchId]);

  const audit = useMemo(() => {
    void tick;
    return listInvoiceAudit(invoiceId);
  }, [invoiceId, tick]);

  if (!inv) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-neutral-400">
        Invoice not found.{" "}
        <Link href="/dashboard/consignment/issue-invoices" className="text-teal-400 hover:underline">
          Back to list
        </Link>
      </div>
    );
  }

  function run(action: "approve" | "reject" | "cancel") {
    setMsg(null);
    if (!inv) return;
    const actor = getConsignmentActorLabel();
    if (action === "approve") {
      if (!perms?.canApproveOrReject) {
        setMsg("Not permitted to approve/reject consignment issue invoices.");
        return;
      }
      const r = approveIssueInvoice(inv.id, actor);
      setMsg(r.ok ? "Approved. Stock is now sellable at the agent stall." : r.error);
      return;
    }
    if (action === "reject") {
      if (!perms?.canApproveOrReject) {
        setMsg("Not permitted to approve/reject consignment issue invoices.");
        return;
      }
      const r = rejectIssueInvoice(inv.id, rejectReason, actor);
      setMsg(r.ok ? "Rejected. Principal reservation released." : r.error);
      return;
    }
    if (inv.status === "pending_approval" && !perms?.canCancelPending) {
      setMsg("Not permitted to cancel a pending approval document.");
      return;
    }
    if (inv.status === "draft" && !perms?.canCancelDraft) {
      setMsg("Not permitted to cancel draft documents.");
      return;
    }
    const r = cancelIssueInvoice(inv.id, actor);
    setMsg(r.ok ? "Cancelled." : r.error);
  }

  return (
    <div className="space-y-8">
      {msg ? <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-neutral-200">{msg}</div> : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Consignment issue invoice</div>
          <h1 className="mt-1 font-mono text-2xl font-semibold text-white">{inv.documentNumber}</h1>
          <div className="mt-2">
            <ConsignmentIssueInvoiceStatusBadge status={inv.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/consignment/issue-invoices"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            List
          </Link>
          {inv.status === "pending_approval" && perms?.canApproveOrReject ? (
            <>
              <button
                type="button"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                onClick={() => run("approve")}
              >
                Approve & transfer stock
              </button>
              <div className="flex items-center gap-2">
                <input
                  className="vendor-field rounded-lg px-3 py-2 text-sm text-white"
                  placeholder="Rejection reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <button
                  type="button"
                  className="rounded-lg bg-rose-600/90 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
                  onClick={() => run("reject")}
                >
                  Reject invoice
                </button>
              </div>
            </>
          ) : null}
          {(inv.status === "draft" || inv.status === "pending_approval") && (inv.status === "draft" ? perms?.canCancelDraft : perms?.canCancelPending) ? (
            <button type="button" className="rounded-lg border border-white/20 px-4 py-2 text-sm text-neutral-200 hover:bg-white/5" onClick={() => run("cancel")}>
              Cancel document
            </button>
          ) : null}
        </div>
      </div>

      <section className="vendor-panel-soft rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Header</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-neutral-500">Invoice date</dt>
            <dd className="text-neutral-200">{inv.invoiceDate}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Total value</dt>
            <dd className="font-mono text-neutral-100">{money(inv.totalValue)}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Issuing branch (vendor warehouse)</dt>
            <dd className="text-neutral-200">{inv.issuingBranchName}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Agent stall (branch-like unit)</dt>
            <dd className="text-neutral-200">
              {inv.agentName} — {inv.agentStallName}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-neutral-500">Agreement</dt>
            <dd className="text-neutral-300">{inv.agreementReference ?? inv.agreementId}</dd>
          </div>
          {inv.pricingBasisNote ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-neutral-500">Pricing basis</dt>
              <dd className="text-neutral-300">{inv.pricingBasisNote}</dd>
            </div>
          ) : null}
          {inv.remarks ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-neutral-500">Remarks</dt>
              <dd className="text-neutral-300">{inv.remarks}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="vendor-panel-soft rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Lines</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase text-neutral-400">
              <tr>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Unit</th>
                <th className="px-3 py-2 text-right">Line</th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((l) => (
                <tr key={l.id} className="border-b border-white/[0.06]">
                  <td className="px-3 py-2 font-mono text-xs text-neutral-300">{l.sku}</td>
                  <td className="px-3 py-2 text-neutral-200">{l.productName}</td>
                  <td className="px-3 py-2 text-right font-mono">{l.quantity}</td>
                  <td className="px-3 py-2 text-right font-mono">{money(l.unitIssueValue)}</td>
                  <td className="px-3 py-2 text-right font-mono">{money(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="vendor-panel-soft rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Accounting &amp; stock traceability</h2>
        <dl className="mt-4 grid gap-2 text-sm text-neutral-300">
          <div>
            <span className="text-neutral-500">Journal batch: </span>
            {inv.journalBatchId ?? "— (not posted yet)"}
          </div>
          <div>
            <span className="text-neutral-500">Custody entries: </span>
            {inv.custodyEntryIds?.length ? inv.custodyEntryIds.join(", ") : "—"}
          </div>
          <div>
            <span className="text-neutral-500">Principal reservation held: </span>
            {inv.principalStockReserved ? "yes (pending)" : inv.status === "approved" ? "released to agent" : "no"}
          </div>
        </dl>
        <p className="mt-3 text-xs text-neutral-500">
          On approval, the system posts DR inventory on consignment / CR warehouse stock on hand, then increases sellable quantity at the agent stall branch only.
        </p>
      </section>

      <section className="vendor-panel-soft rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Audit trail</h2>
        <ul className="mt-4 space-y-3 text-sm">
          <li className="border-l-2 border-teal-500/50 pl-3 text-neutral-300">
            <span className="text-xs text-neutral-500">{inv.createdAt}</span> — Created by {inv.createdByLabel}
          </li>
          {inv.submittedAt ? (
            <li className="border-l-2 border-amber-500/40 pl-3 text-neutral-300">
              <span className="text-xs text-neutral-500">{inv.submittedAt}</span> — Submitted by {inv.submittedByLabel}
            </li>
          ) : null}
          {inv.approvedAt ? (
            <li className="border-l-2 border-emerald-500/40 pl-3 text-neutral-300">
              <span className="text-xs text-neutral-500">{inv.approvedAt}</span> — Approved by {inv.approvedByLabel}
            </li>
          ) : null}
          {inv.rejectedAt ? (
            <li className="border-l-2 border-rose-500/40 pl-3 text-neutral-300">
              <span className="text-xs text-neutral-500">{inv.rejectedAt}</span> — Rejected by {inv.rejectedByLabel}: {inv.rejectionReason}
            </li>
          ) : null}
          {audit.map((a) => (
            <li key={a.id} className="border-l border-white/10 pl-3 text-neutral-400">
              <span className="text-xs text-neutral-500">{a.at}</span> — {a.action} {a.detail ? `· ${a.detail}` : ""}
            </li>
          ))}
        </ul>
      </section>

      {inv.status === "draft" ? (
        <Link
          href={`/dashboard/consignment/issue-invoices/new?edit=${inv.id}`}
          className="inline-flex rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
        >
          Edit draft
        </Link>
      ) : null}
    </div>
  );
}
