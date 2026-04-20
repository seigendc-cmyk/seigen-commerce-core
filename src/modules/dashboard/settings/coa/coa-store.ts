import { browserLocalJson } from "@/modules/inventory/services/storage";
import type { CoaAccountRow } from "@/modules/dashboard/settings/coa/coa-types";

const NS = { namespace: "seigen.settings", version: 1 as const };

export const COA_UPDATED_EVENT = "seigen-coa-updated";

type Db = { rows: CoaAccountRow[] };

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { rows: [] };
  return store.read<Db>("coa_rows", { rows: [] });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("coa_rows", db);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(COA_UPDATED_EVENT));
}

export function coaStorageKey(): string {
  const store = browserLocalJson(NS);
  return store?.fullKey("coa_rows") ?? "seigen.settings:v1:coa_rows";
}

export function listCoaRows(): CoaAccountRow[] {
  return getDb().rows.slice();
}

export function setCoaRows(rows: CoaAccountRow[]): void {
  setDb({ rows });
}

export function listCoaPostingAccounts(): Array<{ code: string; name: string }> {
  const rows = listCoaRows()
    .filter((r) => r.code.trim() && r.name.trim())
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  return rows.map((r) => ({ code: r.code.trim(), name: r.name.trim() }));
}

export function findCoaAccountByCode(code: string): { code: string; name: string } | null {
  const c = code.trim();
  if (!c) return null;
  const row = listCoaRows().find((r) => r.code.trim() === c);
  if (!row) return null;
  return { code: row.code.trim(), name: row.name.trim() || row.code.trim() };
}

