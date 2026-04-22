import Link from "next/link";
import { SecurityConsoleLayout } from "@/modules/rbac-admin/ui/security-console-layout";
import { listRegulatorConnectors, listConnectorRuns, runRegulatorConnector } from "@/modules/regulator-connectors/connector-runner.service";
import { listRegulatorConnectorAdapters } from "@/modules/regulator-connectors/connector-registry.service";

export default async function RegulatorConnectorsPage() {
  const [reg, runs] = await Promise.all([listRegulatorConnectors(), listConnectorRuns({ limit: 50 })]);
  const adapters = listRegulatorConnectorAdapters();
  return (
    <SecurityConsoleLayout>
      <div className="space-y-4">
        <header className="vendor-panel-soft rounded-2xl p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">SysAdmin desk · Governance</div>
          <h2 className="mt-1 text-xl font-semibold text-white">Regulator connectors</h2>
          <p className="mt-2 text-sm text-neutral-400">Country/region-specific connectors run through adapters (no hardcoded one-country core).</p>
          <nav className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <Link href="/dashboard/desk/security/governance/federation" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10">
              Federation
            </Link>
            <Link href="/dashboard/desk/security/governance/overlays" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10">
              Overlays
            </Link>
            <Link href="/dashboard/desk/security/governance/connectors" className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white">
              Regulator connectors
            </Link>
            <Link href="/dashboard/desk/security/governance/records" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10">
              Records
            </Link>
            <Link href="/dashboard/desk/security/governance/ediscovery" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10">
              E-Discovery
            </Link>
          </nav>
        </header>

        <section className="vendor-panel-soft rounded-2xl p-5">
          <h3 className="text-base font-semibold text-white">App adapters (configured)</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {adapters.map((a) => (
              <div key={a.connectorCode} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-sm font-semibold text-neutral-100">{a.title}</div>
                <div className="mt-1 text-xs text-neutral-400">{a.connectorCode}</div>
                <div className="mt-2 text-xs text-neutral-500">Events: {a.supportedEvents.join(", ")}</div>
              </div>
            ))}
          </div>
        </section>

        {!reg.ok ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-300">{reg.error}</div>
        ) : (
          <section className="vendor-panel-soft rounded-2xl p-5">
            <h3 className="text-base font-semibold text-white">Registry (Supabase)</h3>
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  <tr>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Region</th>
                    <th className="px-3 py-2">Country</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {reg.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-neutral-500">
                        No connectors registered yet.
                      </td>
                    </tr>
                  ) : (
                    reg.rows.map((c: any) => (
                      <tr key={c.id} className="border-b border-white/[0.06] last:border-0">
                        <td className="px-3 py-2 font-mono text-xs text-neutral-300">{c.connector_code}</td>
                        <td className="px-3 py-2 text-neutral-200">{c.title}</td>
                        <td className="px-3 py-2 text-neutral-500">{c.region_code ?? "—"}</td>
                        <td className="px-3 py-2 text-neutral-500">{c.country_code ?? "—"}</td>
                        <td className="px-3 py-2 text-neutral-300">{c.status}</td>
                        <td className="px-3 py-2 text-right">
                          <form
                            action={async () => {
                              "use server";
                              await runRegulatorConnector({
                                connectorCode: String(c.connector_code),
                                eventType: Array.isArray(c.supported_events_json) && c.supported_events_json.length ? String(c.supported_events_json[0]) : "fiscal.export",
                                direction: "outbound",
                                payload: { ping: true, connector: c.connector_code },
                                mode: "dry_run",
                              });
                            }}
                          >
                            <button className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10">
                              Dry-run
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!runs.ok ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-300">{runs.error}</div>
        ) : (
          <section className="vendor-panel-soft rounded-2xl p-5">
            <h3 className="text-base font-semibold text-white">Recent runs</h3>
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Connector</th>
                    <th className="px-3 py-2">Event</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Dry-run</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-neutral-500">
                        No runs yet.
                      </td>
                    </tr>
                  ) : (
                    runs.rows.map((x: any) => (
                      <tr key={x.id} className="border-b border-white/[0.06] last:border-0">
                        <td className="px-3 py-2 text-neutral-500">{String(x.created_at).slice(0, 16).replace("T", " ")}</td>
                        <td className="px-3 py-2 font-mono text-xs text-neutral-300">{x.connector_code}</td>
                        <td className="px-3 py-2 text-neutral-300">{x.event_type}</td>
                        <td className="px-3 py-2 text-neutral-300">{x.status}</td>
                        <td className="px-3 py-2 text-neutral-500">{x.is_dry_run ? "yes" : "no"}</td>
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

