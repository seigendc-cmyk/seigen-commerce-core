export function mapGovernanceEventToRegulatorPayload(input: {
  eventType: string;
  payload: Record<string, unknown>;
  countryCode?: string | null;
}): Record<string, unknown> {
  // Pack 9: mapping is intentionally conservative; country-specific adapters can extend this.
  return {
    schemaVersion: 1,
    eventType: input.eventType,
    countryCode: input.countryCode ?? null,
    payload: input.payload,
    generatedAt: new Date().toISOString(),
  };
}

