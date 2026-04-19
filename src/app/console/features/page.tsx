import { ConsolePlaceholderPage } from "@/modules/console/ui/console-placeholder-page";

export const metadata = { title: "Console · Features" };

export default function ConsoleFeaturesRoutePage() {
  return (
    <ConsolePlaceholderPage
      title="Features"
      description="Feature catalog and plan mapping (local scaffold)."
      whatWillBeHere={[
        "Canonical feature catalog (ids, labels, descriptions)",
        "Mapping features ↔ plan modules (and future add-ons)",
        "Overrides for specific accounts / workspaces",
        "Audit trail for changes once backend exists",
      ]}
    />
  );
}

