export type FederationScopeType =
  | "global"
  | "trust"
  | "distribution_group"
  | "region"
  | "country"
  | "tenant"
  | "branch";

export type FederationScopeRow = {
  id: string;
  tenantId: string | null;
  scopeType: FederationScopeType;
  scopeCode: string;
  title: string;
  parentScopeId: string | null;
  metadata: Record<string, unknown>;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GovernanceAssetType =
  | "policy"
  | "policy_version"
  | "review_cycle"
  | "archive_policy"
  | "document_template"
  | "anomaly_rule"
  | "connector"
  | "guidance_template"
  | "records_rule"
  | "ediscovery_rule";

export type AssetScopeRow = {
  id: string;
  tenantId: string | null;
  assetType: GovernanceAssetType;
  assetId: string;
  ownerScopeType: FederationScopeType;
  ownerScopeId: string | null;
  appliesToScopeType: FederationScopeType;
  appliesToScopeId: string | null;
  inheritanceMode: "direct" | "inherited" | "overlay" | "adopted";
  canBeOverridden: boolean;
  isProtected: boolean;
  priorityRank: number;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type AssetLineageRow = {
  id: string;
  tenantId: string | null;
  assetType: string;
  parentAssetId: string;
  childAssetId: string;
  lineageType: "derived_from" | "overlay_of" | "adopted_from" | "supersedes";
  createdAt: string;
};

export type ApplicabilityBasis = {
  scopeChain: Array<{ scopeType: FederationScopeType; scopeId: string }>;
  asOfIso: string;
};

