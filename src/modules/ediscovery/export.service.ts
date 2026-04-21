import { getReviewSetBundle } from "./review-set.service";

function escapeCsv(v: any): string {
  const s = String(v ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function exportReviewSetAsCsv(reviewSetId: string) {
  const b = await getReviewSetBundle(reviewSetId);
  if (!b.ok) return b;
  const rows = b.items.map((it: any) => ({
    record_type: it.record_type,
    record_id: it.record_id,
    created_at: it.created_at,
  }));
  const header = ["record_type", "record_id", "created_at"];
  const csv = [header.join(","), ...rows.map((r) => header.map((h) => escapeCsv((r as any)[h])).join(","))].join("\n");
  const manifest = {
    reviewSetId,
    itemCount: rows.length,
    exportedAt: new Date().toISOString(),
    fields: header,
  };
  return { ok: true as const, csv, manifest };
}

