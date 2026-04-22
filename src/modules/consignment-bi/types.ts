export type ConsignmentAgreementStatus = "draft" | "active" | "paused" | "expired" | "terminated";
export type CommissionModel = "percent_of_sale" | "fixed_per_unit" | "tiered_percent";
export type SettlementCycle = "daily" | "weekly" | "biweekly" | "monthly" | "on_demand";

export type ConsignmentAgreementRow = {
  id: string;
  tenantId: string;
  agreementCode: string;
  status: ConsignmentAgreementStatus;

  principalVendorName: string;

  agentId: string;
  agentName: string;
  stallBranchId: string | null;
  stallLabel: string | null;

  commissionModel: CommissionModel;
  commissionPercent: number | null;
  commissionFixedPerUnit: number | null;
  commissionTiersJson: unknown[];

  minimumPriceRule: "none" | "min_price" | "min_margin";
  minimumPrice: number | null;
  minimumMarginPercent: number | null;

  settlementCycle: SettlementCycle;
  settlementDayOfWeek: number | null;
  settlementDayOfMonth: number | null;
  settlementGraceDays: number;

  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string | null;
  expiryDate: string | null;

  allowDiscounts: boolean;
  maxDiscountPercent: number | null;
  allowPriceOverride: boolean;
  allowReturns: boolean;
  allowPartialSettlement: boolean;

  notes: string;
  metadata: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
};

export type ConsignmentStatus =
  | "draft"
  | "issued"
  | "in_custody"
  | "in_trade"
  | "partially_settled"
  | "settled"
  | "closed"
  | "cancelled";

export type ConsignmentRow = {
  id: string;
  tenantId: string;
  consignmentCode: string;
  agreementId: string;

  principalOwnerType: "tenant" | "trust" | "distribution_group";
  principalOwnerId: string;
  custodyScopeType: "agent" | "branch" | "warehouse";
  custodyScopeId: string;

  status: ConsignmentStatus;
  issuedAt: string | null;
  receivedAt: string | null;
  closedAt: string | null;

  totalItemsCount: number;
  totalCostValue: number;
  totalSellableQty: number;

  sourceDocumentId: string | null;
  notes: string;
  metadata: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
};

