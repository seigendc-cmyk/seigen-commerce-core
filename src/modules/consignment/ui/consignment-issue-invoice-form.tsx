"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { listProductReadModels } from "@/modules/inventory/services/product-read-model";
import { listConsignmentAgreements } from "@/modules/consignment/services/consignment-agreements";
import {
  createDraftInvoice,
  getIssueInvoice,
  submitInvoiceForApproval,
  updateDraftInvoice,
} from "@/modules/consignment/services/consignment-issue-invoice.service";
import type { ConsignmentIssueInvoiceLine } from "@/modules/consignment/types/consignment-issue-invoice";
import { getConsignmentActorLabel } from "@/modules/consignment/services/consignment-actor";
import type { ConsignmentIssueInvoicePermissionSnapshot } from "@/modules/consignment/services/consignment-issue-permissions";
import { loadIssueInvoicePermissions } from "@/modules/consignment/services/consignment-issue-permissions";

function uid(): string {
  return `ln_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function ConsignmentIssueInvoiceForm({ editInvoiceId }: { editInvoiceId?: string }) {
  const router = useRouter();
  const agreements = useMemo(() => listConsignmentAgreements().filter((a) => a.isActive), []);
  const defaultBranch = InventoryRepo.getDefaultBranch().id;
  const catalog = useMemo(() => listProductReadModels(defaultBranch), [defaultBranch]);

  const [agreementId, setAgreementId] = useState(agreements[0]?.id ?? "");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [documentNumber, setDocumentNumber] = useState("");
  const [pricingBasisNote, setPricingBasisNote] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<ConsignmentIssueInvoiceLine[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(editInvoiceId ?? null);
  const [perms, setPerms] = useState<ConsignmentIssueInvoicePermissionSnapshot | null>(null);

  useEffect(() => {
    if (!editInvoiceId) return;
    const inv = getIssueInvoice(editInvoiceId);
    if (!inv || inv.status !== "draft") return;
    setDraftId(inv.id);
    setAgreementId(inv.agreementId);
    setInvoiceDate(inv.invoiceDate);
    setDocumentNumber(inv.documentNumber);
    setPricingBasisNote(inv.pricingBasisNote ?? "");
    setRemarks(inv.remarks ?? "");
    setLines(inv.lines);
  }, [editInvoiceId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Branch scope is resolved from agreement after selection; until then default to current branch.
      const snap = await loadIssueInvoicePermissions({ scopeEntityId: defaultBranch });
      if (cancelled) return;
      setPerms(snap);
    })();
    return () => {
      cancelled = true;
    };
  }, [defaultBranch]);

  function addLine() {
    const p = catalog[0];
    if (!p) {
      setStatus("Add products to inventory first.");
      return;
    }
    const qty = 1;
    const unit = Math.max(0.01, p.costPrice || p.sellingPrice || 1);
    setLines((prev) => [
      ...prev,
      {
        id: uid(),
        productId: p.id,
        sku: p.sku,
        productName: p.name,
        quantity: qty,
        unitIssueValue: unit,
        lineTotal: Math.round(qty * unit * 100) / 100,
      },
    ]);
  }

  function patchLine(id: string, patch: Partial<ConsignmentIssueInvoiceLine>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...patch };
        next.lineTotal = Math.round(next.quantity * next.unitIssueValue * 100) / 100;
        return next;
      }),
    );
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function saveDraft(navigateAfter?: boolean) {
    setStatus(null);
    if (!perms?.canCreateDraft) {
      setStatus("Not permitted to create or edit consignment issue invoices.");
      return;
    }
    if (!agreementId) {
      setStatus("Select an agreement.");
      return;
    }
    if (!lines.length) {
      setStatus("Add at least one line.");
      return;
    }

    const actor = getConsignmentActorLabel();
    if (draftId) {
      const r = updateDraftInvoice(
        draftId,
        {
          documentNumber: documentNumber.trim() || undefined,
          invoiceDate,
          lines,
          pricingBasisNote,
          remarks,
        },
        actor,
      );
      if (!r.ok) {
        setStatus(r.error);
        return;
      }
      setStatus("Draft saved.");
      if (navigateAfter) router.push(`/dashboard/consignment/issue-invoices/${draftId}`);
      return;
    }

    const r = createDraftInvoice({
      agreementId,
      documentNumber: documentNumber.trim() || undefined,
      invoiceDate,
      lines,
      pricingBasisNote,
      remarks,
      actorLabel: actor,
    });
    if (!r.ok) {
      setStatus(r.error);
      return;
    }
    setDraftId(r.invoice.id);
    setStatus("Draft created.");
    if (navigateAfter) router.push(`/dashboard/consignment/issue-invoices/${r.invoice.id}`);
  }

  function submit() {
    setStatus(null);
    if (!perms?.canSubmitForApproval) {
      setStatus("Not permitted to submit consignment issue invoices for approval.");
      return;
    }
    if (!draftId) {
      saveDraft(false);
      setStatus("Save draft first, then submit.");
      return;
    }
    const r = submitInvoiceForApproval(draftId, getConsignmentActorLabel());
    if (!r.ok) {
      setStatus(r.error);
      return;
    }
    router.push(`/dashboard/consignment/issue-invoices/${draftId}`);
  }

  return (
    <div className="space-y-6">
      {status ? <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-neutral-200">{status}</div> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs text-neutral-400">
          <span className="mb-1 block font-medium text-neutral-300">Agreement (principal → agent stall)</span>
          <select
            className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white"
            value={agreementId}
            onChange={(e) => setAgreementId(e.target.value)}
          >
            {agreements.map((a) => (
              <option key={a.id} value={a.id}>
                {a.agentName} · {InventoryRepo.getBranch(a.principalBranchId)?.name ?? "Principal"}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-neutral-400">
          <span className="mb-1 block font-medium text-neutral-300">Invoice date</span>
          <input
            type="date"
            className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </label>
        <label className="block text-xs text-neutral-400 sm:col-span-2">
          <span className="mb-1 block font-medium text-neutral-300">Document number (optional — auto if empty)</span>
          <input
            className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white"
            value={documentNumber}
            onChange={(e) => setDocumentNumber(e.target.value)}
            placeholder="CII-…"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700" onClick={addLine}>
          Add line
        </button>
        <button type="button" className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10" onClick={() => saveDraft(true)}>
          Save invoice
        </button>
        <button
          type="button"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/20"
          onClick={submit}
        >
          Submit for approval (locks invoice)
        </button>
        <Link href="/dashboard/consignment/issue-invoices" className="rounded-lg px-4 py-2 text-sm font-semibold text-neutral-300 hover:text-white">
          Back to list
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase text-neutral-400">
            <tr>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Unit issue value</th>
              <th className="px-3 py-2 text-right">Line total</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-neutral-500">
                  No lines. Add products issued on this commercial document.
                </td>
              </tr>
            ) : (
              lines.map((l) => (
                <tr key={l.id} className="border-b border-white/[0.06]">
                  <td className="px-3 py-2">
                    <select
                      className="vendor-field mb-1 w-full max-w-md rounded-lg px-2 py-1.5 text-xs text-white"
                      value={l.productId}
                      onChange={(e) => {
                        const pid = e.target.value;
                        const p = catalog.find((x) => x.id === pid);
                        if (!p) return;
                        patchLine(l.id, {
                          productId: pid,
                          sku: p.sku,
                          productName: p.name,
                          unitIssueValue: Math.max(0.01, p.costPrice || p.sellingPrice || l.unitIssueValue),
                        });
                      }}
                    >
                      {catalog.slice(0, 400).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} · {p.name}
                        </option>
                      ))}
                    </select>
                    <div className="text-xs text-neutral-500">{l.productName}</div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className="vendor-field w-24 rounded-lg px-2 py-1 text-right font-mono text-sm text-white"
                      value={l.quantity}
                      onChange={(e) => patchLine(l.id, { quantity: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={0.01}
                      step={0.01}
                      className="vendor-field w-28 rounded-lg px-2 py-1 text-right font-mono text-sm text-white"
                      value={l.unitIssueValue}
                      onChange={(e) => patchLine(l.id, { unitIssueValue: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-neutral-200">{l.lineTotal.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" className="text-xs text-rose-300 hover:underline" onClick={() => removeLine(l.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <label className="block text-xs text-neutral-400">
        <span className="mb-1 block font-medium text-neutral-300">Pricing / selling basis (optional)</span>
        <input
          className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white"
          value={pricingBasisNote}
          onChange={(e) => setPricingBasisNote(e.target.value)}
          placeholder="e.g. Standard cost + agreed uplift"
        />
      </label>
      <label className="block text-xs text-neutral-400">
        <span className="mb-1 block font-medium text-neutral-300">Remarks</span>
        <textarea
          className="vendor-field min-h-[88px] w-full rounded-lg px-3 py-2 text-sm text-white"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </label>
    </div>
  );
}
