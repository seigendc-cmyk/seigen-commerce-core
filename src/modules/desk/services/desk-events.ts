export const DESK_NOTIFICATIONS_UPDATED = "seigen-desk-notifications-updated";
export const DESK_APPROVALS_UPDATED = "seigen-desk-approvals-updated";
export const DESK_AUDIT_UPDATED = "seigen-desk-audit-updated";
export const DESK_PROFILES_UPDATED = "seigen-desk-profiles-updated";

export function dispatchDeskNotificationsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DESK_NOTIFICATIONS_UPDATED));
}

export function dispatchDeskApprovalsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DESK_APPROVALS_UPDATED));
}

export function dispatchDeskAuditUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DESK_AUDIT_UPDATED));
}

export function dispatchDeskProfilesUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DESK_PROFILES_UPDATED));
}

