"use client";

import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/components/dashboard/workspace-context";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import {
  CONSIGNMENT_APPROVAL_QUEUE_UPDATED,
  listPendingConsignmentAgreementApprovals,
  rejectConsignmentAgreementApproval,
  type ConsignmentAgreementApprovalRequest,
} from "@/modules/consignment/services/consignment-approval-queue";
import { provisionConsignmentAgreementFromApprovalRequest } from "@/modules/consignment/services/consignment-approval-provisioning";
import {
  emitConsignmentAgreementApprovalResolvedBrainEvent,
  emitConsignmentAgentAccessCodeIssuedBrainEvent,
} from "@/modules/brain/brain-actions";

function shortDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function ConsignmentApprovalsPanel({
  onViewContract,
}: {
  onViewContract: (documentId: string) => void;
}) {
  const workspace = useWorkspace();
  const [pending, setPending] = useState<ConsignmentAgreementApprovalRequest[]>([]);
  const [issued, setIssued] = useState<{
    requestId: string;
    agentEmail: string;
    accessCode: string;
    accessCodeId: string;
    provisioningId: string;
    principalBranchId: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const canApprove = useMemo(() => {
    // Until staff RBAC is fully wired to authenticated user, default to workspace admins/owners.
    // In demo/no-workspace mode, allow so the flow can be tested locally.
    if (!workspace) return true;
    return workspace.memberRole === "owner" || workspace.memberRole === "admin";
  }, [workspace]);

  useEffect(() => {
    const load = () => setPending(listPendingConsignmentAgreementApprovals());
    load();
    window.addEventListener(CONSIGNMENT_APPROVAL_QUEUE_UPDATED, load);
    return () => window.removeEventListener(CONSIGNMENT_APPROVAL_QUEUE_UPDATED, load);
  }, []);

  if (!canApprove) return null;
  if (pending.length === 0) return null;

  return (
    <section className="vendor-panel-soft rounded-2xl p-6">
      <h2 className="text-base font-semibold text-white">Pending consignment agreements</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Agreements do not provision an Agent Stall until approved. Review each agreement, view the contract document,
        then Approve or Reject. Notifications are recorded in Brain.
      </p>
      <ul className="mt-4 space-y-3">
        {pending.map((r) => (
          <li key={r.id} className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-neutral-100">
                  Agent: {r.agentName} · <span className="text-neutral-300">{r.agentEmail}</span>
                </p>
                <p className="mt-0.5 text-xs text-neutral-400">
                  Principal: {InventoryRepo.getBranch(r.principalBranchId)?.name ?? r.principalBranchId} · Premium{" "}
                  {r.premiumPercent.toFixed(2)}% · Submitted {shortDate(r.createdAt)} by {r.submittedByLabel}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                  onClick={() => onViewContract(r.documentId)}
                >
                  View contract
                </button>

                <button
                  type="button"
                  className="rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                  onClick={() => {
                    const row = { ...r };
                    const res = provisionConsignmentAgreementFromApprovalRequest({
                      request: row,
                      approverLabel: workspace?.user.email ?? "Approver",
                    });
                    if (!res.ok) return;
                    setIssued({
                      requestId: row.id,
                      agentEmail: row.agentEmail,
                      accessCode: res.agentAccessCode,
                      accessCodeId: res.agentAccessCodeId,
                      provisioningId: res.agentProvisioningId,
                      principalBranchId: row.principalBranchId,
                    });
                    setCopied(false);
                    void emitConsignmentAgentAccessCodeIssuedBrainEvent({
                      provisioningId: res.agentProvisioningId,
                      accessCodeId: res.agentAccessCodeId,
                      principalBranchId: row.principalBranchId,
                      correlationId: row.id,
                    });
                    void emitConsignmentAgreementApprovalResolvedBrainEvent({
                      requestId: row.id,
                      documentId: row.documentId,
                      resolution: "approved",
                      principalBranchId: row.principalBranchId,
                      agreementId: res.agreementId,
                      stallBranchId: res.stallBranchId,
                      agentUserId: row.agentUserId ?? undefined,
                      correlationId: row.id,
                    });
                  }}
                >
                  Approve
                </button>

                <button
                  type="button"
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-white/5"
                  onClick={() => {
                    const reason = window.prompt("Reason for rejection (optional):") ?? "";
                    const row = { ...r };
                    const res = rejectConsignmentAgreementApproval(row.id, workspace?.user.email ?? "Approver", reason);
                    if (!res.ok) return;
                    void emitConsignmentAgreementApprovalResolvedBrainEvent({
                      requestId: row.id,
                      documentId: row.documentId,
                      resolution: "rejected",
                      principalBranchId: row.principalBranchId,
                      correlationId: row.id,
                    });
                  }}
                >
                  Reject
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {issued ? (
        <div className="mt-5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="text-sm">
              <p className="font-semibold text-emerald-200">Agent Access Code issued (one-time)</p>
              <p className="mt-0.5 text-xs text-neutral-300">
                Share with: <span className="font-mono">{issued.agentEmail}</span>. The agent signs in and enters this code once.
              </p>
              <div className="mt-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono text-base text-white">
                {issued.accessCode}
              </div>
              <p className="mt-1 text-[11px] text-neutral-400">
                Audit ref: codeId {issued.accessCodeId.slice(-8)} · provisioning {issued.provisioningId.slice(-8)}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(issued.accessCode);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  } catch {
                    // Fallback: keep visible
                  }
                }}
              >
                Copy
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-white/10"
                onClick={() => {
                  setCopied(false);
                  setIssued(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
          {copied ? (
            <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200">
              Copied to clipboard.
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

