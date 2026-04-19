import { ConsolePlaceholderPage } from "@/modules/console/ui/console-placeholder-page";

export const metadata = { title: "Console · Overrides" };

export default function ConsoleOverridesRoutePage() {
  return (
    <ConsolePlaceholderPage
      title="Overrides"
      description="Account/workspace overrides and support tooling (placeholder structure)."
      whatWillBeHere={[
        "Override list by workspace (temporary unlocks, grace periods)",
        "Module-level entitlements (plan modules + add-ons + overrides)",
        "Support-only actions (disable printing, force safe mode, etc.)",
        "Audit log of admin actions (who/when/what) once backend exists",
      ]}
    />
  );
}

