import type { ProductSectorId } from "./sector";
import type { BranchPriceMap, InventoryItemType } from "./inventory-product-meta";

export type Id = string;

/**
 * Bill of materials line: component consumed (assembly) or output produced (disassembly) per 1 unit of this SKU.
 */
export type BomLine = {
  productId: Id;
  /** Quantity per single parent unit (e.g. 2 tanks, 1 core, 0.5 kg). Must be > 0. */
  qty: number;
  /** Optional label for operators (e.g. "Radiator tank", "Core return"). */
  label?: string;
};

/**
 * Assembly: this SKU is built by consuming `assemblyInputs`.
 * Disassembly: breaking 1 unit of this SKU yields `disassemblyOutputs` (e.g. salvage, cores, tanks).
 * Both can exist on one product when it is both a finished good and a breakdown parent.
 */
export type ProductBom = {
  assemblyInputs?: BomLine[];
  disassemblyOutputs?: BomLine[];
};

export type Branch = {
  id: Id;
  name: string;
  address?: string;
  isDefault?: boolean;
  createdAt: string;
};

export type Supplier = {
  id: Id;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt: string;
};

export type ProductImage = {
  id: Id;
  /** Local-first: WebP as base64 data URL (`data:image/webp;base64,...`). Later: optional HTTPS URL from Supabase Storage. */
  dataUrl: string;
  /** 0-based ordering; first is primary. */
  order: number;
};

export type Product = {
  id: Id;
  sku: string;
  name: string;
  sectorId: ProductSectorId;
  /** Unit of measure (UM): each, kg, hour, etc. */
  unit: string;
  /** Service vs stocked vs non-inventory (supplies, fees). */
  inventoryType?: InventoryItemType;
  /** Store organization — department. */
  locDepartment?: string;
  /** Shelf / bay. */
  locShelf?: string;
  /** Location / bin / site detail. */
  locSite?: string;
  /** Cost price per unit (“unit cost”). */
  costPrice: number;
  /** Rolling or last computed average cost (optional; may mirror unit cost until receipts feed it). */
  averageCost?: number;
  /** Standard retail price — POS uses this unless a branch override exists. */
  sellingPrice: number;
  /** Per-shop/branch price overrides; omitted branches use standard price. */
  branchPrices?: BranchPriceMap;
  /** Universal Product Code for barcode / inventory scanners (synced with legacy `barcode` on save). */
  upc?: string;
  /** Legacy alias; normalized to match UPC when present. */
  barcode?: string;
  brand?: string;
  description?: string;
  /** Internal notes (stock issues, buyer notes). Distinct from customer-facing description. */
  productNotes?: string;
  /** When false, tax engines should treat line as exempt (jurisdiction rules apply). */
  taxable?: boolean;
  supplierId?: Id;
  reorderQty?: number;
  /** Secondary catalog match — link to another SKU for lookup / substitute. */
  alternativeProductId?: Id;
  /**
   * Assembly / disassembly recipes (local-first). Stock moves run from Inventory → Assembly actions, not on every save.
   */
  bom?: ProductBom;
  active: boolean;
  /**
   * When false, POS must not sell this SKU (admin hold). Distinct from `active` (catalog / operational visibility).
   * Omitted in legacy data — treated as true when loading.
   */
  forSale?: boolean;
  /**
   * When true, catalog and planned storefront views flag this SKU as eligible for external iDeliver providers
   * (verified outside drivers/contractors — see Settings → iDeliver).
   */
  flagExternalIdeliver?: boolean;
  /** Up to 8 WebP images (`dataUrl`), ordered. Omitted in legacy data; normalized to `[]` when loading. */
  images?: ProductImage[];
  // Sector-specific bag of fields; validated by UI config.
  sectorData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type StockRecord = {
  id: Id;
  branchId: Id;
  productId: Id;
  onHandQty: number;
  updatedAt: string;
};

export type PurchaseOrderStatus = "draft" | "ordered" | "received" | "cancelled";

export type PurchaseOrderItem = {
  id: Id;
  productId: Id;
  orderedQty: number;
  expectedUnitCost: number;
};

export type PurchaseOrder = {
  id: Id;
  supplierId: Id;
  branchId: Id;
  status: PurchaseOrderStatus;
  reference?: string;
  notes?: string;
  items: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
};

export type GoodsReceiptItem = {
  id: Id;
  productId: Id;
  receivedQty: number;
  unitCost: number;
};

export type GoodsReceipt = {
  id: Id;
  purchaseOrderId: Id;
  branchId: Id;
  receivedAt: string;
  notes?: string;
  items: GoodsReceiptItem[];
  createdAt: string;
};
