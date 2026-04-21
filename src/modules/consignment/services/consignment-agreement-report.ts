import jsPDF from "jspdf";
import type { ConsignmentAgreementDocument } from "@/modules/consignment/services/consignment-agreement-docs";

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildConsignmentAgreementPrintHtml(doc: ConsignmentAgreementDocument): string {
  const title = escapeHtml(doc.agreementTitle || "Consignment Agreement");
  const clauses = escapeHtml(doc.clausesSnapshot || "");
  const powered = "Powered by seiGEN Commerce";
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      @page { size: A4; margin: 14mm; }
      html, body { height: 100%; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; color: #0f172a; }
      h1 { font-size: 18px; margin: 0 0 6px; }
      h2 { font-size: 13px; margin: 14px 0 6px; }
      .meta { font-size: 11px; color: #334155; margin-bottom: 12px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
      .field { border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; }
      .k { font-size: 10px; color: #475569; }
      .v { font-size: 11px; margin-top: 2px; white-space: pre-wrap; }
      .clauses { border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; font-size: 11px; line-height: 1.45; white-space: pre-wrap; }
      .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
      .line { margin-top: 14px; border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 11px; }
      footer { position: fixed; left: 0; right: 0; bottom: 8mm; text-align: center; font-size: 10px; color: #64748b; }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    <div class="meta">Signed at <b>${escapeHtml(doc.signedAtPlace || "")}</b> on <b>${escapeHtml(doc.signedAtDate || "")}</b></div>

    <h2>Parties</h2>
    <div class="grid">
      <div class="field"><div class="k">Principal Vendor (Legal name)</div><div class="v">${escapeHtml(doc.vendorLegalName || "")}</div></div>
      <div class="field"><div class="k">Trading name</div><div class="v">${escapeHtml(doc.vendorTradingName || "")}</div></div>
      <div class="field"><div class="k">Registration details</div><div class="v">${escapeHtml(doc.vendorRegistration || "")}</div></div>
      <div class="field"><div class="k">Vendor contact person</div><div class="v">${escapeHtml(doc.vendorContactPerson || "")}</div></div>
      <div class="field"><div class="k">Vendor address</div><div class="v">${escapeHtml(doc.vendorAddress || "")}</div></div>
      <div class="field"><div class="k">Postal address</div><div class="v">${escapeHtml(doc.vendorPostalAddress || "")}</div></div>
      <div class="field"><div class="k">Vendor phone</div><div class="v">${escapeHtml(doc.vendorPhone || "")}</div></div>
      <div class="field"><div class="k">Vendor email</div><div class="v">${escapeHtml(doc.vendorEmail || "")}</div></div>

      <div class="field"><div class="k">Consignment Agent (Legal name)</div><div class="v">${escapeHtml(doc.agentLegalName || "")}</div></div>
      <div class="field"><div class="k">Agent trading name</div><div class="v">${escapeHtml(doc.agentTradingName || "")}</div></div>
      <div class="field"><div class="k">National ID / Company registration</div><div class="v">${escapeHtml(doc.agentNationalIdOrReg || "")}</div></div>
      <div class="field"><div class="k">Stall location / market / shop</div><div class="v">${escapeHtml(doc.stallLocation || "")}</div></div>
      <div class="field"><div class="k">Agent phone</div><div class="v">${escapeHtml(doc.agentPhone || "")}</div></div>
      <div class="field"><div class="k">Agent email</div><div class="v">${escapeHtml(doc.agentEmail || "")}</div></div>
      <div class="field"><div class="k">Guarantor / Next of kin</div><div class="v">${escapeHtml(doc.guarantorOrNextOfKinName || "")}</div></div>
      <div class="field"><div class="k">Guarantor phone</div><div class="v">${escapeHtml(doc.guarantorOrNextOfKinPhone || "")}</div></div>
    </div>

    <h2>Commercial Terms</h2>
    <div class="grid">
      <div class="field"><div class="k">Premium (%)</div><div class="v">${escapeHtml(String(doc.premiumPercent ?? ""))}</div></div>
      <div class="field"><div class="k">Commission model</div><div class="v">${escapeHtml(doc.commissionModel || "")}</div></div>
      <div class="field"><div class="k">Commission rate / rule</div><div class="v">${escapeHtml(doc.commissionRateText || "")}</div></div>
      <div class="field"><div class="k">Settlement frequency</div><div class="v">${escapeHtml(doc.settlementFrequency || "")}</div></div>
      <div class="field"><div class="k">Settlement method</div><div class="v">${escapeHtml(doc.settlementMethod || "")}</div></div>
      <div class="field"><div class="k">Territory / exclusivity</div><div class="v">${escapeHtml(doc.territoryExclusivity || "")}</div></div>
      <div class="field"><div class="k">Term & renewal</div><div class="v">${escapeHtml(doc.termAndRenewal || "")}</div></div>
      <div class="field"><div class="k">Security deposit / guarantee</div><div class="v">${escapeHtml(doc.securityDepositText || "")}</div></div>
      <div class="field"><div class="k">Governing law / jurisdiction</div><div class="v">${escapeHtml(doc.governingLawAndJurisdiction || "")}</div></div>
    </div>

    <h2>Clauses</h2>
    <div class="clauses">${clauses}</div>

    <div class="sign">
      <div class="line"><b>Principal Vendor signatory:</b> ${escapeHtml(doc.principalSignName || "")}<br/><span style="color:#64748b">Signature: ____________________</span></div>
      <div class="line"><b>Consignment Agent signatory:</b> ${escapeHtml(doc.agentSignName || "")}<br/><span style="color:#64748b">Signature: ____________________</span></div>
    </div>
    <div class="sign">
      <div class="line"><b>Witness 1:</b> ${escapeHtml(doc.witness1Name || "")}<br/><span style="color:#64748b">Signature: ____________________</span></div>
      <div class="line"><b>Witness 2:</b> ${escapeHtml(doc.witness2Name || "")}<br/><span style="color:#64748b">Signature: ____________________</span></div>
    </div>

    <footer>${powered}</footer>
  </body>
</html>`;
}

export function openConsignmentAgreementPrintWindow(doc: ConsignmentAgreementDocument) {
  const html = buildConsignmentAgreementPrintHtml(doc);
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

export async function downloadConsignmentAgreementPdf(doc: ConsignmentAgreementDocument) {
  const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  const margin = 44;
  let y = margin;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const addFooter = () => {
    pdf.setFontSize(9);
    pdf.setTextColor(100);
    pdf.text("Powered by seiGEN Commerce", pageW / 2, pageH - 26, { align: "center" });
  };

  const writeBlock = (label: string, value: string) => {
    pdf.setFontSize(10);
    pdf.setTextColor(60);
    pdf.text(label, margin, y);
    y += 14;
    pdf.setFontSize(11);
    pdf.setTextColor(20);
    const lines = pdf.splitTextToSize(value || "-", pageW - margin * 2);
    for (const line of lines) {
      if (y > pageH - 56) {
        addFooter();
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += 14;
    }
    y += 8;
  };

  pdf.setFontSize(14);
  pdf.setTextColor(15);
  pdf.text(doc.agreementTitle || "Consignment Agreement", margin, y);
  y += 18;
  pdf.setFontSize(10);
  pdf.setTextColor(80);
  pdf.text(`Signed at ${doc.signedAtPlace || "-"} on ${doc.signedAtDate || "-"}`, margin, y);
  y += 18;

  writeBlock("Principal Vendor (Legal name)", doc.vendorLegalName);
  writeBlock("Vendor trading name", doc.vendorTradingName);
  writeBlock("Vendor registration", doc.vendorRegistration);
  writeBlock("Vendor address", doc.vendorAddress);
  writeBlock("Vendor contact", `${doc.vendorContactPerson} | ${doc.vendorPhone} | ${doc.vendorEmail}`);

  writeBlock("Agent (Legal name)", doc.agentLegalName);
  writeBlock("Agent trading name", doc.agentTradingName);
  writeBlock("Agent National ID / Registration", doc.agentNationalIdOrReg);
  writeBlock("Stall location", doc.stallLocation);
  writeBlock("Agent contact", `${doc.agentPhone} | ${doc.agentEmail}`);
  writeBlock("Guarantor / Next of kin", `${doc.guarantorOrNextOfKinName} | ${doc.guarantorOrNextOfKinPhone}`);

  writeBlock("Premium (%)", String(doc.premiumPercent ?? ""));
  writeBlock("Commission model", doc.commissionModel);
  writeBlock("Commission rate / rule", doc.commissionRateText);
  writeBlock("Settlement frequency", doc.settlementFrequency);
  writeBlock("Settlement method", doc.settlementMethod);
  writeBlock("Territory / exclusivity", doc.territoryExclusivity);
  writeBlock("Term & renewal", doc.termAndRenewal);
  writeBlock("Security deposit / guarantee", doc.securityDepositText);
  writeBlock("Governing law / jurisdiction", doc.governingLawAndJurisdiction);

  writeBlock("Clauses (seiGEN Commerce aligned)", doc.clausesSnapshot);

  writeBlock("Principal signatory", doc.principalSignName);
  writeBlock("Agent signatory", doc.agentSignName);
  writeBlock("Witness 1", doc.witness1Name);
  writeBlock("Witness 2", doc.witness2Name);

  addFooter();
  pdf.save(`consignment-agreement-${doc.signedAtDate || "draft"}.pdf`);
}

export async function shareConsignmentAgreementPdf(doc: ConsignmentAgreementDocument) {
  const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  const margin = 44;
  let y = margin;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const addFooter = () => {
    pdf.setFontSize(9);
    pdf.setTextColor(100);
    pdf.text("Powered by seiGEN Commerce", pageW / 2, pageH - 26, { align: "center" });
  };

  const writeBlock = (label: string, value: string) => {
    pdf.setFontSize(10);
    pdf.setTextColor(60);
    pdf.text(label, margin, y);
    y += 14;
    pdf.setFontSize(11);
    pdf.setTextColor(20);
    const lines = pdf.splitTextToSize(value || "-", pageW - margin * 2);
    for (const line of lines) {
      if (y > pageH - 56) {
        addFooter();
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += 14;
    }
    y += 8;
  };

  pdf.setFontSize(14);
  pdf.setTextColor(15);
  pdf.text(doc.agreementTitle || "Consignment Agreement", margin, y);
  y += 18;
  pdf.setFontSize(10);
  pdf.setTextColor(80);
  pdf.text(`Signed at ${doc.signedAtPlace || "-"} on ${doc.signedAtDate || "-"}`, margin, y);
  y += 18;

  writeBlock("Principal Vendor (Legal name)", doc.vendorLegalName);
  writeBlock("Vendor trading name", doc.vendorTradingName);
  writeBlock("Vendor registration", doc.vendorRegistration);
  writeBlock("Vendor address", doc.vendorAddress);
  writeBlock("Vendor contact", `${doc.vendorContactPerson} | ${doc.vendorPhone} | ${doc.vendorEmail}`);
  writeBlock("Agent (Legal name)", doc.agentLegalName);
  writeBlock("Agent National ID / Registration", doc.agentNationalIdOrReg);
  writeBlock("Stall location", doc.stallLocation);
  writeBlock("Premium (%)", String(doc.premiumPercent ?? ""));
  writeBlock("Settlement frequency", doc.settlementFrequency);
  writeBlock("Governing law / jurisdiction", doc.governingLawAndJurisdiction);
  writeBlock("Clauses (seiGEN Commerce aligned)", doc.clausesSnapshot);

  addFooter();

  const blob = pdf.output("blob");
  const file = new File([blob], `consignment-agreement-${doc.signedAtDate || "draft"}.pdf`, { type: "application/pdf" });

  // Share targets (WhatsApp/Telegram) depend on device share sheet.
  if (navigator.share && (navigator as any).canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: doc.agreementTitle || "Consignment Agreement" });
    return;
  }
  await downloadConsignmentAgreementPdf(doc);
}

