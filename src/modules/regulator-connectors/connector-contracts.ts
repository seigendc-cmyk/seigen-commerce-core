export type ConnectorRunMode = "dry_run" | "live";

export type ConnectorContext = {
  tenantId: string;
  actorUserId: string;
  regionCode?: string | null;
  countryCode?: string | null;
};

export type ConnectorRunInput = {
  connectorCode: string;
  eventType: string;
  direction: "outbound" | "inbound";
  referenceCode?: string | null;
  payload: Record<string, unknown>;
  mode: ConnectorRunMode;
};

export type ConnectorRunResult =
  | { ok: true; status: "sent" | "acknowledged" | "received" | "processed" | "dry_run"; response?: Record<string, unknown> }
  | { ok: false; error: string; response?: Record<string, unknown> };

export type RegulatorConnectorAdapter = {
  connectorCode: string;
  title: string;
  connectorType: string;
  supportedEvents: string[];
  run: (ctx: ConnectorContext, input: ConnectorRunInput) => Promise<ConnectorRunResult>;
};

