import { browserLocalJson } from "@/modules/inventory/services/storage";
import {
  defaultFareBands,
  emptyIdeliverProvider,
  type IdeliverExternalProvider,
} from "@/modules/dashboard/settings/ideliver/ideliver-types";

const NS = { namespace: "seigen.pos", version: 1 as const };

type Stored = { providers: unknown[] };

function migrateProvider(raw: unknown, fallbackId: string): IdeliverExternalProvider {
  const r = raw as Partial<IdeliverExternalProvider> & { id?: string };
  const id = typeof r.id === "string" && r.id ? r.id : fallbackId;
  const base = emptyIdeliverProvider(id);
  const bands = Array.isArray(r.fareBands) && r.fareBands.length > 0 ? sanitizeBands(r.fareBands as IdeliverFareBandLike[]) : defaultFareBands();
  return {
    ...base,
    ...r,
    id,
    fareBands: bands,
    businessConditions: typeof r.businessConditions === "string" ? r.businessConditions : "",
    photoWebp: typeof r.photoWebp === "string" || r.photoWebp === null ? r.photoWebp : null,
    policeClearanceWebp:
      typeof r.policeClearanceWebp === "string" || r.policeClearanceWebp === null ? r.policeClearanceWebp : null,
  };
}

type IdeliverFareBandLike = { id?: string; maxRadiusKm?: number; fee?: number };

function sanitizeBands(rows: IdeliverFareBandLike[]) {
  return rows
    .map((row, i) => ({
      id: typeof row.id === "string" && row.id ? row.id : `fb_${i}_${Date.now()}`,
      maxRadiusKm: Math.max(0.1, Number.isFinite(row.maxRadiusKm) ? Number(row.maxRadiusKm) : 5),
      fee: Math.max(0, Number.isFinite(row.fee) ? Number(row.fee) : 0),
    }))
    .sort((a, b) => a.maxRadiusKm - b.maxRadiusKm);
}

export const ideliverProvidersStorageKey = (() => {
  const store = browserLocalJson(NS);
  return store?.fullKey("ideliver_providers") ?? "seigen.pos:v1:ideliver_providers";
})();

export function loadIdeliverProviders(): IdeliverExternalProvider[] {
  const store = browserLocalJson(NS);
  if (!store) return [];
  const data = store.read<Stored>("ideliver_providers", { providers: [] });
  const list = Array.isArray(data.providers) ? data.providers : [];
  return list.map((raw, i) => migrateProvider(raw, `migrated_${i}`));
}

export function saveIdeliverProviders(providers: IdeliverExternalProvider[]): void {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("ideliver_providers", { providers });
}
