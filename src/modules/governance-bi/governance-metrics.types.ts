export type GovernanceDashboardSnapshot = {
  generatedAt: string;
  deniedAccess: {
    total: number;
    last7d: number;
    byPermission: Array<{ permissionKey: string; count: number }>;
    byUser: Array<{ userId: string; count: number }>;
  };
  stepUp: {
    total: number;
    byStatus: Record<string, number>;
  };
  approvals: {
    pendingLinks: number;
    approvedLinks: number;
    rejectedLinks: number;
  };
  riskSignals: {
    repeatedDenialUsers: Array<{ userId: string; count: number }>;
    topDeniedPermissions: Array<{ permissionKey: string; count: number }>;
  };
  overrides: {
    activeGrants: number;
    activeDenies: number;
  };
};
