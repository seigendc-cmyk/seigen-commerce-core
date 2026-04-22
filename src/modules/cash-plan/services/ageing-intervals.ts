import { browserLocalJson } from "@/modules/inventory/services/storage";

export type AgeingUnit = "days" | "weeks" | "months";

export type AgeingIntervalsConfig = {
  unit: AgeingUnit;
  /**
   * Bucket boundaries expressed in chosen unit, for overdue buckets.
   * Example (days): [30, 60, 90] => 1-30, 31-60, 61-90, 90+
   * Example (weeks): [4, 8, 12]
   * Example (months): [1, 2, 3]
   */
  boundaries: number[];
  /**
   * Optional maximum period in selected unit.
   * When set, the final bucket becomes "prev–max" and an extra bucket "Over max" captures anything beyond it.
   */
  maxPeriod?: number | null;
};

const NS = { namespace: "seigen.cashplan", version: 1 as const };

function normalizeBoundaries(xs: number[]): number[] {
  const out = xs
    .map((n) => Math.floor(Number(n)))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  // de-dupe
  return out.filter((n, i) => i === 0 || n !== out[i - 1]);
}

export function defaultAgeingConfig(): AgeingIntervalsConfig {
  return { unit: "days", boundaries: [30, 60, 90], maxPeriod: null };
}

export function readAgeingConfig(kind: "creditors" | "debtors"): AgeingIntervalsConfig {
  const store = browserLocalJson(NS);
  if (!store) return defaultAgeingConfig();
  const raw = store.read<any>(`ageing_config_${kind}`, defaultAgeingConfig());
  const unit: AgeingUnit = raw?.unit === "weeks" || raw?.unit === "months" ? raw.unit : "days";
  const boundaries = normalizeBoundaries(Array.isArray(raw?.boundaries) ? raw.boundaries : defaultAgeingConfig().boundaries);
  const mp = Math.floor(Number(raw?.maxPeriod));
  const maxPeriod = Number.isFinite(mp) && mp > 0 ? mp : null;
  return { unit, boundaries: boundaries.length ? boundaries : defaultAgeingConfig().boundaries, maxPeriod };
}

export function writeAgeingConfig(kind: "creditors" | "debtors", cfg: AgeingIntervalsConfig) {
  const store = browserLocalJson(NS);
  if (!store) return;
  const mp = cfg.maxPeriod == null ? null : Math.floor(Number(cfg.maxPeriod));
  store.write(`ageing_config_${kind}`, {
    unit: cfg.unit,
    boundaries: normalizeBoundaries(cfg.boundaries),
    maxPeriod: Number.isFinite(mp) && mp > 0 ? mp : null,
  });
}

export function boundariesToDays(cfg: AgeingIntervalsConfig): number[] {
  if (cfg.unit === "days") return normalizeBoundaries(cfg.boundaries);
  if (cfg.unit === "weeks") return normalizeBoundaries(cfg.boundaries).map((w) => w * 7);
  // months: approximate to 30-day months for ageing buckets (due-date ageing is operational, not accounting period close).
  return normalizeBoundaries(cfg.boundaries).map((m) => m * 30);
}

export function maxPeriodToDays(cfg: AgeingIntervalsConfig): number | null {
  const mp = cfg.maxPeriod == null ? null : Math.floor(Number(cfg.maxPeriod));
  if (!Number.isFinite(mp) || mp == null || mp <= 0) return null;
  if (cfg.unit === "days") return mp;
  if (cfg.unit === "weeks") return mp * 7;
  return mp * 30;
}

export function labelForBoundaries(cfg: AgeingIntervalsConfig, daysBoundaries: number[]): string[] {
  const unitLabel = cfg.unit === "days" ? "days" : cfg.unit === "weeks" ? "weeks" : "months";
  const toUnit = (days: number) => {
    if (cfg.unit === "days") return days;
    if (cfg.unit === "weeks") return Math.round(days / 7);
    return Math.round(days / 30);
  };
  const bs = daysBoundaries.slice().sort((a, b) => a - b);
  const labels: string[] = [];
  let prev = 1;
  for (const b of bs) {
    labels.push(`${toUnit(prev)}–${toUnit(b)} ${unitLabel}`);
    prev = b + 1;
  }
  labels.push(`${toUnit(bs[bs.length - 1] + 1)}+ ${unitLabel}`);
  return labels;
}

