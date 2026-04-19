import type { ProductImage } from "../types/models";

export const MAX_PRODUCT_IMAGES = 8;

/** Reject uploads larger than this before reading (client guard for localStorage). */
export const MAX_WEBP_FILE_BYTES = 3 * 1024 * 1024;

/** Larger inputs allowed before decode (e.g. staff ID photos) — still encoded down to WebP. */
export const MAX_RASTER_IMAGE_INPUT_BYTES = 8 * 1024 * 1024;

export const RASTER_IMAGE_TOO_LARGE_ERROR = `Image must be under ${Math.round(MAX_RASTER_IMAGE_INPUT_BYTES / (1024 * 1024))} MB.`;

export type ImageEncodeOptions = {
  maxDimensionPx: number;
  quality: number;
};

const DEFAULT_ENCODE: ImageEncodeOptions = { maxDimensionPx: 1024, quality: 0.82 };

export const WEBP_ONLY_ERROR =
  "Only .webp images are supported. Convert your file to WebP, then upload again.";

export const WEBP_FILE_TOO_LARGE_ERROR = `Each image must be under ${Math.round(MAX_WEBP_FILE_BYTES / (1024 * 1024))} MB.`;

/** Shown when the file is not a supported raster type (SVG and non-images are rejected). */
export const PRODUCT_IMAGE_UNSUPPORTED_ERROR =
  "Please use JPEG, PNG, GIF, WebP, or another common raster image (SVG is not supported).";

const RASTER_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "avif",
  "tif",
  "tiff",
  "ico",
  "heic",
  "heif",
]);

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `img_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function createProductImageId(): string {
  return uid();
}

/** Accept WebP uploads only (by extension and MIME when present). */
export function isWebpFile(file: File): boolean {
  const nameOk = file.name.toLowerCase().endsWith(".webp");
  const t = file.type.trim().toLowerCase();
  const typeOk = t === "image/webp" || t === "";
  return nameOk && typeOk;
}

/**
 * JPEG / PNG / GIF / WebP / etc. — anything the browser can decode with {@link createImageBitmap},
 * except SVG. Unknown MIME with a known photo extension is allowed.
 */
export function isAcceptedProductImageFile(file: File): boolean {
  const t = file.type.trim().toLowerCase();
  if (t === "image/svg+xml") return false;
  if (t.startsWith("image/")) return true;
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if ((t === "" || t === "application/octet-stream") && RASTER_EXTENSIONS.has(ext)) return true;
  return false;
}

/** Sync validation for product image pickers (size + type). */
export function getProductImageFileValidationError(file: File): string | null {
  if (file.size > MAX_RASTER_IMAGE_INPUT_BYTES) return RASTER_IMAGE_TOO_LARGE_ERROR;
  if (!isAcceptedProductImageFile(file)) return PRODUCT_IMAGE_UNSUPPORTED_ERROR;
  return null;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

function scaleToFit(w: number, h: number, maxDim: number): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: maxDim, h: maxDim };
  const maxSide = Math.max(w, h);
  if (maxSide <= maxDim) return { w, h };
  const s = maxDim / maxSide;
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

async function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const q = clamp01(quality);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", q));
  if (!blob) throw new Error("Could not encode WebP in this browser.");
  return blob;
}

async function encodeBitmapToWebpDataUrl(
  bitmap: ImageBitmap,
  opts: Partial<ImageEncodeOptions> = {},
): Promise<string> {
  const enc: ImageEncodeOptions = {
    maxDimensionPx: opts.maxDimensionPx ?? DEFAULT_ENCODE.maxDimensionPx,
    quality: opts.quality ?? DEFAULT_ENCODE.quality,
  };
  const { w, h } = scaleToFit(bitmap.width, bitmap.height, enc.maxDimensionPx);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await canvasToWebpBlob(canvas, enc.quality);
  return await blobToDataUrl(blob);
}

/**
 * Raster image upload (JPEG, PNG, GIF, WebP, etc.) → optimized WebP data URL (`data:image/webp;base64,...`).
 */
export async function rasterImageFileToWebpDataUrl(
  file: File,
  opts: Partial<ImageEncodeOptions> & { maxInputBytes?: number } = {},
): Promise<string> {
  const maxIn = opts.maxInputBytes ?? MAX_RASTER_IMAGE_INPUT_BYTES;
  if (file.size > maxIn) throw new Error(RASTER_IMAGE_TOO_LARGE_ERROR);
  if (!isAcceptedProductImageFile(file)) throw new Error(PRODUCT_IMAGE_UNSUPPORTED_ERROR);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Could not read this image. Try a different file or format.");
  }
  try {
    return await encodeBitmapToWebpDataUrl(bitmap, opts);
  } finally {
    bitmap.close?.();
  }
}

/** Immediate preview in the form — not persisted. Caller must revoke when done. */
export function createPreviewObjectUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function revokePreviewObjectUrl(url: string): void {
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
}

/**
 * Persisted shape: base64 WebP data URL (`data:image/webp;base64,...`).
 * Pipeline: decode WebP → optional downscale → re-encode WebP (keeps catalog efficient).
 * For preview, use {@link createPreviewObjectUrl} until this resolves.
 */
export async function webpFileToPersistedDataUrl(
  file: File,
  opts: Partial<ImageEncodeOptions> = {},
): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Could not read this WebP file. Try re-exporting it from your editor.");
  }
  try {
    return await encodeBitmapToWebpDataUrl(bitmap, opts);
  } finally {
    bitmap.close?.();
  }
}

export function normalizeImageOrder(images: ProductImage[]): ProductImage[] {
  return [...images]
    .filter((img) => img && typeof img.dataUrl === "string" && img.dataUrl.length > 0)
    .slice(0, MAX_PRODUCT_IMAGES)
    .sort((a, b) => a.order - b.order)
    .map((img, i) => ({ ...img, order: i }));
}

export function makeProductImage(dataUrl: string, order: number): ProductImage {
  return { id: uid(), dataUrl, order };
}
