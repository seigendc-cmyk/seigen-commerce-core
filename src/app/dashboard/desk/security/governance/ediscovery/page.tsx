import Link from "next/link";
import { SecurityConsoleLayout } from "@/modules/rbac-admin/ui/security-console-layout";
import { listEdiscoveryMatters } from "@/modules/ediscovery/matter.service";
import { ediscoverySearch } from "@/modules/ediscovery/search.service";

export default async function EDiscoveryPage() {
  const [matters, recent] = await Promise.all([listEdiscoveryMatters(50), ediscoverySearch({ limit: 20 })]);
  return (
    <SecurityConsoleLayout>
      <div className="space-y-4">
        <header className="vendor-panel-soft rounded-2xl p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">SysAdmin desk · Governance</div>
          <h2 className="mt-1 text-xl font-semibold text-white">E-Discovery</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Controlled search across records with audit logging. Not general search.
          </p>
          <nav className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <Link
              href="/dashboard/desk/security/governance/federation"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Federation
            </Link>
            <Link
              href="/dashboard/desk/security/governance/overlays"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Overlays
            </Link>
            <Link
              href="/dashboard/desk/security/governance/connectors"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Regulator connectors
            </Link>
            <Link
              href="/dashboard/desk/security/governance/records"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Records
            </Link>
            <Link href="/dashboard/desk/security/governance/ediscovery" className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white">
              E-Discovery
            </Link>
          </nav>
        </header>

        {!matters.ok ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-300">{matters.error}</div>
        ) : (
          <section className="vendor-panel-soft rounded-2xl p-5">
            <h3 className="text-base font-semibold text-white">Matters</h3>
            <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  <tr>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Opened</th>
                  </tr>
                </thead>
                <tbody>
                  {matters.rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-10 text-center text-neutral-500">
                        No matters yet.
                      </td>
                    </tr>
                  ) : (
                    matters.rows.map((m: any) => (
                      <tr key={m.id} className="border-b border-white/[0.06] last:border-0">
                        <td className="px-3 py-2 font-mono text-xs text-neutral-300">{m.matter_code}</td>
                        <td className="px-3 py-2 text-neutral-200">{m.title}</td>
                        <td className="px-3 py-2 text-neutral-300">{m.status}</td>
                        <td className="px-3 py-2 text-neutral-500">{String(m.opened_at).slice(0, 16).replace("T", " ")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!recent.ok ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-300">{recent.error}</div>
        ) : (
          <section className="vendor-panel-soft rounded-2xl p-5">
            <h3 className="text-base font-semibold text-white">Recent indexed records (sample)</h3>
            <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  <tr>
                    <th className="px-3 py-2">Classification</th>
                    <th className="px-3 py-2">Record</th>
                    <th className="px-3 py-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.rows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-10 text-center text-neutral-500">
                        No records found.
                      </td>
                    </tr>
                  ) : (
                    recent.rows.map((r: any) => (
                      <tr key={r.id} className="border-b border-white/[0.06] last:border-0">
                        <td className="px-3 py-2 text-neutral-300">{r.record_classification}</td>
                        <td className="px-3 py-2 font-mono text-xs text-neutral-300">
                          {r.record_type}:{String(r.record_id).slice(-10)}
                        </td>
                        <td className="px-3 py-2 text-neutral-500">{String(r.updated_at).slice(0, 16).replace("T", " ")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </SecurityConsoleLayout>
  );
}

