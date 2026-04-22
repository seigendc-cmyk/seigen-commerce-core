import type {
  BranchReconciliationPackageV1,
  ReconProductMasterRow,
  ReconSaleRow,
  ReconShiftSummary,
  ReconStockRow,
  ReconStorefrontPublishState,
  ReconTerminalProfileSummary,
} from "./branch-reconciliation-package";

export type ReconConflictReportV1 = {
  schema: "seigen_branch_reconciliation_conflict_report";
  schemaVersion: 1;
  tenantId: string;
  branchId: string;
  generatedAt: string;
  left: { deviceId: string; generatedAt: string };
  right: { deviceId: string; generatedAt: string };
  conflicts: {
    product: Array<{ skuKey: string; kind: "missing_left" | "missing_right" | "field_mismatch"; fields?: string[] }>;
    stock: Array<{ productId: string; kind: "missing_left" | "missing_right" | "qty_mismatch"; leftQty?: number; rightQty?: number }>;
    sales: Array<{ kind: "missing_left" | "missing_right" | "receipt_collision"; saleId?: string; receiptNumber?: string }>;
    terminal: Array<{ kind: "code_collision" | "missing_left" | "missing_right"; terminalCode?: string; terminalId?: string }>;
    shift: Array<{ kind: "missing_left" | "missing_right" | "closing_mismatch"; shiftId: string; fields?: string[] }>;
    storefrontPublish: Array<{ kind: "missing_left" | "missing_right" | "listing_mismatch"; productId: string; leftListingId?: string; rightListingId?: string }>;
  };
};

function sortStable<T>(arr: T[], key: (t: T) => string): T[] {
  return arr.slice().sort((a, b) => key(a).localeCompare(key(b)));
}

function mapBy<T>(rows: T[], key: (t: T) => string): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows) m.set(key(r), r);
  return m;
}

function diffProducts(a: ReconProductMasterRow[], b: ReconProductMasterRow[]) {
  const A = mapBy(a, (r) => r.skuKey);
  const B = mapBy(b, (r) => r.skuKey);
  const keys = new Set([...A.keys(), ...B.keys()]);
  const out: Array<{ skuKey: string; kind: "missing_left" | "missing_right" | "field_mismatch"; fields?: string[] }> = [];
  for (const k of Array.from(keys).sort()) {
    const la = A.get(k);
    const rb = B.get(k);
    if (!la) out.push({ skuKey: k, kind: "missing_left" });
    else if (!rb) out.push({ skuKey: k, kind: "missing_right" });
    else {
      const fields: string[] = [];
      if (la.name !== rb.name) fields.push("name");
      if (la.unit !== rb.unit) fields.push("unit");
      if (la.sellingPrice !== rb.sellingPrice) fields.push("sellingPrice");
      if (la.active !== rb.active) fields.push("active");
      if (la.forSale !== rb.forSale) fields.push("forSale");
      if (la.taxable !== rb.taxable) fields.push("taxable");
      if (fields.length) out.push({ skuKey: k, kind: "field_mismatch", fields });
    }
  }
  return out;
}

function diffStock(a: ReconStockRow[], b: ReconStockRow[]) {
  const A = mapBy(a, (r) => r.productId);
  const B = mapBy(b, (r) => r.productId);
  const keys = new Set([...A.keys(), ...B.keys()]);
  const out: Array<{ productId: string; kind: "missing_left" | "missing_right" | "qty_mismatch"; leftQty?: number; rightQty?: number }> = [];
  for (const k of Array.from(keys).sort()) {
    const la = A.get(k);
    const rb = B.get(k);
    if (!la) out.push({ productId: k, kind: "missing_left" });
    else if (!rb) out.push({ productId: k, kind: "missing_right" });
    else if (Math.abs(la.onHandQty - rb.onHandQty) > 1e-9) out.push({ productId: k, kind: "qty_mismatch", leftQty: la.onHandQty, rightQty: rb.onHandQty });
  }
  return out;
}

function diffSales(a: ReconSaleRow[], b: ReconSaleRow[]) {
  const A = mapBy(a, (r) => r.id);
  const B = mapBy(b, (r) => r.id);
  const keys = new Set([...A.keys(), ...B.keys()]);
  const out: Array<{ kind: "missing_left" | "missing_right" | "receipt_collision"; saleId?: string; receiptNumber?: string }> = [];
  for (const k of Array.from(keys).sort()) {
    const la = A.get(k);
    const rb = B.get(k);
    if (!la) out.push({ kind: "missing_left", saleId: k });
    else if (!rb) out.push({ kind: "missing_right", saleId: k });
  }
  // Receipt collisions: same receiptNumber but different IDs
  const byReceiptA = new Map<string, string>();
  for (const s of a) if (s.receiptNumber) byReceiptA.set(s.receiptNumber, s.id);
  for (const s of b) {
    const id = byReceiptA.get(s.receiptNumber);
    if (id && id !== s.id) out.push({ kind: "receipt_collision", receiptNumber: s.receiptNumber });
  }
  return sortStable(out, (x) => `${x.kind}:${x.saleId ?? ""}:${x.receiptNumber ?? ""}`);
}

