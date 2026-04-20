import { browserLocalJson } from "@/modules/inventory/services/storage";

const NS = { namespace: "seigen.poolwise", version: 1 as const };

export const POOLWISE_UPDATED_EVENT = "seigen-poolwise-updated";

export type PoolWiseTenantId = string;
export type PoolWiseVendorTenant = {
  tenantId: PoolWiseTenantId;
  name: string;
};

export type PoolType = "bulk_purchase" | "stock_refill" | "disposal" | "supplier_listing";
export type PoolStatus = "draft" | "open" | "locked" | "ordered" | "receiving" | "allocated" | "closed";

export type Pool = {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdByTenantId: PoolWiseTenantId;
  type: PoolType;
  title: string;
  description: string;
  productQuery: string;
  status: PoolStatus;
  currency: string;
  /**
   * When set, suggested minimum contribution amount each tenant agrees to target.
   * Actual contributions can be reduced; dropouts are modeled explicitly.
   */
  targetContributionAmount: number | null;
  allowReducedContributions: boolean;
  allowDropouts: boolean;
  allocationMode: "by_contribution" | "by_ordered_qty" | "admin_override";
};

export type PoolMember = {
  id: string;
  poolId: string;
  tenantId: PoolWiseTenantId;
  tenantName: string;
  joinedAt: string;
  status: "active" | "reduced" | "dropped";
  pledgedAmount: number | null;
  notes: string;
};

export type DisposalListing = {
  id: string;
  createdAt: string;
  updatedAt: string;
  sellerTenantId: PoolWiseTenantId;
  sellerName: string;
  productLabel: string;
  sku?: string;
  qtyAvailable: number;
  unit: string;
  unitPrice: number;
  currency: string;
  notes: string;
  status: "active" | "sold" | "withdrawn";
};

export type SupplierPriceBreak = {
  minQty: number;
  unitPrice: number;
};

export type SupplierOffer = {
  id: string;
  createdAt: string;
  updatedAt: string;
  poolId: string | null;
  supplierTenantId: PoolWiseTenantId;
  supplierName: string;
  productLabel: string;
  sku?: string;
  currency: string;
  moq: number;
  leadTimeDays: number;
  priceBreaks: SupplierPriceBreak[];
  notes: string;
  status: "active" | "selected" | "rejected" | "withdrawn";
};

export type ContributionKind = "pledge" | "contribute" | "reduce" | "dropout" | "refund" | "allocate_to_order";
export type ContributionEntry = {
  id: string;
  createdAt: string;
  poolId: string;
  tenantId: PoolWiseTenantId;
  tenantName: string;
  kind: ContributionKind;
  amount: number;
  memo: string;
};

export type AllocationLine = {
  id: string;
  poolId: string;
  tenantId: PoolWiseTenantId;
  tenantName: string;
  orderedQty: number | null;
  allocatedQty: number;
  allocatedValue: number;
  memo: string;
  updatedAt: string;
};

type Db = {
  tenants: PoolWiseVendorTenant[];
  pools: Pool[];
  members: PoolMember[];
  disposal: DisposalListing[];
  offers: SupplierOffer[];
  contributions: ContributionEntry[];
  allocations: AllocationLine[];
};

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) {
    return { tenants: [], pools: [], members: [], disposal: [], offers: [], contributions: [], allocations: [] };
  }
  return store.read<Db>("db", {
    tenants: [],
    pools: [],
    members: [],
    disposal: [],
    offers: [],
    contributions: [],
    allocations: [],
  });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("db", db);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(POOLWISE_UPDATED_EVENT));
}

export function poolwiseStorageKey(): string {
  const store = browserLocalJson(NS);
  return store?.fullKey("db") ?? "seigen.poolwise:v1:db";
}

export function listPoolWiseTenants(): PoolWiseVendorTenant[] {
  return getDb().tenants.slice().sort((a, b) => a.name.localeCompare(b.name));
}

export function upsertPoolWiseTenant(input: { tenantId: string; name: string }): PoolWiseVendorTenant {
  const db = getDb();
  const tenantId = input.tenantId.trim();
  const name = input.name.trim() || tenantId;
  const idx = db.tenants.findIndex((t) => t.tenantId === tenantId);
  const row = { tenantId, name };
  if (idx >= 0) db.tenants[idx] = row;
  else db.tenants.push(row);
  setDb(db);
  return row;
}

