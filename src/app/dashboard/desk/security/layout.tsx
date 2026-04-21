import { SecurityConsoleLayout } from "@/modules/rbac-admin/ui/security-console-layout";

export default function DeskSecurityLayout({ children }: { children: React.ReactNode }) {
  return <SecurityConsoleLayout>{children}</SecurityConsoleLayout>;
}
