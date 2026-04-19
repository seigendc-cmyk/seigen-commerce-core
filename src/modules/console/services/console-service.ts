import type { ConsoleAdminIdentity } from "../types/console";

export type ConsoleWorkspaceStatus = "local_console_active";

export function getConsoleWorkspaceStatus(): ConsoleWorkspaceStatus {
  return "local_console_active";
}

/**
 * Local-first dev identity (Console is open in local mode).
 * Replace with real auth/session + role claims when Supabase/back-end lands.
 */
export function getLocalConsoleIdentity(): ConsoleAdminIdentity {
  return {
    id: "local_admin",
    displayName: "Local developer",
    roles: ["owner", "platform_admin", "support_admin"],
  };
}

