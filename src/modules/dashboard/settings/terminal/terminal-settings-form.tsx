"use client";

import { TerminalAccessConsole } from "@/modules/terminal/ui/terminal-access-console";

/** Settings → Terminal: same local store as Desk → Security → Terminal access. */
export function TerminalSettingsForm() {
  return <TerminalAccessConsole context="settings" />;
}
