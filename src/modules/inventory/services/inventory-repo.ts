import type { InventoryItemType } from "../types/inventory-product-meta";
import type { BomLine, Branch, Id, Product, ProductBom, StockRecord, Supplier } from "../types/models";
import { browserLocalJson } from "./storage";

const NS = { namespace: "seigen.inventory", version: 1 as const };
const MAX_PRODUCT_IMAGES = 8;

function normalizeBomLine(raw: unknown): BomLine | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const productId = typeof o.productId === "string" && o.productId.trim() ? o.productId.trim() : "";
  const qty = typeof o.qty === "number" && Number.isFinite(o.qty) ? o.qty : Number(o.qty);
  if (!productId || !Number.isFinite(qty) || qty <= 0) return null;
  const label = typeof o.label === "string" && o.label.trim() ? o.label.trim() : undefined;
  return { productId, qty, label };
}

function normalizeBom(raw: unknown): ProductBom | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const assemblyRaw = Array.isArray(o.assemblyInputs) ? o.assemblyInputs : [];
  const disRaw = Array.isArray(o.disassemblyOutputs) ? o.disassemblyOutputs : [];
  const assemblyInputs: BomLine[] = [];
  const seenA = new Set<string>();
  for (const x of assemblyRaw) {
    const ln = normalizeBomLine(x);
    if (!ln || seenA.has(ln.productId)) continue;
    seenA.add(ln.productId);
    assemblyInputs.push(ln);
  }
  const disassemblyOutputs: BomLine[] = [];
  const seenD = new Set<string>();
  for (const x of disRaw) {
    const ln = normalizeBomLine(x);
    if (!ln || seenD.has(ln.productId)) continue;
    seenD.add(ln.productId);
    disassemblyOutputs.push(ln);
  }
  if (assemblyInputs.length === 0 && disassemblyOutputs.length === 0) return undefined;
  return {
    assemblyInputs: assemblyInputs.length > 0 ? assemblyInputs : undefined,
    disassemblyOutputs: disassemblyOutputs.length > 0 ? disassemblyOutputs : undefined,
  };
}

type DbShape = {
  branches: Branch[];
  suppliers: Supplier[];
  products: Product[];
  stock: StockRecord[];
};

