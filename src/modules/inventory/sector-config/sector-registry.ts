import type { ProductSectorId, SectorConfig, SectorFieldDefinition } from "../types/sector";
import { SECTORS } from "./sectors";

/**
 * Standard sector logic — single entry for listing sectors and their product-form attributes.
 *
 * **Current:** definitions come from `sectors.ts` (same shape the product form uses).
 *
 * **With Supabase:** load rows from `product_sectors` and map each row’s `field_definitions` JSONB
 * through {@link mapFieldDefinitionsFromDb}, then sort by `sort_order`. Keep `sectors.ts` as a
 * fallback or delete it once the API path is always available.
 *
 * **Tables (see `supabase/migrations/*_product_sectors.sql`):**
 * - `product_sectors` — id, label, sort_order, is_active, field_definitions (JSONB array; supports `date`, `textarea`, etc.)
 * - `tenant_enabled_sectors` — (tenant_id, sector_id) for Business Profile selections
 */
export function listSectorDefinitions(): readonly SectorConfig[] {
  return SECTORS;
}

export function getSectorDefinition(sectorId: string): SectorConfig | undefined {
  return SECTORS.find((s) => s.id === sectorId);
}

/** Validates and returns typed field rows from `product_sectors.field_definitions`. */
export function mapFieldDefinitionsFromDb(json: unknown): SectorFieldDefinition[] {
  if (!Array.isArray(json)) return [];
  return json as SectorFieldDefinition[];
}

export function isProductSectorId(id: string): id is ProductSectorId {
  return SECTORS.some((s) => s.id === id);
}
