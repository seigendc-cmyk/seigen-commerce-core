import type { Id } from "./models";
import type { ProductSectorId } from "./sector";
import type { ProductImage } from "./models";
import type { InventoryItemType } from "./inventory-product-meta";

/**
 * Stable read model for POS and operational UIs: catalog + pricing + default-branch stock.
 */
export type ProductReadModel = {
  id: Id;
  /** Display name */
  name: string;
  /** SKU / item code */
  sku: string;
  sectorId: ProductSectorId;
  sectorLabel: string;
  inventoryType: InventoryItemType;
  locDepartment?: string;
  locShelf?: string;
  locSite?: string;
  /** Cost price / unit cost (per unit) */
  costPrice: number;
  averageCost: number;
  /** Standard retail price */
  sellingPrice: number;
  /** On-hand quantity for the resolved branch (default branch when none passed) */
  onHandQty: number;
  branchId: Id;
  active: boolean;
  /** When false, POS must not add this line (admin). */
  forSale: boolean;
  unit: string;
  barcode?: string;
  upc?: string;
  brand?: string;
  description?: string;
  productNotes?: string;
  taxable: boolean;
  supplierId?: string;
  reorderQty: number;
  alternativeProductId?: string;
  /** Primary image (order 0). */
  primaryImage?: ProductImage;
  /** Ordered images (max 8). */
  images: ProductImage[];
  /** Lowercase blob of sector-specific attributes for catalog search (sale leads, crop names, etc.). */
  sectorSearchText: string;
  /**
   * Single lowercase string of all searchable catalog fields (identity, pricing, location, supplier,
   * sector JSON, branch overrides, etc.).
   */
  catalogSearchText: string;
  /** External iDeliver provider may fulfil — surfaced in catalog / storefront. */
  flagExternalIdeliver: boolean;
};
