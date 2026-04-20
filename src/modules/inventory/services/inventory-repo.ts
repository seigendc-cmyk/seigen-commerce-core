import type { InventoryItemType } from "../types/inventory-product-meta";
import type {
  BomLine,
  Branch,
  BranchKind,
  Id,
  Product,
  ProductBom,
  StockRecord,
  Supplier,
  SupplierContactPerson,
} from "../types/models";
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

function normalizeContactPerson(raw: unknown, generateId: () => Id): SupplierContactPerson | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" && o.name.trim() ? o.name.trim() : "";
  if (!name) return null;
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : generateId();
  return {
    id,
    name,
    role: typeof o.role === "string" && o.role.trim() ? o.role.trim() : undefined,
    phone: typeof o.phone === "string" && o.phone.trim() ? o.phone.trim() : undefined,
    email: typeof o.email === "string" && o.email.trim() ? o.email.trim() : undefined,
    isPrimary: o.isPrimary === true,
  };
}

/** Normalize supplier rows from local DB (defaults, trimmed strings, contact list). */
export function normalizeSupplier(s: Supplier): Supplier {
  const rawPersons = Array.isArray(s.contactPersons) ? s.contactPersons : [];
  const persons: SupplierContactPerson[] = [];
  for (const p of rawPersons) {
    const cp = normalizeContactPerson(p, () => uid("ct"));
    if (cp) persons.push(cp);
  }
  const paymentTermsDays =
    typeof s.paymentTermsDays === "number" && Number.isFinite(s.paymentTermsDays) && s.paymentTermsDays >= 0
      ? Math.min(365, Math.floor(s.paymentTermsDays))
      : undefined;

  return {
    ...s,
    name: (s.name ?? "").trim() || "Unnamed supplier",
    contactName: s.contactName?.trim() || undefined,
    phone: s.phone?.trim() || undefined,
    email: s.email?.trim() || undefined,
    address: s.address?.trim() || undefined,
    addressLine1: s.addressLine1?.trim() || undefined,
    addressLine2: s.addressLine2?.trim() || undefined,
    city: s.city?.trim() || undefined,
    region: s.region?.trim() || undefined,
    postalCode: s.postalCode?.trim() || undefined,
    country: s.country?.trim() || undefined,
    accountNumber: s.accountNumber?.trim() || undefined,
    businessTerms: s.businessTerms?.trim() || undefined,
    taxId: s.taxId?.trim() || undefined,
    paymentTermsDays,
    contactPersons: persons.length > 0 ? persons : undefined,
    updatedAt: s.updatedAt ?? s.createdAt,
  };
}

const DEFAULT_BRANCH_ID = "branch_default";

/** Legacy rows without `kind` behave as trading. */
export function branchKind(b: Branch): BranchKind {
  return b.kind ?? "trading";
}

export function isHeadOfficeBranch(b: Branch): boolean {
  return branchKind(b) === "head_office";
}

/** Shops that count toward billable location limits and can sell / move stock. */
export function branchIsBillableShop(b: Branch): boolean {
  return !isHeadOfficeBranch(b);
}

/** POS, receiving, assembly, stocktake (unless scoped elsewhere). */
export function branchAllowsTradingOperations(b: Branch): boolean {
  return !isHeadOfficeBranch(b);
}

export function normalizeBranch(b: Branch): Branch {
  return {
    ...b,
    kind: branchKind(b),
  };
}

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
  let write = false;
  // Ensure default branch exists — new installs: Head office (non-trading).
  if (!db.branches.some((b) => b.id === DEFAULT_BRANCH_ID)) {
    db.branches.unshift({
      id: DEFAULT_BRANCH_ID,
      name: "Head office",
      kind: "head_office",
      isDefault: true,
      createdAt: nowIso(),
    });
    write = true;
  }
  // Legacy rows: infer trading so existing "Main branch" keeps selling until you add HO explicitly.
  for (const b of db.branches) {
    if (b.kind == null) {
      b.kind = "trading";
      write = true;
    }
  }
  if (write) {
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
    return getDb().branches.map(normalizeBranch);
  },
  getBranch(id: Id): Branch | undefined {
    const b = getDb().branches.find((x) => x.id === id);
    return b ? normalizeBranch(b) : undefined;
  },
  getDefaultBranch(): Branch {
    const branches = getDb().branches;
    const raw = branches.find((b) => b.isDefault) ?? branches[0]!;
    return normalizeBranch(raw);
  },
  /**
   * First branch that can sell and hold stock (not Head office). Use for POS, PO receipts, assembly, default catalog.
   * Undefined when only Head office exists — user must add a trading shop.
   */
  getDefaultTradingBranch(): Branch | undefined {
    const branches = getDb().branches.map(normalizeBranch);
    const trading = branches.filter((b) => branchAllowsTradingOperations(b));
    if (trading.length === 0) return undefined;
    return trading.find((b) => b.isDefault) ?? trading[0];
  },
  addBranch(input: { name: string; kind?: BranchKind }): Branch {
    const db = getDb();
    const kind: BranchKind = input.kind ?? "trading";
    const row: Branch = {
      id: uid("br"),
      name: input.name.trim() || "Shop",
      kind,
      createdAt: nowIso(),
    };
    db.branches.push(row);
    setDb(db);
    return normalizeBranch(row);
  },
  updateBranch(id: Id, patch: Partial<Pick<Branch, "name" | "kind" | "address">>): Branch | undefined {
    const db = getDb();
    const idx = db.branches.findIndex((b) => b.id === id);
    if (idx < 0) return undefined;
    const prev = db.branches[idx]!;
    const next: Branch = {
      ...prev,
      ...patch,
      id: prev.id,
      createdAt: prev.createdAt,
    };
    db.branches[idx] = next;
    setDb(db);
    return normalizeBranch(next);
  },
  /** Marks one branch as default (e.g. primary trading shop for POS). Clears others. */
  setDefaultBranch(id: Id): void {
    const db = getDb();
    for (const b of db.branches) {
      b.isDefault = b.id === id;
    }
    setDb(db);
  },

  // Suppliers
  listSuppliers(): Supplier[] {
    return getDb()
      .suppliers.map((s) => normalizeSupplier(s))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  addSupplier(input: Omit<Supplier, "id" | "createdAt" | "updatedAt">): Supplier {
    const db = getDb();
    const ts = nowIso();
    const supplier = normalizeSupplier({
      ...input,
      id: uid("sup"),
      createdAt: ts,
      updatedAt: ts,
    } as Supplier);
    db.suppliers.push(supplier);
    setDb(db);
    return supplier;
  },
  getSupplier(id: Id): Supplier | undefined {
    const s = getDb().suppliers.find((x) => x.id === id);
    return s ? normalizeSupplier(s) : undefined;
  },
  updateSupplier(id: Id, patch: Partial<Omit<Supplier, "id" | "createdAt">>): Supplier | undefined {
    const db = getDb();
    const idx = db.suppliers.findIndex((s) => s.id === id);
    if (idx < 0) return undefined;
    const prev = normalizeSupplier(db.suppliers[idx]!);
    const next = normalizeSupplier({
      ...prev,
      ...patch,
      id: prev.id,
      createdAt: prev.createdAt,
      updatedAt: nowIso(),
    } as Supplier);
    db.suppliers[idx] = next;
    setDb(db);
    return next;
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
