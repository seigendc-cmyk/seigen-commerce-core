export function suggestNextSteps(input: { topic: string; context?: Record<string, unknown> }): { suggestions: string[] } {
  const t = input.topic.toLowerCase();
  if (t.includes("publish") || t.includes("overlay")) {
    return {
      suggestions: [
        "Review overlay diff against base policy and confirm only allowed fields are changed.",
        "Verify effective dates and priority rank vs existing overlays.",
        "Run applicability preview for representative branches/tenants before publishing.",
      ],
    };
  }
  if (t.includes("ediscovery") || t.includes("matter")) {
    return {
      suggestions: [
        "Open an e-discovery matter and define a scoped search query.",
        "Save a review set and add key records (workflows, approvals, cases, bundles).",
        "Place legal holds on sensitive records before export if required.",
      ],
    };
  }
  return { suggestions: ["Gather more context (policy code, scope chain, and date), then run an applicability preview."] };
}

