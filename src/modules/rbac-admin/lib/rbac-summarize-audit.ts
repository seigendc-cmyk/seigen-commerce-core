/** Human-readable one-line summaries for permission_audit_logs rows (Pack 3 UI). */

export type PermissionAuditLogRow = {
  action_code: string;
  entity_type: string | null;
  entity_id: string | null;
  old_value: unknown;
  new_value: unknown;
  reason: string | null;
};

export function summarizePermissionAuditEvent(row: PermissionAuditLogRow): string {
  const ac = row.action_code ?? "";
  const et = row.entity_type ?? "record";

  if (ac === "role_created") {
    const nv = row.new_value as Record<string, unknown> | null;
    const name = (nv?.name as string) ?? "Role";
    const code = (nv?.role_code as string) ?? "";
    return `Created tenant role “${name}” (${code || "no code"}).`;
  }
  if (ac === "role_updated") {
    return `Updated ${et}${row.entity_id ? ` ${row.entity_id.slice(0, 8)}…` : ""}.`;
  }
  if (ac === "role_archived") {
    return `Archived role ${row.entity_id ? row.entity_id.slice(0, 8) + "…" : ""}.`;
  }
  if (ac === "role_permissions_saved") {
    const nv = row.new_value as Record<string, unknown> | null;
    const n = typeof nv?.permissionKeyCount === "number" ? nv.permissionKeyCount : "?";
    return `Saved role permissions (${n} keys in target set).`;
  }
  if (ac === "role_assigned") {
    return `Assigned a role to a workspace user.`;
  }
  if (ac === "role_removed") {
    return `Removed a role assignment.`;
  }
  if (ac === "primary_role_changed") {
    return `Changed primary role assignment.`;
  }
  if (ac === "override_applied") {
    return `Applied a permission override (grant or deny).`;
  }
  if (ac === "override_removed") {
    return `Removed a permission override.`;
  }
  if (ac === "user_scope_added") {
    return `Added an access scope row for a user.`;
  }
  if (ac === "user_scope_removed") {
    return `Removed (deactivated) an access scope row.`;
  }
  if (ac === "protected_role_removal_blocked") {
    return `Blocked removal of a protected system role (safety).`;
  }

  return `${ac.replaceAll("_", " ")} · ${et}`;
}
