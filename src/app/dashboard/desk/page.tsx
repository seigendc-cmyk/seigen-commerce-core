import { DeskRouteGuard } from "@/modules/desk/ui/desk-route-guard";

export default function DeskRoute() {
  // Providers are mounted at `src/app/dashboard/layout.tsx`.
  return <DeskRouteGuard />;
}