export type ConsignmentItemRow = {
  id: string;
  tenantId: string;
  consignmentId: string;
  productId: string;
  sku: string | null;
  productName: string;
  unit: string | null;

  ownerScopeType: "tenant" | "trust" | "distribution_group";
  ownerScopeId: string;

  issuedQty: number;
  receivedQty: number;
  sellableQty: number;
  soldQty: number;
  returnedQty: number;
  damagedQty: number;
  missingQty: number;

  unitCost: number;
  minUnitPrice: number | null;
  commissionModelSnapshot: string;
  commissionRateSnapshot: number | null;

  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ConsignmentMovementType =
  | "issue"
  | "receive"
  | "sell"
  | "return"
  | "damage"
  | "missing"
  | "adjust"
  | "settlement"
  | "reconciliation";

export type ConsignmentMovementStatus = "draft" | "posted" | "reversed" | "voided";

export type ConsignmentMovementRow = {
  id: string;
  tenantId: string;
  consignmentId: string;
  consignmentItemId: string | null;

  movementType: ConsignmentMovementType;
  movementStatus: ConsignmentMovementStatus;
  at: string;
  actorUserId: string | null;
  actorLabel: string;

  fromCustodyScopeType: string | null;
  fromCustodyScopeId: string | null;
  toCustodyScopeType: string | null;
  toCustodyScopeId: string | null;

  qtyDelta: number;
  unitCost: number | null;
  unitPrice: number | null;
  amountValue: number | null;
  currencyCode: string;

  referenceCode: string | null;
  sourceDocumentId: string | null;
  relatedSaleId: string | null;

  narration: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ConsignmentSettlementStatus = "draft" | "submitted" | "in_review" | "approved" | "rejected" | "paid" | "closed";

export type ConsignmentSettlementRow = {
  id: string;
  tenantId: string;
  agreementId: string;
  consignmentId: string | null;
  settlementCode: string;
  periodFrom: string;
  periodTo: string;
  status: ConsignmentSettlementStatus;

  grossSalesValue: number;
  commissionValue: number;
  netDueToPrincipal: number;
  netDueToAgent: number;
  currencyCode: string;
  notes: string;

  createdAt: string;
  updatedAt: string;
};

export type ConsignmentReconciliationStatus = "draft" | "submitted" | "confirmed" | "disputed" | "closed";

export type ConsignmentReconciliationRow = {
  id: string;
  tenantId: string;
  agreementId: string;
  consignmentId: string | null;
  reconciliationCode: string;
  asOfAt: string;
  status: ConsignmentReconciliationStatus;

  expectedSellableQty: number;
  physicalCountQty: number;
  varianceQty: number;
  varianceValue: number;
  settlementBalanceDue: number;
  notes: string;
  /** Discrepancy lines, evidence checklist, linked settlement id, etc. */
  metadata: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
};

export type ConsignmentDocumentType =
  | "agreement_contract"
  | "issue_invoice"
  | "issue_note"
  | "goods_receipt"
  | "return_note"
  | "damage_report"
  | "missing_report"
  | "settlement_statement"
  | "proof_of_payment"
  | "reconciliation_sheet"
  | "evidence_bundle"
  | "export_package";

export type ConsignmentDocumentRow = {
  id: string;
  tenantId: string;
  agreementId: string | null;
  consignmentId: string | null;
  settlementId: string | null;
  reconciliationId: string | null;
  documentType: ConsignmentDocumentType;
  documentStatus: "draft" | "active" | "voided" | "archived";
  referenceCode: string | null;
  title: string;
  storageKind: "internal" | "external";
  storageRef: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ConsignmentDocumentLinkKind = "primary" | "supporting" | "evidence" | "counterparty_copy";

export type ConsignmentDocumentLinkTargetType =
  | "movement"
  | "settlement"
  | "reconciliation"
  | "consignment_item"
  | "consignment"
  | "agreement"
  | "external_party";

export type ConsignmentDocumentLinkRow = {
  id: string;
  tenantId: string;
  documentId: string;
  linkKind: ConsignmentDocumentLinkKind;
  targetType: ConsignmentDocumentLinkTargetType;
  targetId: string;
  notes: string;
  createdAt: string;
};

/** Industrial-grade discrepancy taxonomy for consignment reconciliation. */
export type ConsignmentDiscrepancyKind =
  | "issued_vs_received"
  | "ledger_qty_vs_item_rollups"
  | "custody_vs_physical_count"
  | "sold_vs_expected_remaining"
  | "return_without_document"
  | "damage_without_document"
  | "settlement_missing_statement"
  | "settlement_paid_missing_proof_of_payment"
  | "document_inconsistent_with_movement";

export type ConsignmentDiscrepancy = {
  kind: ConsignmentDiscrepancyKind;
  severity: "info" | "warning" | "critical";
  productId?: string | null;
  message: string;
  evidence: Record<string, unknown>;
};

export type ConsignmentRiskyAction =
  | "reconciliation_submit"
  | "reconciliation_confirm"
  | "settlement_mark_paid"
  | "movement_return_post"
  | "movement_damage_post";

export type ConsignmentRiskFlagRow = {
  id: string;
  tenantId: string;
  agreementId: string | null;
  consignmentId: string | null;
  agentId: string | null;
  stallBranchId: string | null;
  flagCode: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  title: string;
  summary: string;
  evidenceJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ConsignmentAgentScoreRow = {
  id: string;
  tenantId: string;
  agentId: string;
  agentName: string;
  stallBranchId: string | null;
  scorePeriod: string;
  scoreType: "daily" | "weekly" | "monthly" | "quarterly";
  score: number;
  reliabilityScore: number;
  salesVelocityScore: number;
  shrinkageRiskScore: number;
  settlementDisciplineScore: number;
  metricsJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

