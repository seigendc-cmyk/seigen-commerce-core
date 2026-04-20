import { browserLocalJson } from "@/modules/inventory/services/storage";

const NS = { namespace: "seigen.bi", version: 1 as const };

export type BiRuleDomain = "inventory" | "sales" | "staff" | "delivery" | "financial" | "other";

export type BiBusinessRule = {
  id: string;
  domain: BiRuleDomain;
  ruleKey: string;
  title: string;
  description: string;
  /** Domain-specific JSON (shelf count, cadence, thresholds, …). */
  config: Record<string, unknown>;
  isActive: boolean;
  updatedAt: string;
};

type Db = { rules: BiBusinessRule[] };

function uid(): string {
  return `rule_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function financialSeedRules(): BiBusinessRule[] {
  const ts = new Date().toISOString();
  return [
    {
      id: uid(),
      domain: "financial",
      ruleKey: "financial.liquidity_oversight",
      title: "Liquidity oversight",
      description:
        "Surface when liquid cash is stressed versus supplier payables and COGS funding. Drives highlights on Financial → Overview.",
      config: { warnIfPayablesExceedLiquid: true, criticalIfFreeCashNegative: true },
      isActive: true,
      updatedAt: ts,
    },
    {
      id: uid(),
      domain: "financial",
      ruleKey: "financial.cashplan_reserve_discipline",
      title: "CashPlan reserve discipline",
      description:
        "When enabled, Overview flags underfunded discipline reserves (rent, tax, salaries) from CashPlan.",
      config: { flagUnderfundedReserves: true },
      isActive: true,
      updatedAt: ts,
    },
  ];
}

function mergeFinancialRulesIfMissing(rules: BiBusinessRule[]): BiBusinessRule[] {
  if (rules.some((r) => r.domain === "financial")) return rules;
  return [...rules, ...financialSeedRules()];
}

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { rules: defaultRules() };
  const raw = store.read<Db>("business_rules", { rules: [] });
  if (!raw.rules?.length) {
    const seed = { rules: defaultRules() };
    store.write("business_rules", seed);
    return seed;
  }
  const merged = mergeFinancialRulesIfMissing(raw.rules);
  if (merged !== raw.rules) {
    const next = { rules: merged };
    store.write("business_rules", next);
    return next;
  }
  return raw;
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("business_rules", db);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("seigen-bi-rules-updated"));
  }
}

export function biRulesLocalStorageKey(): string {
  const store = browserLocalJson(NS);
  return store?.fullKey("business_rules") ?? "seigen.bi:v1:business_rules";
}

function defaultRules(): BiBusinessRule[] {
  const ts = new Date().toISOString();
  return [
    {
      id: uid(),
      domain: "inventory",
      ruleKey: "inventory.shelf_spot_checks",
      title: "Shelf spot checks (template)",
      description:
        "Plan physical counts by shelf excluding Sundays and public holidays. Notifies staff with inventory permissions; variances route to approvers. (Engine connects Brain + email when enabled.)",
      config: {
        shelfCount: 0,
        spotCheckCadenceDays: 7,
        excludeSunday: true,
        holidayCalendar: "local",
        notifyRoles: ["inventory", "manager"],
      },
      isActive: false,
      updatedAt: ts,
    },
    {
      id: uid(),
      domain: "delivery",
      ruleKey: "delivery.sla_reminder",
      title: "Delivery SLA reminder (template)",
      description: "Placeholder for on-time delivery checks vs promised windows.",
      config: { maxLateMinutes: 30 },
      isActive: false,
      updatedAt: ts,
    },
  ];
}

export function listBiRules(): BiBusinessRule[] {
  return getDb()
    .rules.slice()
    .sort((a, b) => a.domain.localeCompare(b.domain) || a.title.localeCompare(b.title));
}

export function upsertBiRule(input: Omit<BiBusinessRule, "id" | "updatedAt"> & { id?: string }): BiBusinessRule {
  const db = getDb();
  const ts = new Date().toISOString();
  const id = input.id?.trim() ? input.id : uid();
  const next: BiBusinessRule = {
    id,
    domain: input.domain,
    ruleKey: input.ruleKey.trim(),
    title: input.title.trim(),
    description: input.description.trim(),
    config: input.config && typeof input.config === "object" ? input.config : {},
    isActive: input.isActive,
    updatedAt: ts,
  };
  const idx = db.rules.findIndex((r) => r.id === id);
  if (idx >= 0) db.rules[idx] = next;
  else db.rules.push(next);
  setDb(db);
  return next;
}

export function removeBiRule(id: string): void {
  const db = getDb();
  db.rules = db.rules.filter((r) => r.id !== id);
  setDb(db);
}
