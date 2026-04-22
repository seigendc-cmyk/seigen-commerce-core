import { browserLocalJson } from "@/modules/inventory/services/storage";

const NS = { namespace: "seigen.reconciliation", version: 1 as const };

function store() {
  return browserLocalJson(NS);
}

export function readOrCreateReconDeviceId(): string {
  if (typeof window === "undefined") return "recon_device_ssr";
  const s = store();
  if (!s) return "recon_device_unknown";
  const existing = s.read<string | null>("device_id", null);
  if (typeof existing === "string" && existing.trim()) return existing.trim();
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `recon_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  s.write("device_id", id);
  return id;
}

