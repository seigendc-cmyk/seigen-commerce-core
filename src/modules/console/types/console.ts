export type ConsoleNavItem = {
  href: string;
  label: string;
  exact?: boolean;
  /** Human hint for future auth/entitlement in console. */
  requiresAdmin?: boolean;
};

/**
 * Role-ready model (local dev is open for now).
 *
 * Later:
 * - owner: billing + security + irreversible actions
 * - platform_admin: platform configuration + plan catalog + activation
 * - support_admin: support tooling + overrides + diagnostics (no billing)
 */
export type ConsoleAdminRole = "owner" | "platform_admin" | "support_admin";

export type ConsoleAdminIdentity = {
  id: string;
  displayName: string;
  roles: ConsoleAdminRole[];
};

