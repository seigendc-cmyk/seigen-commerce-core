import type { ConsignmentDocumentRow, ConsignmentDocumentType } from "./types";
import { CONSIGNMENT_EVIDENCE_POLICY, policyAllowsAction } from "./consignment-evidence-policy";

export type EvidenceValidationResult = {
  ok: boolean;
  /** Blocking reasons */
  errors: string[];
  /** Non-blocking observations */
  warnings: string[];
  presentDocTypes: ConsignmentDocumentType[];
};

function activeDocs(docs: ConsignmentDocumentRow[]): ConsignmentDocumentRow[] {
  return docs.filter((d) => d.documentStatus !== "voided");
}

export function validateEvidenceForReconciliationConfirm(input: {
  documents: ConsignmentDocumentRow[];
  issuedDiffersFromReceived: boolean;
}): EvidenceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const present = new Set(activeDocs(input.documents).map((d) => d.documentType));

  const base = policyAllowsAction("reconciliation_confirm", present);
  if (!base.ok) errors.push(`Missing required documents: ${base.missing.join(", ")}`);

  if (input.issuedDiffersFromReceived) {
    const gr = present.has("goods_receipt");
    if (!gr) errors.push("Issued≠received: goods_receipt is mandatory per evidence policy.");
  }

  if (!present.has("agreement_contract") && !present.has("issue_invoice") && !present.has("issue_note")) {
    warnings.push("No agreement_contract / issue_invoice / issue_note on file — link commercial terms for audit trail.");
  }

  return { ok: errors.length === 0, errors, warnings, presentDocTypes: [...present] };
}

export function validateEvidenceForSettlementPaid(documents: ConsignmentDocumentRow[]): EvidenceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const present = new Set(activeDocs(documents).map((d) => d.documentType));
  const base = policyAllowsAction("settlement_mark_paid", present);
  if (!base.ok) errors.push(`Missing required documents: ${base.missing.join(", ")}`);
  const pol = CONSIGNMENT_EVIDENCE_POLICY.settlement_mark_paid;
  if (pol.requireMovementSourceDoc) {
    /* reserved for future POP ↔ bank row matching */
  }
  return { ok: errors.length === 0, errors, warnings, presentDocTypes: [...present] };
}

export function validateDocumentRegistration(doc: Pick<ConsignmentDocumentRow, "documentType" | "title">): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!doc.title?.trim()) errors.push("Document title is required.");
  return { ok: errors.length === 0, errors };
}
