import { describe, expect, it } from "vitest";
import { summarizePermissionAuditEvent } from "./rbac-summarize-audit";

describe("summarizePermissionAuditEvent", () => {
  it("summarizes role_created with name and code", () => {
    expect(
      summarizePermissionAuditEvent({
        action_code: "role_created",
        entity_type: "role",
        entity_id: "abc",
        old_value: null,
        new_value: { name: "Inventory Clerk", role_code: "inventory_clerk" },
        reason: null,
      }),
    ).toContain("Inventory Clerk");
  });

  it("summarizes role_permissions_saved", () => {
    const s = summarizePermissionAuditEvent({
      action_code: "role_permissions_saved",
      entity_type: "role",
      entity_id: "x",
      old_value: null,
      new_value: { permissionKeyCount: 12 },
      reason: "matrix save",
    });
    expect(s).toContain("12");
  });

  it("falls back for unknown action codes", () => {
    expect(
      summarizePermissionAuditEvent({
        action_code: "custom_event",
        entity_type: "widget",
        entity_id: null,
        old_value: null,
        new_value: null,
        reason: null,
      }),
    ).toMatch(/custom event/);
  });
});
