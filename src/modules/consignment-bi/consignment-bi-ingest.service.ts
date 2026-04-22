import type { ConsignmentMovementType } from "./types";

/**
 * Brain/event integration notes:
 * - This service is intentionally a stub: it defines the boundary for ingesting domain events into BI tables.
 * - In the current repo, Brain events are emitted from module actions (see `src/modules/brain/brain-actions.ts`).
 * - Pack 1-9 governance requires auditability: ingest should record `source_event_id`, `actor`, and reference codes.
 *
 * Implementation approach:
 * - For each operational event (issue invoice approved, POS sale completed at stall, return/damage/missing),
 *   call an ingest method here that writes a `consignment_movements` row and updates rollups on `consignment_items`.
 * - Later, a nightly job can compute `consignment_agent_scores` and populate `consignment_risk_flags`.
 */

export type ConsignmentBiIngestEvent = {
  tenantId: string;
  agreementId?: string | null;
  consignmentId?: string | null;
  consignmentItemId?: string | null;
  movementType: ConsignmentMovementType;
  atIso: string;
  actorUserId?: string | null;
  actorLabel: string;
  qtyDelta: number;
  unitCost?: number | null;
  unitPrice?: number | null;
  amountValue?: number | null;
  currencyCode?: string;
  referenceCode?: string | null;
  sourceDocumentId?: string | null;
  relatedSaleId?: string | null;
  narration?: string | null;
  metadata?: Record<string, unknown>;
};

export async function ingestConsignmentMovement(_e: ConsignmentBiIngestEvent): Promise<{ ok: true } | { ok: false; error: string }> {
  // Stub: wire to Supabase insert into `consignment_movements` and update rollups.
  // Intentionally not implemented in this pack (foundation only).
  return { ok: true };
}

