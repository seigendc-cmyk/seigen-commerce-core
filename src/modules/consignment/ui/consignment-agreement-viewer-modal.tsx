"use client";

import { useMemo, useState } from "react";
import { WindowControls } from "@/components/ui/window-controls";
import {
  getConsignmentAgreementDoc,
  type ConsignmentAgreementDocument,
} from "@/modules/consignment/services/consignment-agreement-docs";
import {
  downloadConsignmentAgreementPdf,
  openConsignmentAgreementPrintWindow,
  shareConsignmentAgreementPdf,
} from "@/modules/consignment/services/consignment-agreement-report";

export function ConsignmentAgreementViewerModal({
  open,
  documentId,
  onClose,
}: {
  open: boolean;
  documentId: string | null;
  onClose: () => void;
}) {
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);

  const doc: ConsignmentAgreementDocument | undefined = useMemo(() => {
    if (!open || !documentId) return undefined;
    return getConsignmentAgreementDoc(documentId);
  }, [open, documentId]);

  if (!open) return null;

  const shellClass = maximized ? "w-[96vw] max-w-[96vw] h-[94vh]" : "w-[min(96vw,56rem)]";
  const contentHeight = maximized ? "h-[calc(94vh-64px)]" : "max-h-[84vh]";

  const actionsDisabled = !doc;

  function restore() {
    setMinimized(false);
    setMaximized(false);
  }

  async function onPrint() {
    if (!doc) return;
    openConsignmentAgreementPrintWindow(doc);
  }

  async function onDownload() {
    if (!doc) return;
    await downloadConsignmentAgreementPdf(doc);
  }

  async function onShare() {
    if (!doc) return;
    await shareConsignmentAgreementPdf(doc);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-4">
      <div className={"rounded-2xl border border-slate-200 bg-white shadow-2xl " + shellClass}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Consignment Agreement</div>
            <div className="mt-0.5 text-xs text-slate-600">{doc ? `Document ${doc.id}` : "Document not found"}</div>
          </div>
          <WindowControls
            minimized={minimized}
            maximized={maximized}
            onMinimize={() => setMinimized(true)}
            onMaximize={() => setMaximized(true)}
            onRestore={restore}
            onClose={onClose}
          />
        </div>

        {minimized ? (
          <div className="px-5 py-4 text-sm text-slate-700">This form is minimized. Click Restore to continue.</div>
        ) : (
          <div className={"overflow-auto px-5 py-5 " + contentHeight}>
            <div className="mx-auto w-full max-w-[794px] rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-base font-semibold text-slate-900">{doc?.agreementTitle || "Consignment Agreement"}</div>
                  <div className="text-xs text-slate-600">
                    Signed at <span className="font-medium text-slate-800">{doc?.signedAtPlace || "-"}</span> on{" "}
                    <span className="font-medium text-slate-800">{doc?.signedAtDate || "-"}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                    onClick={onPrint}
                    disabled={actionsDisabled}
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                    onClick={onDownload}
                    disabled={actionsDisabled}
                  >
                    Download PDF
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
                    onClick={onShare}
                    disabled={actionsDisabled}
                  >
                    Share PDF
                  </button>
                </div>
              </div>

              {!doc ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  This agreement document could not be found in local storage.
                </div>
              ) : (
                <>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="text-sm font-semibold text-slate-900">Principal Vendor</div>
                      <div className="mt-2 text-sm text-slate-700">
                        <div className="font-medium">{doc.vendorLegalName || "-"}</div>
                        <div className="text-xs text-slate-600">{doc.vendorTradingName || ""}</div>
                        <div className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{doc.vendorAddress || ""}</div>
                        <div className="mt-2 text-xs text-slate-600">
                          {doc.vendorContactPerson || "-"} · {doc.vendorPhone || "-"} · {doc.vendorEmail || "-"}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="text-sm font-semibold text-slate-900">Consignment Agent</div>
                      <div className="mt-2 text-sm text-slate-700">
                        <div className="font-medium">{doc.agentLegalName || "-"}</div>
                        <div className="text-xs text-slate-600">{doc.agentNationalIdOrReg || ""}</div>
                        <div className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{doc.stallLocation || ""}</div>
                        <div className="mt-2 text-xs text-slate-600">
                          {doc.agentPhone || "-"} · {doc.agentEmail || "-"}
                        </div>
                        <div className="mt-2 text-xs text-slate-600">
                          Guarantor/Next of kin: {doc.guarantorOrNextOfKinName || "-"} · {doc.guarantorOrNextOfKinPhone || "-"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-slate-900">Commercial Terms</div>
                    <div className="mt-3 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-xs font-semibold text-slate-600">Premium (%)</div>
                        <div className="mt-1 font-mono">{(doc.premiumPercent ?? 0).toFixed(2)}%</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-xs font-semibold text-slate-600">Commission model</div>
                        <div className="mt-1">{doc.commissionModel || "-"}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
                        <div className="text-xs font-semibold text-slate-600">Commission rule</div>
                        <div className="mt-1 whitespace-pre-wrap">{doc.commissionRateText || "-"}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-xs font-semibold text-slate-600">Settlement frequency</div>
                        <div className="mt-1 whitespace-pre-wrap">{doc.settlementFrequency || "-"}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-xs font-semibold text-slate-600">Settlement method</div>
                        <div className="mt-1 whitespace-pre-wrap">{doc.settlementMethod || "-"}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
                        <div className="text-xs font-semibold text-slate-600">Territory / exclusivity</div>
                        <div className="mt-1 whitespace-pre-wrap">{doc.territoryExclusivity || "-"}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
                        <div className="text-xs font-semibold text-slate-600">Term & renewal</div>
                        <div className="mt-1 whitespace-pre-wrap">{doc.termAndRenewal || "-"}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
                        <div className="text-xs font-semibold text-slate-600">Security deposit / guarantee</div>
                        <div className="mt-1 whitespace-pre-wrap">{doc.securityDepositText || "-"}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
                        <div className="text-xs font-semibold text-slate-600">Governing law / jurisdiction</div>
                        <div className="mt-1 whitespace-pre-wrap">{doc.governingLawAndJurisdiction || "-"}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-slate-900">Clauses</div>
                    <div className="mt-3 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800">
                      {doc.clausesSnapshot || "-"}
                    </div>
                  </div>

                  <div className="mt-6 rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-slate-900">Signatures</div>
                    <div className="mt-3 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-xs font-semibold text-slate-600">Principal signatory</div>
                        <div className="mt-1">{doc.principalSignName || "-"}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-xs font-semibold text-slate-600">Agent signatory</div>
                        <div className="mt-1">{doc.agentSignName || "-"}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-xs font-semibold text-slate-600">Witness 1</div>
                        <div className="mt-1">{doc.witness1Name || "-"}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-xs font-semibold text-slate-600">Witness 2</div>
                        <div className="mt-1">{doc.witness2Name || "-"}</div>
                      </div>
                    </div>
                    <div className="mt-4 text-center text-xs text-slate-500">Powered by seiGEN Commerce</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

