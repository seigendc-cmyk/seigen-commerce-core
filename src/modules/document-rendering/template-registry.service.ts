export type TemplateDefinition = {
  templateCode: string;
  title: string;
  supportedSubjectTypes: string[];
  version: number;
  sections: Array<{ heading: string; key: string }>;
};

export const TEMPLATE_REGISTRY: Record<string, TemplateDefinition> = {
  policy_diff_report_v1: {
    templateCode: "policy_diff_report_v1",
    title: "Policy diff report",
    supportedSubjectTypes: ["governance_policy_version"],
    version: 1,
    sections: [
      { heading: "Summary", key: "summary" },
      { heading: "Changed fields", key: "changed" },
    ],
  },
  compliance_case_pack_v1: {
    templateCode: "compliance_case_pack_v1",
    title: "Compliance case pack",
    supportedSubjectTypes: ["compliance_case"],
    version: 1,
    sections: [
      { heading: "Case summary", key: "case" },
      { heading: "Evidence manifest", key: "evidence" },
    ],
  },
};

export function getTemplate(templateCode: string): TemplateDefinition | null {
  return TEMPLATE_REGISTRY[templateCode] ?? null;
}

