type SavePickerWin = Window &
  Partial<{
    showSaveFilePicker: (options: {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
      startIn?: "documents";
    }) => Promise<{ createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }>;
  }>;

/**
 * Save a PDF blob via the File System Access API when available (Chrome/Edge),
 * starting in the user's Documents folder. User can open or create a `receipts` subfolder in the dialog.
 * Falls back to a normal download if the API is missing (e.g. Firefox) or the user cancels.
 */
export async function saveReceiptPdfWithFilePicker(blob: Blob, suggestedName: string): Promise<"saved" | "cancelled" | "fallback"> {
  if (typeof window === "undefined") return "cancelled";

  const w = window as SavePickerWin;
  const picker = w.showSaveFilePicker;
  if (typeof picker === "function") {
    try {
      const handle = await picker({
        suggestedName,
        types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
        startIn: "documents",
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "saved";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      if (e instanceof Error && e.name === "AbortError") return "cancelled";
      throw e;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return "fallback";
}
