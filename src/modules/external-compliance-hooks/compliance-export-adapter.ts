export type ExternalComplianceAdapter = {
  adapterCode: string;
  title: string;
  sendOutbound: (payload: Record<string, unknown>) => Promise<{ ok: true; response?: Record<string, unknown> } | { ok: false; error: string; response?: Record<string, unknown> }>;
};

export const ADAPTERS: Record<string, ExternalComplianceAdapter> = {
  "stub.local": {
    adapterCode: "stub.local",
    title: "Local stub adapter",
    sendOutbound: async (payload) => {
      void payload;
      return { ok: true, response: { acknowledged: true } };
    },
  },
};

export function getAdapter(adapterCode: string): ExternalComplianceAdapter | null {
  return ADAPTERS[adapterCode] ?? null;
}

