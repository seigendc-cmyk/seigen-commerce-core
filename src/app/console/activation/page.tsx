import { ConsolePlaceholderPage } from "@/modules/console/ui/console-placeholder-page";

export const metadata = { title: "Console · Activation" };

export default function ConsoleActivationRoutePage() {
  return (
    <ConsolePlaceholderPage
      title="Activation"
      description="Workspace activation, overrides, and entitlement debugging (placeholder structure)."
      whatWillBeHere={[
        "Activation status by workspace",
        "Manual overrides (grace periods, temporary unlocks)",
        "Entitlement resolution inspector (plan + overrides + add-ons)",
        "Future: audit logs + support tools",
      ]}
    />
  );
}

