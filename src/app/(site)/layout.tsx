import { MarketingShell } from "@/components/site/marketing-shell";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}