export function listPools(): Pool[] {
  return getDb().pools.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createPool(input: Omit<Pool, "id" | "createdAt" | "updatedAt" | "status"> & { status?: PoolStatus }): Pool {
  const db = getDb();
  const ts = nowIso();
  const row: Pool = {
    id: uid("pool"),
    createdAt: ts,
    updatedAt: ts,
    createdByTenantId: input.createdByTenantId,
    type: input.type,
    title: input.title.trim() || "Pool",
    description: input.description.trim(),
    productQuery: input.productQuery.trim(),
    status: input.status ?? "open",
    currency: input.currency || "USD",
    targetContributionAmount:
      input.targetContributionAmount == null ? null : round2(Math.max(0, Number(input.targetContributionAmount) || 0)),
    allowReducedContributions: Boolean(input.allowReducedContributions),
    allowDropouts: Boolean(input.allowDropouts),
    allocationMode: input.allocationMode,
  };
  db.pools.push(row);
  setDb(db);
  return row;
}

export function updatePool(id: string, patch: Partial<Pick<Pool, "status" | "title" | "description" | "targetContributionAmount" | "allocationMode">>): void {
  const db = getDb();
  const idx = db.pools.findIndex((p) => p.id === id);
  if (idx < 0) return;
  const prev = db.pools[idx]!;
  db.pools[idx] = {
    ...prev,
    ...patch,
    title: patch.title != null ? patch.title.trim() || prev.title : prev.title,
    description: patch.description != null ? patch.description.trim() : prev.description,
    targetContributionAmount:
      patch.targetContributionAmount !== undefined
        ? patch.targetContributionAmount == null
          ? null
          : round2(Math.max(0, Number(patch.targetContributionAmount) || 0))
        : prev.targetContributionAmount,
    updatedAt: nowIso(),
  };
  setDb(db);
}

export function listPoolMembers(poolId: string): PoolMember[] {
  return getDb()
    .members.filter((m) => m.poolId === poolId)
    .slice()
    .sort((a, b) => a.tenantName.localeCompare(b.tenantName));
}

export function joinPool(input: { poolId: string; tenantId: string; tenantName: string; pledgedAmount?: number | null }): PoolMember {
  const db = getDb();
  if (db.members.some((m) => m.poolId === input.poolId && m.tenantId === input.tenantId)) {
    return db.members.find((m) => m.poolId === input.poolId && m.tenantId === input.tenantId)!;
  }
  const ts = nowIso();
  const row: PoolMember = {
    id: uid("mem"),
    poolId: input.poolId,
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    joinedAt: ts,
    status: "active",
    pledgedAmount: input.pledgedAmount == null ? null : round2(Math.max(0, Number(input.pledgedAmount) || 0)),
    notes: "",
  };
  db.members.push(row);
  if (row.pledgedAmount != null && row.pledgedAmount > 0) {
    db.contributions.push({
      id: uid("ctr"),
      createdAt: ts,
      poolId: row.poolId,
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      kind: "pledge",
      amount: row.pledgedAmount,
      memo: "Pledged",
    });
  }
  setDb(db);
  return row;
}

export function setMemberStatus(poolId: string, tenantId: string, status: PoolMember["status"], memo?: string) {
  const db = getDb();
  const idx = db.members.findIndex((m) => m.poolId === poolId && m.tenantId === tenantId);
  if (idx < 0) return;
  const prev = db.members[idx]!;
  db.members[idx] = { ...prev, status };
  db.contributions.push({
    id: uid("ctr"),
    createdAt: nowIso(),
    poolId,
    tenantId,
    tenantName: prev.tenantName,
    kind: status === "dropped" ? "dropout" : "reduce",
    amount: 0,
    memo: memo?.trim() || (status === "dropped" ? "Dropped out" : "Reduced contribution"),
  });
  setDb(db);
}

export function listDisposalListings(): DisposalListing[] {
  return getDb().disposal.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createDisposalListing(input: Omit<DisposalListing, "id" | "createdAt" | "updatedAt" | "status">): DisposalListing {
  const db = getDb();
  const ts = nowIso();
  const row: DisposalListing = {
    id: uid("dsl"),
    createdAt: ts,
    updatedAt: ts,
    sellerTenantId: input.sellerTenantId,
    sellerName: input.sellerName.trim() || input.sellerTenantId,
    productLabel: input.productLabel.trim() || "Product",
    sku: input.sku?.trim() || undefined,
    qtyAvailable: Math.max(0, Number(input.qtyAvailable) || 0),
    unit: input.unit.trim() || "unit",
    unitPrice: round2(Math.max(0, Number(input.unitPrice) || 0)),
    currency: input.currency || "USD",
    notes: input.notes?.trim() || "",
    status: "active",
  };
  db.disposal.push(row);
  setDb(db);
  return row;
}

export function listSupplierOffers(poolId?: string | null): SupplierOffer[] {
  const rows = getDb().offers.slice();
  const filtered = poolId === undefined ? rows : rows.filter((o) => (poolId === null ? o.poolId == null : o.poolId === poolId));
  return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createSupplierOffer(input: Omit<SupplierOffer, "id" | "createdAt" | "updatedAt" | "status">): SupplierOffer {
  const db = getDb();
  const ts = nowIso();
  const breaks = (input.priceBreaks ?? [])
    .map((b) => ({ minQty: Math.max(1, Math.floor(Number(b.minQty) || 1)), unitPrice: round2(Math.max(0, Number(b.unitPrice) || 0)) }))
    .sort((a, b) => a.minQty - b.minQty);
  const row: SupplierOffer = {
    id: uid("off"),
    createdAt: ts,
    updatedAt: ts,
    poolId: input.poolId ?? null,
    supplierTenantId: input.supplierTenantId,
    supplierName: input.supplierName.trim() || input.supplierTenantId,
    productLabel: input.productLabel.trim() || "Product",
    sku: input.sku?.trim() || undefined,
    currency: input.currency || "USD",
    moq: Math.max(1, Math.floor(Number(input.moq) || 1)),
    leadTimeDays: Math.max(0, Math.floor(Number(input.leadTimeDays) || 0)),
    priceBreaks: breaks.length ? breaks : [{ minQty: Math.max(1, Math.floor(Number(input.moq) || 1)), unitPrice: 0 }],
    notes: input.notes?.trim() || "",
    status: "active",
  };
  db.offers.push(row);
  setDb(db);
  return row;
}

export function recordContribution(input: Omit<ContributionEntry, "id" | "createdAt">): ContributionEntry {
  const db = getDb();
  const row: ContributionEntry = {
    id: uid("ctr"),
    createdAt: nowIso(),
    poolId: input.poolId,
    tenantId: input.tenantId,
    tenantName: input.tenantName.trim() || input.tenantId,
    kind: input.kind,
    amount: round2(Number(input.amount) || 0),
    memo: input.memo?.trim() || "",
  };
  db.contributions.push(row);
  setDb(db);
  return row;
}

export function listContributions(poolId: string): ContributionEntry[] {
  return getDb()
    .contributions.filter((c) => c.poolId === poolId)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function contributedTotalByTenant(poolId: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of getDb().contributions.filter((x) => x.poolId === poolId)) {
    const prev = m.get(c.tenantId) ?? 0;
    const delta =
      c.kind === "contribute" || c.kind === "pledge"
        ? c.amount
        : c.kind === "refund"
          ? -c.amount
          : c.kind === "allocate_to_order"
            ? 0
            : 0;
    m.set(c.tenantId, round2(prev + delta));
  }
  return m;
}

export function setAllocationLine(input: Omit<AllocationLine, "id" | "updatedAt"> & { id?: string }): AllocationLine {
  const db = getDb();
  const ts = nowIso();
  const id = input.id ?? uid("al");
  const row: AllocationLine = {
    id,
    poolId: input.poolId,
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    orderedQty: input.orderedQty == null ? null : Math.max(0, Number(input.orderedQty) || 0),
    allocatedQty: Math.max(0, Number(input.allocatedQty) || 0),
    allocatedValue: round2(Math.max(0, Number(input.allocatedValue) || 0)),
    memo: input.memo?.trim() || "",
    updatedAt: ts,
  };
  const idx = db.allocations.findIndex((a) => a.id === id);
  if (idx >= 0) db.allocations[idx] = row;
  else db.allocations.push(row);
  setDb(db);
  return row;
}

export function listAllocations(poolId: string): AllocationLine[] {
  return getDb()
    .allocations.filter((a) => a.poolId === poolId)
    .slice()
    .sort((a, b) => a.tenantName.localeCompare(b.tenantName));
}

export function chooseBestUnitPrice(offer: SupplierOffer, qty: number): number {
  const q = Math.max(0, Math.floor(qty));
  const breaks = offer.priceBreaks.slice().sort((a, b) => a.minQty - b.minQty);
  let best = breaks[0]?.unitPrice ?? 0;
  for (const b of breaks) {
    if (q >= b.minQty) best = b.unitPrice;
  }
  return round2(best);
}

