import { browserLocalJson } from "@/modules/inventory/services/storage";

const NS = { namespace: "seigen.cashplan", version: 1 as const };

export const CASHPLAN_FLOW_USER_PROJECTIONS_UPDATED = "seigen-cashplan-flow-user-projections-updated";

export type CashPlanUserFlowProjection = {
  id: string;
  label: string;
  /** Cash in vs out for net / running liquid. */
  direction: "inflow" | "outflow";
  /** Amounts keyed by column key (week Monday YYYY-MM-DD, month YYYY-MM, year YYYY). */
  cells: Record<string, number>;
};

type Db = { rows: CashPlanUserFlowProjection[] };

function uid(): string {
  return `uflow_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { rows: [] };
  return store.read<Db>("funds_flow_user_projections", { rows: [] });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("funds_flow_user_projections", db);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CASHPLAN_FLOW_USER_PROJECTIONS_UPDATED));
  }
}

export function cashPlanFlowUserProjectionsStorageKey(): string {
  const store = browserLocalJson(NS);
  return store?.fullKey("funds_flow_user_projections") ?? "seigen.cashplan:v1:funds_flow_user_projections";
}

export function listCashPlanUserFlowProjections(): CashPlanUserFlowProjection[] {
  return getDb().rows.slice();
}

export function addCashPlanUserFlowProjection(input: { label: string; direction: "inflow" | "outflow" }): CashPlanUserFlowProjection {
  const row: CashPlanUserFlowProjection = {
    id: uid(),
    label: input.label.trim() || "Projection",
    direction: input.direction,
    cells: {},
  };
  const db = getDb();
  db.rows.push(row);
  setDb(db);
  return row;
}

export function updateCashPlanUserFlowProjectionCell(id: string, columnKey: string, value: number | null): void {
  const db = getDb();
  const row = db.rows.find((r) => r.id === id);
  if (!row) return;
  if (value == null || !Number.isFinite(value) || Math.abs(value) < 1e-9) {
    delete row.cells[columnKey];
  } else {
    row.cells[columnKey] = Math.round(value * 100) / 100;
  }
  setDb(db);
}

export function updateCashPlanUserFlowProjectionMeta(
  id: string,
  patch: Partial<Pick<CashPlanUserFlowProjection, "label" | "direction">>,
): void {
  const db = getDb();
  const row = db.rows.find((r) => r.id === id);
  if (!row) return;
  if (patch.label != null) row.label = patch.label.trim() || row.label;
  if (patch.direction != null) row.direction = patch.direction;
  setDb(db);
}

export function removeCashPlanUserFlowProjection(id: string): void {
  const db = getDb();
  db.rows = db.rows.filter((r) => r.id !== id);
  setDb(db);
}