function diffTerminals(a: ReconTerminalProfileSummary[], b: ReconTerminalProfileSummary[]) {
  const A = mapBy(a, (r) => r.id);
  const B = mapBy(b, (r) => r.id);
  const keys = new Set([...A.keys(), ...B.keys()]);
  const out: Array<{ kind: "code_collision" | "missing_left" | "missing_right"; terminalCode?: string; terminalId?: string }> = [];
  for (const k of Array.from(keys).sort()) {
    const la = A.get(k);
    const rb = B.get(k);
    if (!la) out.push({ kind: "missing_left", terminalId: k });
    else if (!rb) out.push({ kind: "missing_right", terminalId: k });
  }
  const codeA = new Map<string, string>();
  for (const t of a) codeA.set(t.terminalCode.toLowerCase(), t.id);
  for (const t of b) {
    const id = codeA.get(t.terminalCode.toLowerCase());
    if (id && id !== t.id) out.push({ kind: "code_collision", terminalCode: t.terminalCode });
  }
  return sortStable(out, (x) => `${x.kind}:${x.terminalCode ?? ""}:${x.terminalId ?? ""}`);
}

function diffShifts(a: ReconShiftSummary[], b: ReconShiftSummary[]) {
  const A = mapBy(a, (r) => r.id);
  const B = mapBy(b, (r) => r.id);
  const keys = new Set([...A.keys(), ...B.keys()]);
  const out: Array<{ kind: "missing_left" | "missing_right" | "closing_mismatch"; shiftId: string; fields?: string[] }> = [];
  for (const k of Array.from(keys).sort()) {
    const la = A.get(k);
    const rb = B.get(k);
    if (!la) out.push({ kind: "missing_left", shiftId: k });
    else if (!rb) out.push({ kind: "missing_right", shiftId: k });
    else {
      const fields: string[] = [];
      if (la.status !== rb.status) fields.push("status");
      if ((la.closedAt ?? "") !== (rb.closedAt ?? "")) fields.push("closedAt");
      if ((la.closingCount ?? 0) !== (rb.closingCount ?? 0)) fields.push("closingCount");
      if (fields.length) out.push({ kind: "closing_mismatch", shiftId: k, fields });
    }
  }
  return out;
}

function diffPublishState(a: ReconStorefrontPublishState[], b: ReconStorefrontPublishState[]) {
  const A = mapBy(a, (r) => r.productId);
  const B = mapBy(b, (r) => r.productId);
  const keys = new Set([...A.keys(), ...B.keys()]);
  const out: Array<{ kind: "missing_left" | "missing_right" | "listing_mismatch"; productId: string; leftListingId?: string; rightListingId?: string }> = [];
  for (const k of Array.from(keys).sort()) {
    const la = A.get(k);
    const rb = B.get(k);
    if (!la) out.push({ kind: "missing_left", productId: k });
    else if (!rb) out.push({ kind: "missing_right", productId: k });
    else if (la.listingId !== rb.listingId) out.push({ kind: "listing_mismatch", productId: k, leftListingId: la.listingId, rightListingId: rb.listingId });
  }
  return out;
}

export function diffBranchReconciliationPackages(
  left: BranchReconciliationPackageV1,
  right: BranchReconciliationPackageV1,
): { ok: true; report: ReconConflictReportV1 } | { ok: false; error: string } {
  if (left.schema !== "seigen_branch_reconciliation_package" || right.schema !== "seigen_branch_reconciliation_package") {
    return { ok: false, error: "Invalid package schema." };
  }
  if (left.schemaVersion !== 1 || right.schemaVersion !== 1) return { ok: false, error: "Unsupported package version." };
  if (left.tenantId !== right.tenantId) return { ok: false, error: "Tenant mismatch." };
  if (left.branchId !== right.branchId) return { ok: false, error: "Branch mismatch." };

  const report: ReconConflictReportV1 = {
    schema: "seigen_branch_reconciliation_conflict_report",
    schemaVersion: 1,
    tenantId: left.tenantId,
    branchId: left.branchId,
    generatedAt: new Date().toISOString(),
    left: { deviceId: left.deviceId, generatedAt: left.generatedAt },
    right: { deviceId: right.deviceId, generatedAt: right.generatedAt },
    conflicts: {
      product: diffProducts(left.productMaster, right.productMaster),
      stock: diffStock(left.stock, right.stock),
      sales: diffSales(left.sales, right.sales),
      terminal: diffTerminals(left.terminals, right.terminals),
      shift: diffShifts(left.shifts, right.shifts),
      storefrontPublish: diffPublishState(left.storefrontPublishState, right.storefrontPublishState),
    },
  };

  return { ok: true, report };
}

export function formatReconConflictReportPlainText(r: ReconConflictReportV1): string {
  const lines: string[] = [];
  lines.push(`Branch reconciliation conflict report`);
  lines.push(`Tenant: ${r.tenantId}`);
  lines.push(`Branch: ${r.branchId}`);
  lines.push(`Left: ${r.left.deviceId} @ ${r.left.generatedAt}`);
  lines.push(`Right: ${r.right.deviceId} @ ${r.right.generatedAt}`);
  lines.push(`Generated: ${r.generatedAt}`);
  lines.push(``);

  const sections: Array<{ title: string; rows: any[] }> = [
    { title: "Product conflicts", rows: r.conflicts.product },
    { title: "Stock conflicts", rows: r.conflicts.stock },
    { title: "Sales conflicts", rows: r.conflicts.sales },
    { title: "Terminal conflicts", rows: r.conflicts.terminal },
    { title: "Shift conflicts", rows: r.conflicts.shift },
    { title: "Storefront publish-state conflicts", rows: r.conflicts.storefrontPublish },
  ];

  for (const s of sections) {
    lines.push(`${s.title}: ${s.rows.length}`);
    for (const row of s.rows.slice(0, 200)) {
      lines.push(`- ${JSON.stringify(row)}`);
    }
    if (s.rows.length > 200) lines.push(`- … truncated (${s.rows.length - 200} more)`);
    lines.push("");
  }
  return lines.join("\n");
}