const DEFAULT_BRANCH_ID = "branch_default";

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix: string): Id {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

/** Ensures products persisted before Phase 1.5 still load with pricing fields. */
export function normalizeProduct(p: Product): Product {
  const cost = p.costPrice;
  const sell = p.sellingPrice;
  const images = Array.isArray(p.images) ? p.images : [];
  const cleanedImages = images
    .map((raw, i) => {
      if (!raw || typeof raw !== "object") return null;
      const img = raw as { id?: string; order?: number; dataUrl?: string; url?: string };
      const dataUrl =
        typeof img.dataUrl === "string" && img.dataUrl
          ? img.dataUrl
          : typeof img.url === "string"
            ? img.url
            : "";
      if (!dataUrl) return null;
      return {
        id: typeof img.id === "string" && img.id ? img.id : `img_${i}_${p.id}`,
        dataUrl,
        order: typeof img.order === "number" && Number.isFinite(img.order) ? img.order : i,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_PRODUCT_IMAGES)
    .map((img, i) => ({ ...img, order: i }));
  const scanCode =
    typeof p.upc === "string" && p.upc.trim()
      ? p.upc.trim()
      : typeof p.barcode === "string" && p.barcode.trim()
        ? p.barcode.trim()
        : "";
  const invOk = new Set<string>(["service", "inventory", "non_inventory"]);
  const inventoryType: InventoryItemType = invOk.has(String(p.inventoryType))
    ? (p.inventoryType as InventoryItemType)
    : "inventory";

  const branchPrices: NonNullable<Product["branchPrices"]> = {};
  if (p.branchPrices && typeof p.branchPrices === "object") {
    for (const [bid, raw] of Object.entries(p.branchPrices)) {
      if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) branchPrices[bid] = raw;
    }
  }

  const unitCost = typeof cost === "number" && Number.isFinite(cost) ? Math.max(0, cost) : 0;
  const avgIn = p.averageCost;
  const averageCost =
    typeof avgIn === "number" && Number.isFinite(avgIn) ? Math.max(0, avgIn) : unitCost;

  return {
    ...p,
    costPrice: unitCost,
    sellingPrice: typeof sell === "number" && Number.isFinite(sell) ? Math.max(0, sell) : 0,
    averageCost,
    inventoryType,
    locDepartment: typeof p.locDepartment === "string" ? p.locDepartment : undefined,
    locShelf: typeof p.locShelf === "string" ? p.locShelf : undefined,
    locSite: typeof p.locSite === "string" ? p.locSite : undefined,
    upc: scanCode || undefined,
    barcode: scanCode || undefined,
    branchPrices: Object.keys(branchPrices).length > 0 ? branchPrices : undefined,
    productNotes: typeof p.productNotes === "string" ? p.productNotes : undefined,
    taxable: p.taxable !== false,
    supplierId: typeof p.supplierId === "string" && p.supplierId ? p.supplierId : undefined,
    reorderQty: Math.max(0, Math.floor(Number.isFinite(p.reorderQty) ? Number(p.reorderQty) : 0)),
    alternativeProductId:
      typeof p.alternativeProductId === "string" && p.alternativeProductId
        ? p.alternativeProductId
        : undefined,
    bom: normalizeBom(p.bom),
    images: cleanedImages,
    flagExternalIdeliver: Boolean(p.flagExternalIdeliver),
    forSale: typeof p.forSale === "boolean" ? p.forSale : true,
  };
}

function getDb(): DbShape {
  const store = browserLocalJson(NS);
  if (!store) {
    return { branches: [], suppliers: [], products: [], stock: [] };
  }
  const db = store.read<DbShape>("db", { branches: [], suppliers: [], products: [], stock: [] });
  // Ensure default branch exists.
  if (!db.branches.some((b) => b.id === DEFAULT_BRANCH_ID)) {
    db.branches.unshift({
      id: DEFAULT_BRANCH_ID,
      name: "Main branch",
      isDefault: true,
      createdAt: nowIso(),
    });
    store.write("db", db);
  }
  return db;
}

function setDb(db: DbShape) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("db", db);
}

export const inventoryKeys = {
  db: (() => {
    const store = browserLocalJson(NS);
    return store?.fullKey("db") ?? `${NS.namespace}:v${NS.version}:db`;
  })(),
};

export const InventoryRepo = {
  // Branches
  listBranches(): Branch[] {
    return getDb().branches;
  },
  getBranch(id: Id): Branch | undefined {
    return getDb().branches.find((b) => b.id === id);
  },
  getDefaultBranch(): Branch {
    const branches = getDb().branches;
    return branches.find((b) => b.isDefault) ?? branches[0]!;
  },

  // Suppliers
  listSuppliers(): Supplier[] {
    return getDb().suppliers.slice().sort((a, b) => a.name.localeCompare(b.name));
  },
  addSupplier(input: Omit<Supplier, "id" | "createdAt">): Supplier {
    const db = getDb();
    const supplier: Supplier = { ...input, id: uid("sup"), createdAt: nowIso() };
    db.suppliers.push(supplier);
    setDb(db);
    return supplier;
  },
  getSupplier(id: Id): Supplier | undefined {
    return getDb().suppliers.find((s) => s.id === id);
  },

  // Products
  listProducts(): Product[] {
    return getDb()
      .products.map((p) => normalizeProduct(p))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  addProduct(
    input: Omit<Product, "id" | "createdAt" | "updatedAt"> & { id?: Id },
  ): Product {
    const db = getDb();
    const skuKey = input.sku.trim().toLowerCase();
    if (skuKey.length > 0 && db.products.some((p) => p.sku.trim().toLowerCase() === skuKey)) {
      throw new Error(`A product with SKU "${input.sku.trim()}" already exists. Edit the existing item instead.`);
    }
    const ts = nowIso();
    const product: Product = normalizeProduct({
      ...input,
      id: input.id ?? uid("prd"),
      createdAt: ts,
      updatedAt: ts,
    });
    db.products.push(product);
    setDb(db);
    return product;
  },
  getProduct(id: Id): Product | undefined {
    const p = getDb().products.find((x) => x.id === id);
    return p ? normalizeProduct(p) : undefined;
  },
  updateProduct(
    id: Id,
    patch: Partial<Omit<Product, "id" | "createdAt">>,
  ): Product | undefined {
    const db = getDb();
    const idx = db.products.findIndex((p) => p.id === id);
    if (idx < 0) return undefined;
    const prev = normalizeProduct(db.products[idx]!);
    const next = normalizeProduct({
      ...prev,
      ...patch,
      id: prev.id,
      createdAt: prev.createdAt,
      updatedAt: nowIso(),
    });
    const prevSkuKey = prev.sku.trim().toLowerCase();
    const nextSkuKey = next.sku.trim().toLowerCase();
    const skuChanged = prevSkuKey !== nextSkuKey;
    if (
      skuChanged &&
      nextSkuKey.length > 0 &&
      db.products.some((p) => p.id !== id && p.sku.trim().toLowerCase() === nextSkuKey)
    ) {
      throw new Error(`Another product already uses SKU "${next.sku.trim()}".`);
    }
    db.products[idx] = next;
    setDb(db);
    return next;
  },

  // Stock
  listStockByBranch(branchId: Id): StockRecord[] {
    return getDb().stock.filter((s) => s.branchId === branchId);
  },
  getStock(branchId: Id, productId: Id): StockRecord | undefined {
    return getDb().stock.find((s) => s.branchId === branchId && s.productId === productId);
  },
  upsertStock(branchId: Id, productId: Id, onHandQty: number): StockRecord {
    const db = getDb();
    const existing = db.stock.find((s) => s.branchId === branchId && s.productId === productId);
    const ts = nowIso();
    if (existing) {
      existing.onHandQty = onHandQty;
      existing.updatedAt = ts;
      setDb(db);
      return existing;
    }
    const record: StockRecord = {
      id: uid("stk"),
      branchId,
      productId,
      onHandQty,
      updatedAt: ts,
    };
    db.stock.push(record);
    setDb(db);
    return record;
  },
  incrementStock(branchId: Id, productId: Id, delta: number): StockRecord {
    const current = this.getStock(branchId, productId)?.onHandQty ?? 0;
    return this.upsertStock(branchId, productId, current + delta);
  },
};

export function __dangerousResetInventoryDbForDemoOnly() {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.remove("db");
}
