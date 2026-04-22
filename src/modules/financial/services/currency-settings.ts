"use client";

import { browserLocalJson } from "@/modules/inventory/services/storage";

const NS = { namespace: "seigen.financial", version: 1 as const };
const KEY = "currency_settings";

export type CurrencySettings = {
  enabledCodes: string[];
  baseCurrency: string;
  reportingCurrency: string;
};

const DEFAULT: CurrencySettings = {
  enabledCodes: ["USD"],
  baseCurrency: "USD",
  reportingCurrency: "USD",
};

function normCode(code: unknown): string | null {
  const s = String(code ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : null;
}

function store() {
  return browserLocalJson(NS);
}

export function readCurrencySettings(): CurrencySettings {
  const s = store();
  if (!s) return { ...DEFAULT };
  const raw = s.read<Partial<CurrencySettings> | null>(KEY, null);
  const enabled = Array.isArray(raw?.enabledCodes) ? raw!.enabledCodes.map(normCode).filter(Boolean) : [];
  const enabledCodes = enabled.length > 0 ? (enabled as string[]) : [...DEFAULT.enabledCodes];
  const baseCurrency = normCode(raw?.baseCurrency) ?? enabledCodes[0] ?? DEFAULT.baseCurrency;
  const reportingCurrency = normCode(raw?.reportingCurrency) ?? enabledCodes[0] ?? DEFAULT.reportingCurrency;
  return {
    enabledCodes,
    baseCurrency: enabledCodes.includes(baseCurrency) ? baseCurrency : enabledCodes[0]!,
    reportingCurrency: enabledCodes.includes(reportingCurrency) ? reportingCurrency : enabledCodes[0]!,
  };
}

export function writeCurrencySettings(patch: Partial<CurrencySettings>): CurrencySettings {
  const prev = readCurrencySettings();
  const next: CurrencySettings = {
    enabledCodes: Array.isArray(patch.enabledCodes)
      ? patch.enabledCodes.map(normCode).filter(Boolean) as string[]
      : prev.enabledCodes,
    baseCurrency: patch.baseCurrency ?? prev.baseCurrency,
    reportingCurrency: patch.reportingCurrency ?? prev.reportingCurrency,
  };
  // Re-normalize via read logic and persist.
  const normalized: CurrencySettings = {
    ...readCurrencySettings(),
    ...next,
  };
  const s = store();
  if (s) s.write(KEY, normalized);
  return normalized;
}

export function baseCurrencyCode(): string {
  return readCurrencySettings().baseCurrency;
}

