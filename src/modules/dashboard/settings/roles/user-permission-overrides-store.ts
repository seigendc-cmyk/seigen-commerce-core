import { readVendorCore, writeVendorCore } from "@/modules/dashboard/settings/vendor-core-storage";
import { appendDeskAuditEvent } from "@/modules/desk/services/desk-audit";

export type UserPermissionOverrides = {
  staffId: string;
  /** Explicit grants beyond role permissions. */
  allow: string[];
  /** Explicit denies even if role allows. */
  deny: string[];
  updatedAt: string;
};

type Db = { rows: UserPermissionOverrides[] };

function nowIso() {
  return new Date().toISOString();
}

function getDb(): Db {
  return { rows: readVendorCore<UserPermissionOverrides[]>("user_permission_overrides", []) };
}

function setDb(db: Db) {
  writeVendorCore("user_permission_overrides", db.rows);
}

export function getOverridesForStaff(staffId: string): UserPermissionOverrides {
  const row = getDb().rows.find((r) => r.staffId === staffId);
  return (
    row ?? {
      staffId,
      allow: [],
      deny: [],
      updatedAt: nowIso(),
    }
  );
}

export function setOverridesForStaff(input: UserPermissionOverrides, actorLabel: string) {
  const db = getDb();
  const idx = db.rows.findIndex((r) => r.staffId === input.staffId);
  const prev = idx >= 0 ? db.rows[idx]! : null;
  const next: UserPermissionOverrides = {
    staffId: input.staffId,
    allow: Array.from(new Set(input.allow)),
    deny: Array.from(new Set(input.deny)),
    updatedAt: nowIso(),
  };
  if (idx >= 0) db.rows[idx] = next;
  else db.rows.push(next);
  setDb(db);

  appendDeskAuditEvent({
    sourceKind: "security",
    sourceId: input.staffId,
    action: "rbac.user_override.changed",
    actorStaffId: null,
    actorLabel,
    moduleKey: "settings",
    entityType: "staff",
    entityId: input.staffId,
    beforeState: prev ? { allow: prev.allow, deny: prev.deny } : null,
    afterState: { allow: next.allow, deny: next.deny },
  });
}

