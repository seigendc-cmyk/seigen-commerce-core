import { browserLocalJson } from "@/modules/inventory/services/storage";
import type { ConsignmentIssueInvoice, ConsignmentIssueInvoiceAuditEntry } from "@/modules/consignment/types/consignment-issue-invoice";

const NS = { namespace: "seigen.consignment", version: 1 as const };

export const CONSIGNMENT_ISSUE_INVOICE_EVENT = "seigen-consignment-issue-invoice-updated";

type Db = { invoices: ConsignmentIssueInvoice[]; audit: ConsignmentIssueInvoiceAuditEntry[] };

function uid(p: string): string {
  return `${p}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { invoices: [], audit: [] };
  return store.read<Db>("issue_invoices", { invoices: [], audit: [] });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("issue_invoices", db);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CONSIGNMENT_ISSUE_INVOICE_EVENT));
}

export function listIssueInvoices(limit = 500): ConsignmentIssueInvoice[] {
  return getDb()
    .invoices.slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export function getIssueInvoice(id: string): ConsignmentIssueInvoice | undefined {
  return getDb().invoices.find((x) => x.id === id);
}

export function saveIssueInvoice(row: ConsignmentIssueInvoice) {
  const db = getDb();
  const idx = db.invoices.findIndex((x) => x.id === row.id);
  if (idx >= 0) db.invoices[idx] = row;
  else db.invoices.push(row);
  setDb(db);
}

export function appendAudit(entry: Omit<ConsignmentIssueInvoiceAuditEntry, "id"> & { id?: string }) {
  const db = getDb();
  const row: ConsignmentIssueInvoiceAuditEntry = {
    id: entry.id ?? uid("cii_aud"),
    ...entry,
  };
  db.audit.push(row);
  setDb(db);
}

export function listInvoiceAudit(invoiceId: string, limit = 200): ConsignmentIssueInvoiceAuditEntry[] {
  return getDb()
    .audit.filter((a) => a.invoiceId === invoiceId)
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-limit);
}

export function documentNumberExists(documentNumber: string, excludeId?: string): boolean {
  const n = documentNumber.trim().toLowerCase();
  return getDb().invoices.some((x) => x.id !== excludeId && x.documentNumber.trim().toLowerCase() === n);
}
