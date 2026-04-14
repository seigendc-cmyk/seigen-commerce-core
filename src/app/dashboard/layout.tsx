import { SciShell } from "@/components/sci/sci-shell";
import { requireUser } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  return <SciShell>{children}</SciShell>;
}
