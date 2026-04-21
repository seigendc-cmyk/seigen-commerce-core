import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import {
  markConsignmentAgreementApproved,
  rejectConsignmentAgreementApproval,
  type ConsignmentAgreementApprovalRequest,
  type ConsignmentAgreementApprovalStatus,
} from "@/modules/consignment/services/consignment-approval-queue";
import { createConsignmentAgreementForExistingStall } from "@/modules/consignment/services/consignment-agreements";
import { createAgentProvisioning } from "@/modules/consignment/services/consignment-agent-provisioning";
import { createAgentAccessCodeForProvisioning } from "@/modules/consignment/services/consignment-agent-access-codes";
import { ensureVendorBranchForInventoryBranch } from "@/modules/dashboard/settings/branches/vendor-branches-sync";

export function getConsignmentApprovalStatusLabel(s: ConsignmentAgreementApprovalStatus): string {
  if (s === "pending") return "Pending approval";
  if (s === "approved") return "Approved";
  return "Rejected";
}

export function provisionConsignmentAgreementFromApprovalRequest(input: {
  request: ConsignmentAgreementApprovalRequest;
  approverLabel: string;
}):
  | { ok: true; agreementId: string; stallBranchId: string; agentProvisioningId: string; agentAccessCode: string; agentAccessCodeId: string }
  | { ok: false; error: string } {
  const r = input.request;
  if (r.status !== "pending") return { ok: false, error: "Request is not pending." };

  const agentName = r.agentName.trim() || "Agent";
  const principal = InventoryRepo.getBranch(r.principalBranchId) ?? InventoryRepo.getDefaultBranch();
  const stall = InventoryRepo.addBranch({ name: `Stall — ${agentName}`, kind: "trading" });
  // Ensure the onboarded stall is visible under Settings > Branches as part of the vendor ecosystem.
  ensureVendorBranchForInventoryBranch({ id: stall.id, name: stall.name });

  const ag = createConsignmentAgreementForExistingStall({
    principalBranchId: principal.id,
    stallBranchId: stall.id,
    agentName,
    premiumPercent: r.premiumPercent,
    notes: `Approved consignment agreement. Document: ${r.documentId}. Request: ${r.id}`,
    documentId: r.documentId,
  });

  const prov = createAgentProvisioning({
    agreementId: ag.id,
    stallBranchId: ag.stallBranchId,
    principalBranchId: ag.principalBranchId,
    agentName: ag.agentName,
    agentEmail: r.agentEmail,
    agentUserId: null,
    status: "pending_link",
    notes: `Provisioned via approval request ${r.id}.`,
  });

  const access = createAgentAccessCodeForProvisioning(prov.id);

  const updated = markConsignmentAgreementApproved(
    r.id,
    { agreementId: ag.id, stallBranchId: ag.stallBranchId, agentUserId: undefined },
    input.approverLabel,
  );
  if (!updated.ok) return { ok: false, error: updated.error };

  return {
    ok: true,
    agreementId: ag.id,
    stallBranchId: ag.stallBranchId,
    agentProvisioningId: prov.id,
    agentAccessCode: access.code,
    agentAccessCodeId: access.id,
  };
}

export function rejectConsignmentAgreementFromApprovalRequest(input: {
  requestId: string;
  approverLabel: string;
  reason: string;
}) {
  return rejectConsignmentAgreementApproval(input.requestId, input.approverLabel, input.reason);
}

