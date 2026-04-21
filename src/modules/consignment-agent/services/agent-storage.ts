import { browserLocalJson } from "@/modules/inventory/services/storage";
import type { AgentCashRemittance, AgentNotification, AgentSale, AgentShift, AgentStockRequest } from "../types/agent";

const NS = { namespace: "seigen.consignment.agent", version: 1 as const };
export const AGENT_EVENT = "seigen-consignment-agent-updated";

type Db = {
  shifts: AgentShift[];
  sales: AgentSale[];
  stockRequests: AgentStockRequest[];
  remittances: AgentCashRemittance[];
  notifications: AgentNotification[];
};

function uid(p: string): string {
  return `${p}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { shifts: [], sales: [], stockRequests: [], remittances: [], notifications: [] };
  return store.read<Db>("db", { shifts: [], sales: [], stockRequests: [], remittances: [], notifications: [] });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("db", db);
  window.dispatchEvent(new Event(AGENT_EVENT));
}

export function listShifts(): AgentShift[] {
  return getDb().shifts.slice().sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}
export function listSales(): AgentSale[] {
  return getDb().sales.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function listStockRequests(): AgentStockRequest[] {
  return getDb().stockRequests.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function listRemittances(): AgentCashRemittance[] {
  return getDb().remittances.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function listAgentNotifications(): AgentNotification[] {
  return getDb().notifications.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function upsertShift(row: AgentShift) {
  const db = getDb();
  const idx = db.shifts.findIndex((x) => x.id === row.id);
  if (idx >= 0) db.shifts[idx] = row;
  else db.shifts.push(row);
  setDb(db);
}
export function upsertSale(row: AgentSale) {
  const db = getDb();
  const idx = db.sales.findIndex((x) => x.id === row.id);
  if (idx >= 0) db.sales[idx] = row;
  else db.sales.push(row);
  setDb(db);
}
export function upsertStockRequest(row: AgentStockRequest) {
  const db = getDb();
  const idx = db.stockRequests.findIndex((x) => x.id === row.id);
  if (idx >= 0) db.stockRequests[idx] = row;
  else db.stockRequests.push(row);
  setDb(db);
}
export function upsertRemittance(row: AgentCashRemittance) {
  const db = getDb();
  const idx = db.remittances.findIndex((x) => x.id === row.id);
  if (idx >= 0) db.remittances[idx] = row;
  else db.remittances.push(row);
  setDb(db);
}

export function pushAgentNotification(n: Omit<AgentNotification, "id" | "createdAt"> & { id?: string; createdAt?: string }) {
  const db = getDb();
  db.notifications.push({
    id: n.id ?? uid("agn"),
    createdAt: n.createdAt ?? new Date().toISOString(),
    ...n,
    readAt: n.readAt ?? null,
  });
  setDb(db);
}

export function markNotificationRead(id: string) {
  const db = getDb();
  db.notifications = db.notifications.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
  setDb(db);
}

