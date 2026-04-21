export type GeneratedSection = {
  heading: string;
  bodyHtml: string;
};

export type GeneratedDocument = {
  title: string;
  generatedAt: string;
  sections: GeneratedSection[];
  manifestJson: Record<string, unknown>;
  html: string;
};

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function generateEvidencePackageDocument(input: {
  title: string;
  bundle: any;
  items: any[];
  extra?: { case?: any; workflow?: any; resolution?: any };
}): GeneratedDocument {
  const generatedAt = new Date().toISOString();
  const sections: GeneratedSection[] = [];

  sections.push({
    heading: "Summary",
    bodyHtml: `<p><strong>Bundle:</strong> ${esc(String(input.bundle.bundle_code ?? ""))}</p>
<p><strong>Type:</strong> ${esc(String(input.bundle.bundle_type ?? ""))}</p>
<p><strong>Status:</strong> ${esc(String(input.bundle.status ?? ""))}</p>`,
  });

  if (input.extra?.case) {
    sections.push({
      heading: "Compliance case",
      bodyHtml: `<p><strong>Title:</strong> ${esc(String(input.extra.case.title ?? ""))}</p>
<p><strong>Type:</strong> ${esc(String(input.extra.case.case_type ?? ""))}</p>
<p><strong>Severity:</strong> ${esc(String(input.extra.case.severity ?? ""))}</p>
<p>${esc(String(input.extra.case.summary ?? ""))}</p>`,
    });
  }

  sections.push({
    heading: "Evidence manifest",
    bodyHtml:
      input.items.length === 0
        ? "<p>No evidence items.</p>"
        : `<ol>${input.items
            .map((it) => `<li><strong>${esc(String(it.title))}</strong><br/><span>${esc(String(it.summary))}</span></li>`)
            .join("")}</ol>`,
  });

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(input.title)}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 24px; }
      h1 { font-size: 20px; margin: 0 0 12px; }
      h2 { font-size: 14px; margin: 18px 0 8px; }
      p, li { font-size: 12px; color: #111827; }
      .meta { font-size: 11px; color: #6b7280; margin-bottom: 14px; }
      ol { padding-left: 18px; }
    </style>
  </head>
  <body>
    <h1>${esc(input.title)}</h1>
    <div class="meta">Generated at ${esc(generatedAt)}</div>
    ${sections.map((s) => `<h2>${esc(s.heading)}</h2>${s.bodyHtml}`).join("")}
  </body>
</html>`;

  return {
    title: input.title,
    generatedAt,
    sections,
    manifestJson: {
      bundleId: input.bundle.id,
      bundleCode: input.bundle.bundle_code,
      itemCount: input.items.length,
      generatedAt,
    },
    html,
  };
}

