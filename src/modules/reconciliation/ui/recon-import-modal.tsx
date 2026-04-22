"use client";

import { useMemo, useState } from "react";
import type { Id } from "@/modules/inventory/types/models";
import type { BranchReconciliationPackageV1 } from "../services/branch-reconciliation-package";
import { formatReconConflictReportPlainText, diffBranchReconciliationPackages } from "../services/branch-reconciliation-diff";
import {
  applyReconStockSnapshot,
  parseReconPackageJson,
  validateReconImport,
  type ReconImportValidation,
} from "../services/branch-reconciliation-import";
import { downloadBranchReconciliationPackageJson } from "../services/branch-reconciliation-package";

type Props = {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  branchId: Id;
  operatorLabel: string;
};

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ReconImportModal({ open, onClose, tenantId, branchId, operatorLabel }: Props) {
  const [raw, setRaw] = useState<string | null>(null);
  const [pkg, setPkg] = useState<BranchReconciliationPackageV1 | null>(null);
  const [validation, setValidation] = useState<ReconImportValidation | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canApplyStock = Boolean(validation?.ok && validation.diffSummary.stock > 0);

  const reportText = useMemo(() => {
    if (!validation?.ok) return null;
    const diff = diffBranchReconciliationPackages(validation.local, validation.pkg);
    if (!diff.ok) return null;
    return formatReconConflictReportPlainText(diff.report);
  }, [validation]);

  if (!open) return null;

  async function onPickFile(f: File | null) {
    setMsg(null);
    setValidation(null);
    setPkg(null);
    setRaw(null);
    if (!f) return;
    try {
      const text = await f.text();
      setRaw(text);
      const parsed = parseReconPackageJson(text);
      if (!parsed.ok) {
        setMsg(parsed.error);
        return;
      }
      setPkg(parsed.pkg);
      const v = validateReconImport({ tenantId, branchId, pkg: parsed.pkg });
      setValidation(v);
      if (!v.ok) setMsg(v.error);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to read file.");
    }
  }

  async function applyStock() {
    if (!validation?.ok) return;
    if (!confirm("Apply imported stock snapshot to this branch? This overwrites local on-hand quantities for matching products.")) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = applyReconStockSnapshot({ pkg: validation.pkg, operatorLabel });
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      setMsg(`Stock snapshot applied. Updated ${res.applied} items. Skipped ${res.skippedMissingProducts} unknown products.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Import reconciliation package</h3>
            <p className="mt-1 text-xs text-slate-500">
              Local-first drift fix for multi-terminal shops (manual file transfer).
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="space-y-4 p-5">
          {msg ? <div className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white">{msg}</div> : null}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Package file (JSON)
            </label>
            <input
              type="file"
              accept="application/json,.json"
              className="mt-2 block w-full text-sm"
              onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            />
            {pkg ? (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
                <div>
                  <span className="text-slate-500">Device:</span> <span className="font-semibold">{pkg.deviceId}</span>
                </div>
                <div>
                  <span className="text-slate-500">Generated:</span>{" "}
                  <span className="font-semibold">{new Date(pkg.generatedAt).toLocaleString()}</span>
                </div>
              </div>
            ) : null}
          </div>

          {validation?.ok ? (
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Diff summary</p>
              <div className="mt-2 grid grid-cols-3 gap-3 text-sm text-slate-800">
                <div>
                  <p className="text-xs text-slate-500">Product</p>
                  <p className="font-semibold">{validation.diffSummary.product}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Stock</p>
                  <p className="font-semibold">{validation.diffSummary.stock}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Sales</p>
                  <p className="font-semibold">{validation.diffSummary.sales}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Terminals</p>
                  <p className="font-semibold">{validation.diffSummary.terminal}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Shifts</p>
                  <p className="font-semibold">{validation.diffSummary.shift}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Storefront</p>
                  <p className="font-semibold">{validation.diffSummary.storefrontPublish}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!reportText}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
                  onClick={() => {
                    if (!reportText) return;
                    const ts = new Date().toISOString().replaceAll(":", "").slice(0, 15);
                    downloadText(`recon_conflicts_${tenantId}_${String(branchId)}_${ts}.txt`, reportText);
                  }}
                >
                  Download conflict report (txt)
                </button>

                <button
                  type="button"
                  disabled={!raw}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
                  onClick={() => {
                    if (!pkg) return;
                    const ts = new Date().toISOString().replaceAll(":", "").slice(0, 15);
                    downloadBranchReconciliationPackageJson(`recon_import_copy_${tenantId}_${String(branchId)}_${ts}.json`, pkg);
                  }}
                >
                  Download imported copy (json)
                </button>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-900">Apply (MVP)</p>
            <p className="mt-1 text-xs text-amber-900/80">
              MVP only applies <span className="font-semibold">stock snapshot</span> (on-hand overwrite) for products that exist on this device.
              Product master, sales, shifts, and terminal rows are not applied automatically.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canApplyStock || busy}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                onClick={() => void applyStock()}
              >
                Apply stock snapshot
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

