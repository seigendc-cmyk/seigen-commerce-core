import { ConsolePlaceholderPage } from "@/modules/console/ui/console-placeholder-page";

export const metadata = { title: "Console · Subscriptions" };

export default function ConsoleSubscriptionsRoutePage() {
  return (
    <ConsolePlaceholderPage
      title="Subscriptions"
      description="Subscription records and plan assignments (placeholder structure)."
      whatWillBeHere={[
        "Subscription list (workspace → plan → status)",
        "Local demo subscription simulation (optional)",
        "Future: billing provider ids, invoices, payment state",
        "Future: proration, upgrades/downgrades, cancellation flow",
      ]}
    />
  );
}

