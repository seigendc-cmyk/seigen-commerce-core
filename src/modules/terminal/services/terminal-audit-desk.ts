import { appendDeskAuditEvent } from "@/modules/desk/services/desk-audit";

export function auditTerminalDesk(input: {
  action: string;
  actorLabel: string;
  notes?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  entityType?: string | null;
  entityId?: string | null;
  correlationId?: string | null;
}) {
  appendDeskAuditEvent({
    sourceKind: "terminal",
    sourceId: "terminal_portal",
    action: input.action,
    actorLabel: input.actorLabel,
    notes: input.notes ?? null,
    beforeState: input.beforeState ?? null,
    afterState: input.afterState ?? null,
    moduleKey: "terminal",
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    correlationId: input.correlationId ?? null,
  });
}
