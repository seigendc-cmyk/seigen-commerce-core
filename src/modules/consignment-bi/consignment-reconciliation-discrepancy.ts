import type { ConsignmentCustodyStockPositionLine } from "./stock-position";
import type { ConsignmentDiscrepancy, ConsignmentDocumentRow, ConsignmentItemRow, ConsignmentMovementRow } from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type DiscrepancyComputationInput = {
  items: ConsignmentItemRow[];
  movementsPosted: ConsignmentMovementRow[];
  custodyLines: ConsignmentCustodyStockPositionLine[];
  /** Optional physical stocktake keyed by product id */
  physicalCountByProductId?: Record<string, number>;
  /** Active documents (not voided) for linkage checks */
  documents: ConsignmentDocumentRow[];
  /** When checking settlement evidence */
  settlementId?: string | null;
  settlementStatus?: string | null;
};

function docCoversMovement(
  documents: ConsignmentDocumentRow[],
  movementId: string,
  types: ConsignmentDocumentRow["documentType"][],
): boolean {
  const active = documents.filter((d) => d.documentStatus !== "voided");
  const metaLinks = (d: ConsignmentDocumentRow) =>
    (Array.isArray((d.metadata as { linked_movement_ids?: string[] }).linked_movement_ids)
      ? (d.metadata as { linked_movement_ids: string[] }).linked_movement_ids
      : []) as string[];
  return active.some(
    (d) =>
      types.includes(d.documentType) &&
      (d.metadata?.source_movement_id === movementId ||
        metaLinks(d).includes(movementId) ||
        (d.metadata as { movement_id?: string }).movement_id === movementId),
  );
}

/**
 * Deterministic discrepancy detection for consignment reconciliation and evidence audits.
 */
export function computeConsignmentDiscrepancies(input: DiscrepancyComputationInput): ConsignmentDiscrepancy[] {
  const out: ConsignmentDiscrepancy[] = [];

  let sumIssued = 0;
  let sumReceived = 0;
  for (const it of input.items) {
    sumIssued = round2(sumIssued + it.issuedQty);
    sumReceived = round2(sumReceived + it.receivedQty);
  }
  if (Math.abs(sumIssued - sumReceived) > 1e-6) {
    out.push({
      kind: "issued_vs_received",
      severity: sumIssued > sumReceived ? "warning" : "critical",
      productId: null,
      message: `Issued quantity (${sumIssued}) does not match received (${sumReceived}) across consignment lines.`,
      evidence: { sumIssued, sumReceived },
    });
  }

  const byProductItem = new Map(input.items.map((i) => [i.productId, i]));
  const byProductCustody = new Map(input.custodyLines.map((l) => [l.productId, l]));

  for (const it of input.items) {
    const pos = byProductCustody.get(it.productId);
    const issuedLedger = pos?.issuedQty ?? 0;
    if (Math.abs(issuedLedger - it.issuedQty) > 1e-6) {
      out.push({
        kind: "ledger_qty_vs_item_rollups",
        severity: "warning",
        productId: it.productId,
        message: `Movement-ledger issued qty (${issuedLedger}) differs from consignment_item issued_qty (${it.issuedQty}) for ${it.sku ?? it.productId}.`,
        evidence: { issuedLedger, itemIssued: it.issuedQty },
      });
    }

    const expectedRemaining = round2(
      Math.max(0, it.sellableQty) -
        Math.max(0, it.soldQty) -
        Math.max(0, it.returnedQty) -
        Math.max(0, it.damagedQty) -
        Math.max(0, it.missingQty),
    );
    const custodyOnHand = pos?.onHandQty ?? 0;
    if (Math.abs(expectedRemaining - custodyOnHand) > 1e-6) {
      out.push({
        kind: "sold_vs_expected_remaining",
        severity: "warning",
        productId: it.productId,
        message: `Expected remaining (${expectedRemaining}) from item rollups differs from custody on-hand (${custodyOnHand}) for ${it.sku ?? it.productId}.`,
        evidence: { expectedRemaining, custodyOnHand, item: it },
      });
    }
  }

  if (input.physicalCountByProductId) {
    for (const line of input.custodyLines) {
      const phys = input.physicalCountByProductId[line.productId];
      if (phys == null || !Number.isFinite(phys)) continue;
      if (Math.abs(phys - line.onHandQty) > 1e-6) {
        out.push({
          kind: "custody_vs_physical_count",
          severity: Math.abs(phys - line.onHandQty) >= 3 ? "critical" : "warning",
          productId: line.productId,
          message: `Physical count (${phys}) differs from ledger custody on-hand (${line.onHandQty}) for product ${line.productId}.`,
          evidence: { physical: phys, ledger: line.onHandQty },
        });
      }
    }
  }

  for (const m of input.movementsPosted) {
    if (m.movementType === "return") {
      const hasDoc =
        Boolean(m.sourceDocumentId) ||
        docCoversMovement(input.documents, m.id, ["return_note", "evidence_bundle", "reconciliation_sheet"]);
      if (!hasDoc) {
        out.push({
          kind: "return_without_document",
          severity: "warning",
          productId: (m.metadata as { product_id?: string })?.product_id ?? null,
          message: `Return movement ${m.id} has no linked return note or evidence bundle.`,
          evidence: { movementId: m.id, qtyDelta: m.qtyDelta },
        });
      }
    }
    if (m.movementType === "damage") {
      const hasDoc =
        Boolean(m.sourceDocumentId) ||
        docCoversMovement(input.documents, m.id, ["damage_report", "evidence_bundle", "missing_report"]);
      if (!hasDoc) {
        out.push({
          kind: "damage_without_document",
          severity: "warning",
          productId: (m.metadata as { product_id?: string })?.product_id ?? null,
          message: `Damage movement ${m.id} has no linked damage / missing report.`,
          evidence: { movementId: m.id, qtyDelta: m.qtyDelta },
        });
      }
    }
  }

  if (input.settlementId) {
    const scoped = input.documents.filter(
      (d) => d.settlementId === input.settlementId && d.documentStatus !== "voided",
    );
    const hasStatement = scoped.some((d) => d.documentType === "settlement_statement");
    if (!hasStatement) {
      out.push({
        kind: "settlement_missing_statement",
        severity: "critical",
        productId: null,
        message: `Settlement ${input.settlementId} has no linked settlement_statement document.`,
        evidence: { settlementId: input.settlementId },
      });
    }
    if (input.settlementStatus === "paid") {
      const hasPop = scoped.some((d) => d.documentType === "proof_of_payment");
      if (!hasPop) {
        out.push({
          kind: "settlement_paid_missing_proof_of_payment",
          severity: "critical",
          productId: null,
          message: `Settlement ${input.settlementId} is paid but has no proof_of_payment document on file.`,
          evidence: { settlementId: input.settlementId },
        });
      }
    }
  }

  // Agreement / issue path: at least one commercial anchor when consignment has issued qty
  if (sumIssued > 0) {
    const hasAgreementDoc = input.documents.some(
      (d) =>
        d.documentStatus !== "voided" &&
        (d.documentType === "agreement_contract" || d.documentType === "issue_invoice" || d.documentType === "issue_note"),
    );
    if (!hasAgreementDoc) {
      out.push({
        kind: "document_inconsistent_with_movement",
        severity: "info",
        productId: null,
        message: "No agreement_contract, issue_invoice, or issue_note document is linked for this reconciliation scope.",
        evidence: { hint: "attach_agreement_or_issue_note" },
      });
    }
  }

  void byProductItem;
  return out;
}
