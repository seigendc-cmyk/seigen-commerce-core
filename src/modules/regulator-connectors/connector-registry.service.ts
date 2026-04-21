import type { RegulatorConnectorAdapter } from "./connector-contracts";

const ADAPTERS: RegulatorConnectorAdapter[] = [
  {
    connectorCode: "zw_fiscal_export_stub",
    title: "Zimbabwe fiscal/compliance export (stub)",
    connectorType: "fiscal_export",
    supportedEvents: ["fiscal.export", "compliance.report.export"],
    async run(_ctx, input) {
      // Stub connector: echoes payload and returns a deterministic reference.
      if (input.mode === "dry_run") {
        return { ok: true, status: "dry_run", response: { preview: true, eventType: input.eventType, referenceCode: input.referenceCode ?? null } };
      }
      return { ok: true, status: "sent", response: { accepted: true, externalRef: `ZW-STUB-${Date.now()}` } };
    },
  },
];

export function getRegulatorConnectorAdapter(connectorCode: string): RegulatorConnectorAdapter | null {
  return ADAPTERS.find((a) => a.connectorCode === connectorCode) ?? null;
}

export function listRegulatorConnectorAdapters(): Array<Pick<RegulatorConnectorAdapter, "connectorCode" | "title" | "connectorType" | "supportedEvents">> {
  return ADAPTERS.map((a) => ({ connectorCode: a.connectorCode, title: a.title, connectorType: a.connectorType, supportedEvents: a.supportedEvents }));
}

