import QRCode from "qrcode";

/** Data URL PNG suitable for print HTML and jsPDF.addImage. */
export async function buildFiscalQrDataUrl(payload: string): Promise<string | null> {
  const p = payload.trim();
  if (!p) return null;
  try {
    return await QRCode.toDataURL(p, { width: 200, margin: 1, errorCorrectionLevel: "M" });
  } catch {
    return null;
  }
}
