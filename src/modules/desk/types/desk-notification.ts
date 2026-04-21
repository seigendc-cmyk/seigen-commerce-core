export type DeskNotificationSeverity = "info" | "warning" | "urgent" | "critical";

export type DeskNotificationCategory =
  | "awareness"
  | "exception"
  | "reminder"
  | "security"
  | "commercial"
  | "operations"
  | "approval-related";

export type DeskNotificationStatus = "active" | "acknowledged" | "resolved" | "expired";

export type DeskNotificationAck = { staffId: string; at: string };

export type DeskNotification = {
  id: string;
  tenantId?: string | null;
  branchId?: string | null;
  moduleKey: string;
  entityType: string;
  entityId: string;
  title: string;
  message: string;
  severity: DeskNotificationSeverity;
  category: DeskNotificationCategory;
  intendedRoleIds?: string[];
  intendedStaffIds?: string[];
  visibleToSysAdmin: boolean;
  visibleToBranchManagers: boolean;
  requiresAcknowledgement: boolean;
  acknowledgedBy: DeskNotificationAck[];
  status: DeskNotificationStatus;
  linkedApprovalId?: string;
  createdAt: string;
  expiresAt?: string | null;
  metadata: Record<string, unknown>;
};

