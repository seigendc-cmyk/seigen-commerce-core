export type DeskAuditSourceKind = "notification" | "approval" | "system" | "security" | "terminal";

export type DeskAuditEvent = {
  id: string;
  sourceKind: DeskAuditSourceKind;
  sourceId: string;
  action: string;
  actorStaffId?: string | null;
  actorLabel: string;
  occurredAt: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  notes?: string | null;
  correlationId?: string | null;
  moduleKey: string;
  entityType?: string | null;
  entityId?: string | null;
};

