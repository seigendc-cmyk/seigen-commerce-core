import { authzCheck } from "@/modules/authz/authz-actions";

export type CopilotMode = "explain" | "summarize" | "find" | "compare" | "suggest";

export type CopilotBoundaryDecision =
  | { ok: true; allowed: true; redactions?: string[] }
  | { ok: true; allowed: false; reason: string }
  | { ok: false; error: string };

/**
 * Strict boundary layer for Pack 9 copilot.
 * - No execute mode.
 * - Requires explicit permissions for sensitive governance data.
 */
export async function evaluateCopilotBoundary(input: {
  mode: CopilotMode;
  intent: string;
  requiredPermissionKeys?: string[];
}): Promise<CopilotBoundaryDecision> {
  // Block execute-like intents.
  const lowered = `${input.mode} ${input.intent}`.toLowerCase();
  const forbidden = ["publish", "approve", "delete", "release hold", "cast vote", "bypass", "execute", "finalize"];
  if (forbidden.some((k) => lowered.includes(k))) {
    return { ok: true, allowed: false, reason: "Copilot cannot execute or perform destructive governance actions." };
  }

  const required = input.requiredPermissionKeys ?? [];
  for (const key of required) {
    const r = await authzCheck(key);
    if (!r.allowed) {
      return { ok: true, allowed: false, reason: `Missing permission: ${key}` };
    }
  }

  return { ok: true, allowed: true };
}

