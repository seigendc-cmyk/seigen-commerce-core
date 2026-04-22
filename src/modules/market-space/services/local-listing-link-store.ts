import { browserLocalJson } from "@/modules/inventory/services/storage";

const NS = { namespace: "seigen.market-space", version: 1 as const };

type Db = {
  /** Keyed by `${branchId}:${productId}` */
  links: Record<string, { listingId: string; updatedAt: string }>;
};

function store() {
  return browserLocalJson(NS);
}

function getDb(): Db {
  const s = store();
  if (!s) return { links: {} };
  return s.read<Db>("listing_links", { links: {} });
}

function setDb(db: Db): void {
  const s = store();
  if (!s) return;
  s.write("listing_links", db);
}

function k(branchId: string, productId: string): string {
  return `${String(branchId)}:${String(productId)}`;
}

export function writeLocalListingLink(input: { branchId: string; productId: string; listingId: string }): void {
  const db = getDb();
  db.links[k(input.branchId, input.productId)] = { listingId: input.listingId, updatedAt: new Date().toISOString() };
  setDb(db);
}

export function readLocalListingIdForProduct(input: { branchId: string; productId: string }): string | null {
  const row = getDb().links[k(input.branchId, input.productId)];
  return row?.listingId ?? null;
}

export function listLocalListingLinksForBranch(branchId: string): Array<{ productId: string; listingId: string; updatedAt: string }> {
  const db = getDb();
  const out: Array<{ productId: string; listingId: string; updatedAt: string }> = [];
  const prefix = `${String(branchId)}:`;
  for (const [key, v] of Object.entries(db.links)) {
    if (!key.startsWith(prefix)) continue;
    const productId = key.slice(prefix.length);
    out.push({ productId, listingId: v.listingId, updatedAt: v.updatedAt });
  }
  return out.sort((a, b) => a.productId.localeCompare(b.productId));
}

