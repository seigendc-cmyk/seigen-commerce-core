import type { ReactNode } from "react";
import { ExecutiveShell } from "@/modules/executive/ui/executive-shell";

export const metadata = { title: "Executive" };

export default function ExecutiveLayout({ children }: { children: ReactNode }) {
  return <ExecutiveShell>{children}</ExecutiveShell>;
}

