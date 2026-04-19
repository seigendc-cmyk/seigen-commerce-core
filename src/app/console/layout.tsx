import { ConsoleShell } from "@/modules/console/ui/console-shell";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>;
}

