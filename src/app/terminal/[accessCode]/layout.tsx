"use client";

import { useParams } from "next/navigation";
import { TerminalCartProvider } from "@/modules/terminal/state/terminal-cart-context";
import { TerminalSessionProvider } from "@/modules/terminal/state/terminal-session-context";
import { TerminalBridge } from "@/modules/terminal/ui/terminal-bridge";

export default function TerminalAccessLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const accessCode = typeof params?.accessCode === "string" ? params.accessCode : "";
  if (!accessCode) return null;
  return (
    <TerminalSessionProvider accessCode={accessCode}>
      <TerminalCartProvider>
        <TerminalBridge>{children}</TerminalBridge>
      </TerminalCartProvider>
    </TerminalSessionProvider>
  );
}
