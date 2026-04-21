/**
 * Browser-local operator label until workspace staff session is wired everywhere.
 * Replace with authenticated user display name from Supabase session in production.
 */
export function getConsignmentActorLabel(): string {
  if (typeof window === "undefined") return "Server";
  try {
    const v = window.localStorage.getItem("seigen.staff.displayName") ?? window.localStorage.getItem("seigen.user.displayName");
    if (v?.trim()) return v.trim();
  } catch {
    /* ignore */
  }
  return "Operator";
}
