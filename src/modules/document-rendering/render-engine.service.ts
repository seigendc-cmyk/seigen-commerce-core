import { getTemplate } from "./template-registry.service";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderDocument(input: {
  templateCode: string;
  title: string;
  subjectType: string;
  data: Record<string, unknown>;
}): { ok: true; html: string; manifestJson: Record<string, unknown> } | { ok: false; error: string } {
  const tpl = getTemplate(input.templateCode);
  if (!tpl) return { ok: false, error: `Unknown template: ${input.templateCode}` };
  if (!tpl.supportedSubjectTypes.includes(input.subjectType)) return { ok: false, error: "Template does not support this subject type." };

  const generatedAt = new Date().toISOString();
  const sectionsHtml = tpl.sections
    .map((s) => {
      const v = input.data[s.key];
      const body = typeof v === "string" ? `<p>${esc(v)}</p>` : `<pre>${esc(JSON.stringify(v ?? {}, null, 2))}</pre>`;
      return `<h2>${esc(s.heading)}</h2>${body}`;
    })
    .join("");

  const html = `<!doctype html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(input.title)}</title>
<style>
body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;padding:24px}
h1{font-size:20px;margin:0 0 12px}
h2{font-size:14px;margin:18px 0 8px}
p,pre{font-size:12px}
pre{background:#0b1220;color:#e5e7eb;padding:12px;border-radius:12px;overflow:auto}
.meta{font-size:11px;color:#6b7280;margin-bottom:14px}
</style></head>
<body>
<h1>${esc(input.title)}</h1>
<div class="meta">Generated at ${esc(generatedAt)} · Template ${esc(tpl.templateCode)}</div>
${sectionsHtml}
</body></html>`;

  return {
    ok: true,
    html,
    manifestJson: {
      templateCode: tpl.templateCode,
      templateVersion: tpl.version,
      subjectType: input.subjectType,
      generatedAt,
      sectionKeys: tpl.sections.map((s) => s.key),
    },
  };
}

