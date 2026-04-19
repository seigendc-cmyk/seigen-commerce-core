import { resolvePlanId, tryResolvePlanId, type PlanId } from "./plans";

export const DEMO_SESSION_KEY = "seigen_vendor_demo_v1";

export type DemoWorkspaceStatus = "local_demo_active";

export type DemoVendorSession = {
  version: 2;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  planId: PlanId;
  createdAt: string;
  workspaceStatus: DemoWorkspaceStatus;
};

const DEFAULT_WORKSPACE_STATUS: DemoWorkspaceStatus = "local_demo_active";

function isPlanId(v: unknown): v is PlanId {
  return typeof v === "string" && tryResolvePlanId(v) !== null;
}

type LegacyDemoVendorSessionV1 = {
  version: 1;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  planId: PlanId;
  createdAt: string;
};

function migrateToV2(raw: LegacyDemoVendorSessionV1): DemoVendorSession {
  return {
    version: 2,
    businessName: raw.businessName,
    contactName: raw.contactName,
    email: raw.email,
    phone: raw.phone,
    planId: resolvePlanId(String(raw.planId)),
    createdAt: raw.createdAt,
    workspaceStatus: DEFAULT_WORKSPACE_STATUS,
  };
}

function parseSession(raw: string): DemoVendorSession | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    const version = o.version;
       if (version === 1) {
      const v1 = parsed as LegacyDemoVendorSessionV1;
      if (!isPlanId(v1.planId)) return null;
      const upgraded = migrateToV2(v1);
      try {
        window.sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(upgraded));
      } catch {
        /* ignore */
      }
      return upgraded;
    }
    if (version !== 2) return null;
    const s = parsed as DemoVendorSession;
    if (
      typeof s.businessName !== "string" ||
      typeof s.contactName !== "string" ||
      typeof s.email !== "string" ||
      typeof s.phone !== "string" ||
      !isPlanId(s.planId) ||
      typeof s.createdAt !== "string"
    ) {
      return null;
    }
    const workspaceStatus =
      s.workspaceStatus === "local_demo_active" ? s.workspaceStatus : DEFAULT_WORKSPACE_STATUS;
    return {
      version: 2,
      businessName: s.businessName,
      contactName: s.contactName,
      email: s.email,
      phone: s.phone,
      planId: resolvePlanId(String(s.planId)),
      createdAt: s.createdAt,
      workspaceStatus,
    };
  } catch {
    return null;
  }
}

export function readDemoSession(): DemoVendorSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return null;
    return parseSession(raw);
  } catch {
    return null;
  }
}

export function writeDemoSession(
  data: Omit<DemoVendorSession, "version" | "createdAt" | "workspaceStatus"> & {
    workspaceStatus?: DemoWorkspaceStatus;
  },
): void {
  if (typeof window === "undefined") return;
  const payload: DemoVendorSession = {
    version: 2,
    createdAt: new Date().toISOString(),
    workspaceStatus: data.workspaceStatus ?? DEFAULT_WORKSPACE_STATUS,
    businessName: data.businessName,
    contactName: data.contactName,
    email: data.email,
    phone: data.phone,
    planId: data.planId,
  };
  window.sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(payload));
}

export function clearDemoSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(DEMO_SESSION_KEY);
}

export const DEMO_WORKSPACE_STATUS_COPY: Record<DemoWorkspaceStatus, string> = {
  local_demo_active: "Local demo workspace — data stays in this browser until you connect a backend.",
};
