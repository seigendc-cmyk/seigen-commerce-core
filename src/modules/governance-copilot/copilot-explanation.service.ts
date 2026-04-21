export function formatCopilotBoundaryNotice(): { title: string; bullets: string[] } {
  return {
    title: "Governance Copilot (strict boundaries)",
    bullets: [
      "I can explain, summarize, find, compare, and suggest — I cannot execute actions.",
      "I will only show data you’re authorized to see.",
      "Publishing policies, approving requests, releasing holds, deleting records, and casting votes must be done via standard governed flows.",
    ],
  };
}

