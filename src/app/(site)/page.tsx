import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <section className="border-b border-white/10 bg-gradient-to-b from-brand-surface to-brand-charcoal">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-orange">
            Vendor commerce core
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Run retail, POS, and wholesale from one disciplined workspace.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-brand-muted">
            seiGEN Commerce is built for operators who need clarity: catalog, branches, registers,
            and routes—without losing the plot. Start local, scale when you connect services.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/plans"
              className="rounded-lg bg-brand-orange px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-orange/20 transition-colors hover:bg-brand-orange-hover"
            >
              Choose a plan
            </Link>
            <Link
              href="/market-space"
              className="rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-brand-orange hover:text-brand-orange"
            >
              Explore Market Space
            </Link>
            <Link
              href="/console"
              className="rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-brand-orange hover:text-brand-orange"
            >
              Open console
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="text-2xl font-semibold text-neutral-900 sm:text-3xl">Why vendors choose the core</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Operational focus",
              body: "Dashboard, inventory, and POS modules share one mental model—fewer swivel-chair workflows.",
            },
            {
              title: "Branch-ready",
              body: "Structured for single-site today and multi-branch retail tomorrow without rework.",
            },
            {
              title: "Distribution aware",
              body: "Wholesale tiers and route-friendly flows are first-class, not bolted on.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-neutral-900">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{card.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
