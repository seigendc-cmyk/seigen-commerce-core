import { disableActiveAgentAccessCodesForProvisioning } from "@/modules/consignment/services/consignment-agent-access-codes";
import { disableProvisioning } from "@/modules/consignment/services/consignment-agent-provisioning";
import { updateConsignmentAgreement } from "@/modules/consignment/services/consignment-agreements";

/**
 * Governed "deactivation" for an agent: blocks agent access while keeping history.
 * - Disables provisioning (agent cannot link/login to this stall)
 * - Disables any active one-time access codes
 * - Marks agreement inactive (optional but recommended to hide from active flows)
 */
export function deactivateConsignmentAgent(input: {
  provisioningId: string;
  agreementId: string;
  reason?: string;
}): { ok: true; disabledCodes: number } | { ok: false; error: string } {
  const codes = disableActiveAgentAccessCodesForProvisioning(input.provisioningId);
  const p = disableProvisioning({ provisioningId: input.provisioningId, reason: input.reason });
  if (!p.ok) return { ok: false, error: p.error };
  const reason = (input.reason ?? "").trim();
  updateConsignmentAgreement(input.agreementId, {
    isActive: false,
    notes: reason ? `Deactivated: ${reason}` : "Deactivated",
  });
  return { ok: true, disabledCodes: codes.disabled };
}

