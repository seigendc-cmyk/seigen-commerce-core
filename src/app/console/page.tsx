import Link from "next/link";
import { ConsoleTopBar } from "@/modules/console/ui/console-top-bar";

export const metadata = { title: "Console" };

export default function ConsoleHomePage() {
  return (
    <>
      <ConsoleTopBar
        title="Console"
        subtitle="Platform control surface (local-first). Plans are real; subscriptions and activation are placeholders for now."
      />
      <div className="flex-1 space-y-6 px-4 py-6 sm:px-6">
        <section className="rounded-2xl border border-white/10 bg-brand-surface/50 p-6">
          <h2 className="text-base font-semibold text-white">Quick actions</h2>
          <p className="mt-1 text-sm text-brand-muted">
            Start with plans visibility, then layer subscriptions, overrides, and activation once a backend is
            connected.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/console/plans"
              className="rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-hover"
            >
              Open plans
            </Link>
            <Link
              href="/console/subscriptions"
              className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:border-brand-orange hover:text-brand-orange"
            >
              Subscriptions
            </Link>
            <Link
              href="/console/activation"
              className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:border-brand-orange hover:text-brand-orange"
            >
              Activation
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

