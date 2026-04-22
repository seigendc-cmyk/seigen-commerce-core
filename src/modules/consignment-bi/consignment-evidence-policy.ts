import type { ConsignmentDocumentType, ConsignmentRiskyAction } from "./types";

/**
 * Minimum document anchors required before high-risk consignment actions (audit / regulator readiness).
 */
export const CONSIGNMENT_EVIDENCE_POLICY: Record<
  ConsignmentRiskyAction,
  { requiredDocTypes: ConsignmentDocumentType[]; requireMovementSourceDoc: boolean; notes: string }
> = {
  reconciliation_submit: {
    requiredDocTypes: ["reconciliation_sheet"],
    requireMovementSourceDoc: false,
    notes: "A reconciliation sheet (even draft scan) must be registered before submission.",
  },
  reconciliation_confirm: {
    requiredDocTypes: ["reconciliation_sheet"],
    requireMovementSourceDoc: true,
    notes: "Confirming reconciliation requires a reconciliation sheet; goods receipt is additionally required when issued≠received.",
  },
  settlement_mark_paid: {
    requiredDocTypes: ["settlement_statement", "proof_of_payment"],
    requireMovementSourceDoc: false,
    notes: "Paid settlements must carry settlement statement plus proof of payment.",
  },
  movement_return_post: {
    requiredDocTypes: ["return_note"],
    requireMovementSourceDoc: true,
    notes: "Return movements must reference a return note or equivalent evidence bundle.",
  },
  movement_damage_post: {
    requiredDocTypes: ["damage_report"],
    requireMovementSourceDoc: true,
    notes: "Damage movements must reference a damage report or missing_report when shrink is unexplained.",
  },
};

export function policyAllowsAction(
  action: ConsignmentRiskyAction,
  presentDocTypes: Set<ConsignmentDocumentType>,
): { ok: true } | { ok: false; missing: ConsignmentDocumentType[] } {
  const pol = CONSIGNMENT_EVIDENCE_POLICY[action];
  const missing = pol.requiredDocTypes.filter((t) => !presentDocTypes.has(t));
  if (missing.length) return { ok: false, missing };
  return { ok: true };
}
