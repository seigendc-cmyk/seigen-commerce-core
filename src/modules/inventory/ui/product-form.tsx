"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createPreviewObjectUrl,
  createProductImageId,
  getProductImageFileValidationError,
  MAX_PRODUCT_IMAGES,
  normalizeImageOrder,
  rasterImageFileToWebpDataUrl,
  revokePreviewObjectUrl,
} from "../services/product-images";
import type { BranchPriceMap } from "../types/inventory-product-meta";
import {
  INVENTORY_ITEM_TYPE_OPTIONS,
  type InventoryItemType,
} from "../types/inventory-product-meta";
import type { BomLine, Product, ProductImage } from "../types/models";
import type { ProductSectorId } from "../types/sector";
import { InventoryRepo } from "../services/inventory-repo";
import { SECTORS, getSectorConfig } from "../sector-config/sectors";
import { ProductBomSection } from "./product-bom-section";

type Props = {
  initial?: Partial<Product>;
  onSubmit: (input: Omit<Product, "id" | "createdAt" | "updatedAt">) => void;
  submitLabel?: string;
};

/** In-memory preview uses a blob URL; persisted catalog uses `dataUrl` only. */
type FormImageRow = ProductImage & { previewObjectUrl?: string };

function isSectorId(v: string): v is ProductSectorId {
  return getSectorConfig(v)?.id === (v as ProductSectorId);
}

function normalizeFormImageRows(rows: FormImageRow[]): FormImageRow[] {
  return rows
    .slice(0, MAX_PRODUCT_IMAGES)
    .sort((a, b) => a.order - b.order)
    .map((r, i) => ({ ...r, order: i }));
}

function formImagesFromInitial(initial?: Partial<Product>): FormImageRow[] {
  const raw = initial?.images;
  if (!Array.isArray(raw)) return [];
  const migrated: ProductImage[] = raw.map((img, i) => {
    const x = img as ProductImage & { url?: string };
    return {
      id: typeof x.id === "string" && x.id ? x.id : `img_${i}`,
      order: typeof x.order === "number" ? x.order : i,
      dataUrl: x.dataUrl ?? x.url ?? "",
    };
  });
  return normalizeImageOrder(migrated).map((img) => ({ ...img, previewObjectUrl: undefined }));
}

export function ProductForm({ initial, onSubmit, submitLabel = "Save product" }: Props) {
  const branches = useMemo(() => InventoryRepo.listBranches(), []);
  const suppliers = useMemo(() => InventoryRepo.listSuppliers(), []);
  const linkedProductOptions = useMemo(
    () => InventoryRepo.listProducts().filter((p) => p.id !== initial?.id),
    [initial?.id],
  );
  const bomProductPickerOptions = useMemo(
    () => InventoryRepo.listProducts().map((p) => ({ id: p.id, sku: p.sku, name: p.name })),
    [],
  );

  const [bomAssemblyLines, setBomAssemblyLines] = useState<BomLine[]>(
    () => initial?.bom?.assemblyInputs?.slice() ?? [],
  );
  const [bomDisassemblyLines, setBomDisassemblyLines] = useState<BomLine[]>(
    () => initial?.bom?.disassemblyOutputs?.slice() ?? [],
  );

  const [sku, setSku] = useState(initial?.sku ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [inventoryType, setInventoryType] = useState<InventoryItemType>(
    (initial?.inventoryType as InventoryItemType) ?? "inventory",
  );
  const [sectorId, setSectorId] = useState<ProductSectorId>(() => {
    const s = initial?.sectorId ?? "general_merchandise";
    return isSectorId(s) ? s : "general_merchandise";
  });
  const [unit, setUnit] = useState(initial?.unit ?? "each");
  const [upc, setUpc] = useState(() => (initial?.upc ?? initial?.barcode ?? "").trim());
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [productNotes, setProductNotes] = useState(initial?.productNotes ?? "");
  const [locDepartment, setLocDepartment] = useState(initial?.locDepartment ?? "");
  const [locShelf, setLocShelf] = useState(initial?.locShelf ?? "");
  const [locSite, setLocSite] = useState(initial?.locSite ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [forSale, setForSale] = useState(initial?.forSale !== false);
  const [taxable, setTaxable] = useState(initial?.taxable !== false);
  const [costPrice, setCostPrice] = useState<number>(initial?.costPrice ?? 0);
  const [averageCost, setAverageCost] = useState<number>(
    initial?.averageCost ?? initial?.costPrice ?? 0,
  );
  const [sellingPrice, setSellingPrice] = useState<number>(initial?.sellingPrice ?? 0);
  const [branchPriceInputs, setBranchPriceInputs] = useState<Record<string, string>>(() => {
    const bp = initial?.branchPrices ?? {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(bp)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = String(v);
    }
    return out;
  });
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? "");
  const [reorderQty, setReorderQty] = useState<number>(
    Number.isFinite(initial?.reorderQty) ? Number(initial?.reorderQty) : 0,
  );
  const [alternativeProductId, setAlternativeProductId] = useState(initial?.alternativeProductId ?? "");
  const [images, setImages] = useState<FormImageRow[]>(() => formImagesFromInitial(initial));
  const [imageError, setImageError] = useState<string | null>(null);
  const [isAddingImages, setIsAddingImages] = useState(false);
  const imagesRef = useRef<FormImageRow[]>(images);
  imagesRef.current = images;

  useEffect(() => {
    return () => {
      for (const row of imagesRef.current) {
        if (row.previewObjectUrl) revokePreviewObjectUrl(row.previewObjectUrl);
      }
    };
  }, []);

  const [sectorData, setSectorData] = useState<Record<string, unknown>>(
    (initial?.sectorData as Record<string, unknown>) ?? {},
  );
  const [sectorFieldError, setSectorFieldError] = useState<string | null>(null);
  const [bomError, setBomError] = useState<string | null>(null);
  const [flagExternalIdeliver, setFlagExternalIdeliver] = useState(
    Boolean(initial?.flagExternalIdeliver),
  );

  const sector = useMemo(() => getSectorConfig(sectorId), [sectorId]);

  function setSectorField(key: string, value: unknown) {
    setSectorFieldError(null);
    setSectorData((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSectorFieldError(null);
    setBomError(null);
    if (images.some((r) => !r.dataUrl)) {
      setImageError("Wait for images to finish loading before saving.");
      return;
    }
    function cleanBomLines(lines: BomLine[]): BomLine[] {
      return lines
        .filter((l) => l.productId && Number.isFinite(l.qty) && l.qty > 0)
        .map((l) => ({
          productId: l.productId.trim(),
          qty: l.qty,
          label: l.label?.trim() ? l.label.trim() : undefined,
        }));
    }
    const bomA = cleanBomLines(bomAssemblyLines);
    const bomD = cleanBomLines(bomDisassemblyLines);
    const selfId = initial?.id;
    if (selfId) {
      if (bomA.some((l) => l.productId === selfId) || bomD.some((l) => l.productId === selfId)) {
        setBomError("BOM lines cannot reference this same product.");
        return;
      }
    }

    for (const f of sector?.fields ?? []) {
      if (!f.required) continue;
      const v = sectorData[f.key];
      const empty =
        v === undefined ||
        v === null ||
        (typeof v === "string" && v.trim() === "") ||
        (typeof v === "number" && !Number.isFinite(v));
      if (empty) {
        setSectorFieldError(`Please complete: ${f.label}`);
        return;
      }
    }
    const branchPrices: BranchPriceMap = {};
    for (const b of branches) {
      const raw = branchPriceInputs[b.id]?.trim();
      if (!raw) continue;
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) branchPrices[b.id] = n;
    }

    const scan = upc.trim();
    const payload: Omit<Product, "id" | "createdAt" | "updatedAt"> = {
      sku: sku.trim(),
      name: name.trim(),
      sectorId,
      inventoryType,
      unit: unit.trim() || "each",
      locDepartment: locDepartment.trim() || undefined,
      locShelf: locShelf.trim() || undefined,
      locSite: locSite.trim() || undefined,
      costPrice: Math.max(0, Number.isFinite(costPrice) ? costPrice : 0),
      averageCost: Math.max(0, Number.isFinite(averageCost) ? averageCost : 0),
      sellingPrice: Math.max(0, Number.isFinite(sellingPrice) ? sellingPrice : 0),
      branchPrices: Object.keys(branchPrices).length > 0 ? branchPrices : undefined,
      upc: scan || undefined,
      barcode: scan || undefined,
      brand: brand.trim() || undefined,
      description: description.trim() || undefined,
      productNotes: productNotes.trim() || undefined,
      taxable,
      supplierId: supplierId.trim() || undefined,
      reorderQty: Math.max(0, Math.floor(Number.isFinite(reorderQty) ? reorderQty : 0)),
      alternativeProductId: alternativeProductId.trim() || undefined,
      bom:
        bomA.length > 0 || bomD.length > 0
          ? {
              assemblyInputs: bomA.length > 0 ? bomA : undefined,
              disassemblyOutputs: bomD.length > 0 ? bomD : undefined,
            }
          : undefined,
      active,
      forSale,
      flagExternalIdeliver,
      images: normalizeImageOrder(
        images.map(({ id, order, dataUrl }) => ({ id, order, dataUrl })),
      ),
      sectorData,
    };
    onSubmit(payload);
  }

  async function addImagesFromFiles(list: FileList | null) {
    setImageError(null);
    if (!list || list.length === 0) return;
    if (images.length >= MAX_PRODUCT_IMAGES) {
      setImageError(`Maximum ${MAX_PRODUCT_IMAGES} images allowed.`);
      return;
    }

    const files = Array.from(list);
    const remaining = MAX_PRODUCT_IMAGES - images.length;
    const picked = files.slice(0, remaining);

    for (const f of picked) {
      const err = getProductImageFileValidationError(f);
      if (err) {
        setImageError(err);
        return;
      }
    }

    setIsAddingImages(true);
    try {
      for (const f of picked) {
        const id = createProductImageId();
        const previewObjectUrl = createPreviewObjectUrl(f);
        try {
          setImages((prev) => {
            if (prev.length >= MAX_PRODUCT_IMAGES) {
              revokePreviewObjectUrl(previewObjectUrl);
              return prev;
            }
            const row: FormImageRow = {
              id,
              dataUrl: "",
              order: prev.length,
              previewObjectUrl,
            };
            return normalizeFormImageRows([...prev, row]);
          });

          const dataUrl = await rasterImageFileToWebpDataUrl(f);
          setImages((prev) => {
            const exists = prev.some((r) => r.id === id);
            if (!exists) {
              revokePreviewObjectUrl(previewObjectUrl);
              return prev;
            }
            revokePreviewObjectUrl(previewObjectUrl);
            return normalizeFormImageRows(
              prev.map((r) => (r.id === id ? { ...r, dataUrl, previewObjectUrl: undefined } : r)),
            );
          });
        } catch (e) {
          revokePreviewObjectUrl(previewObjectUrl);
          setImages((prev) => normalizeFormImageRows(prev.filter((r) => r.id !== id)));
          setImageError(e instanceof Error ? e.message : "Could not add images.");
          break;
        }
      }
    } finally {
      setIsAddingImages(false);
    }
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const row = prev.find((r) => r.id === id);
      if (row?.previewObjectUrl) revokePreviewObjectUrl(row.previewObjectUrl);
      return normalizeFormImageRows(prev.filter((img) => img.id !== id));
    });
  }

  function moveImage(id: string, dir: -1 | 1) {
    setImages((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      if (idx < 0) return prev;
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return normalizeFormImageRows(next);
    });
  }

  const imagesStillLoading = images.some((r) => !r.dataUrl);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1 — Identity & classification */}
      <div className="vendor-panel rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Identity &amp; classification</h2>
        <p className="mt-1 text-xs text-neutral-500">Core catalog identity and how this item is stocked.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-neutral-200" htmlFor="p-name">
              Product name
            </label>
            <input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="Display name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="p-sku">
              SKU
            </label>
            <input
              id="p-sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              required
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm font-mono"
              placeholder="e.g. SP-0001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="p-inv-type">
              Type of inventory
            </label>
            <select
              id="p-inv-type"
              value={inventoryType}
              onChange={(e) => setInventoryType(e.target.value as InventoryItemType)}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
            >
              {INVENTORY_ITEM_TYPE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="p-sector">
              Sector
            </label>
            <select
              id="p-sector"
              value={sectorId}
              onChange={(e) => setSectorId(e.target.value as ProductSectorId)}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
            >
              {SECTORS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm text-neutral-200">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 accent-teal-600"
              />
              Active
            </label>
            <label className="flex items-start gap-2 text-sm text-neutral-200">
              <input
                type="checkbox"
                checked={forSale}
                onChange={(e) => setForSale(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-teal-600"
              />
              <span>
                Available for sale at POS
                <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                  Uncheck for admin hold (still searchable in back office).
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* 2 — Description & notes */}
      <div className="vendor-panel rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Description &amp; notes</h2>
        <div className="mt-4 grid gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="p-desc">
              Description
            </label>
            <textarea
              id="p-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="Customer-facing or listing copy"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="p-notes">
              Product notes
            </label>
            <textarea
              id="p-notes"
              value={productNotes}
              onChange={(e) => setProductNotes(e.target.value)}
              rows={3}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="Internal notes — sourcing, quality, buyer comments…"
            />
          </div>
        </div>
      </div>

      {/* 3 — Identifiers & unit of measure */}
      <div className="vendor-panel rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Identifiers &amp; unit of measure (UM)</h2>
        <p className="mt-1 text-xs text-neutral-500">
          UPC is the primary scan code for barcode and handheld inventory scanners.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="p-upc">
              Universal Product Code (UPC)
            </label>
            <input
              id="p-upc"
              value={upc}
              onChange={(e) => setUpc(e.target.value)}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm font-mono"
              placeholder="Scan or enter UPC / GTIN"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="p-um">
              UM (unit of measure)
            </label>
            <input
              id="p-um"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. each, box, kg, hour"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-neutral-200" htmlFor="p-alt">
              Alternative lookup product
            </label>
            <select
              id="p-alt"
              value={alternativeProductId}
              onChange={(e) => setAlternativeProductId(e.target.value)}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
            >
              <option value="">None — link substitute or alternate SKU</option>
              {linkedProductOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              Links this item to another catalog product for lookup, substitution, or cross-reference.
            </p>
          </div>
        </div>
      </div>

      {/* 4 — Location */}
      <div className="vendor-panel rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Department · shelf · location</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="p-dept">
              Department
            </label>
            <input
              id="p-dept"
              value={locDepartment}
              onChange={(e) => setLocDepartment(e.target.value)}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. Hardware"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="p-shelf">
              Shelf
            </label>
            <input
              id="p-shelf"
              value={locShelf}
              onChange={(e) => setLocShelf(e.target.value)}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. A-12"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="p-loc">
              Location
            </label>
            <input
              id="p-loc"
              value={locSite}
              onChange={(e) => setLocSite(e.target.value)}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="Bin, aisle, zone…"
            />
          </div>
        </div>
      </div>

      {/* 5 — Commercial */}
      <div className="vendor-panel rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Brand &amp; supplier</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="p-brand">
              Brand
            </label>
            <input
              id="p-brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="Manufacturer or house brand"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="p-supplier">
              Supplier name
            </label>
            <select
              id="p-supplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm text-neutral-200 sm:col-span-2">
            <input
              type="checkbox"
              checked={taxable}
              onChange={(e) => setTaxable(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-teal-600"
            />
            <span>
              Item is taxable
              <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                Uncheck for tax-exempt lines (subject to your tax engine rules).
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* 6 — Pricing */}
      <div className="vendor-panel rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Pricing &amp; costs</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Standard price applies everywhere unless a shop-specific price is set below.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="p-standard">
              Standard price
            </label>
            <input
              id="p-standard"
              type="number"
              min={0}
              step="any"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(Number(e.target.value))}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="p-unitcost">
              Unit cost
            </label>
            <input
              id="p-unitcost"
              type="number"
              min={0}
              step="any"
              value={costPrice}
              onChange={(e) => setCostPrice(Number(e.target.value))}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="p-avgcost">
              Average cost
            </label>
            <input
              id="p-avgcost"
              type="number"
              min={0}
              step="any"
              value={averageCost}
              onChange={(e) => setAverageCost(Number(e.target.value))}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="mt-6 border-t border-white/10 pt-5">
          <h3 className="text-sm font-semibold text-white">Price by shop / branch</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Leave blank to use the standard price for that location.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {branches.map((b) => (
              <div key={b.id}>
                <label className="block text-xs font-medium text-neutral-400" htmlFor={`bp-${b.id}`}>
                  {b.name}
                </label>
                <input
                  id={`bp-${b.id}`}
                  type="number"
                  min={0}
                  step="any"
                  value={branchPriceInputs[b.id] ?? ""}
                  onChange={(e) =>
                    setBranchPriceInputs((prev) => ({ ...prev, [b.id]: e.target.value }))
                  }
                  className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                  placeholder={`Default ${sellingPrice.toFixed(2)}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 7 — Replenishment */}
      <div className="vendor-panel rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Replenishment</h2>
        <div className="mt-4 max-w-xs">
          <label className="block text-sm font-medium text-neutral-200" htmlFor="p-reorder">
            Reorder quantity
          </label>
          <input
            id="p-reorder"
            type="number"
            min={0}
            step={1}
            value={reorderQty}
            onChange={(e) => setReorderQty(Number(e.target.value))}
            className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* 8 — Assembly & breakdown BOM */}
      {bomError ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {bomError}
        </div>
      ) : null}
      <ProductBomSection
        productOptions={bomProductPickerOptions}
        selfProductId={initial?.id}
        assemblyLines={bomAssemblyLines}
        onAssemblyChange={setBomAssemblyLines}
        disassemblyLines={bomDisassemblyLines}
        onDisassemblyChange={setBomDisassemblyLines}
      />

      {/* 9 — Sector-specific (prompted by sector) */}
      <div className="vendor-panel rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Sector-specific fields</h2>
            <p className="mt-1 text-sm text-neutral-300">
              Fields change based on the selected sector (aligned with your Business Profile and Supabase{" "}
              <code className="rounded bg-neutral-800 px-1 text-xs">product_sectors</code>). Sector attributes are stored
              on the product and included in catalog search — use them for sale-ready listings (e.g. agriculture offer
              details).
            </p>
          </div>
          <div className="rounded-lg border border-white/18 bg-[var(--vendor-field-bg)] px-3 py-2 text-sm text-neutral-200">
            {sector?.label ?? "—"}
          </div>
        </div>

        {sectorFieldError ? (
          <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            {sectorFieldError}
          </p>
        ) : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {sector?.fields.map((f) => {
            const value = sectorData[f.key];
            const cell = f.fullWidth ? "sm:col-span-2" : "";

            if (f.type === "select") {
              return (
                <div key={f.key} className={cell}>
                  <label className="block text-sm font-medium text-neutral-200" htmlFor={`sf-${f.key}`}>
                    {f.label}
                    {f.required ? <span className="text-teal-600"> *</span> : null}
                  </label>
                  <select
                    id={`sf-${f.key}`}
                    value={(typeof value === "string" ? value : "") as string}
                    onChange={(e) => setSectorField(f.key, e.target.value)}
                    className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                    required={!!f.required}
                  >
                    <option value="">Select…</option>
                    {(f.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {f.helpText ? <p className="mt-1 text-xs text-neutral-400">{f.helpText}</p> : null}
                </div>
              );
            }
            if (f.type === "boolean") {
              return (
                <label key={f.key} className={`flex items-center gap-2 text-sm text-neutral-200 ${cell}`}>
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => setSectorField(f.key, e.target.checked)}
                    className="h-4 w-4 accent-teal-600"
                  />
                  {f.label}
                </label>
              );
            }
            if (f.type === "number") {
              const min = f.min ?? 0;
              const step = f.step ?? "any";
              return (
                <div key={f.key} className={cell}>
                  <label className="block text-sm font-medium text-neutral-200" htmlFor={`sf-${f.key}`}>
                    {f.label}
                    {f.required ? <span className="text-teal-600"> *</span> : null}
                  </label>
                  <input
                    id={`sf-${f.key}`}
                    type="number"
                    value={typeof value === "number" ? value : value !== undefined && value !== "" ? Number(value) : ""}
                    onChange={(e) => setSectorField(f.key, e.target.value === "" ? "" : Number(e.target.value))}
                    className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                    placeholder={f.placeholder}
                    required={!!f.required}
                    min={min}
                    step={step}
                  />
                  {f.helpText ? <p className="mt-1 text-xs text-neutral-400">{f.helpText}</p> : null}
                </div>
              );
            }
            if (f.type === "date") {
              const str =
                typeof value === "string"
                  ? value
                  : value instanceof Date
                    ? value.toISOString().slice(0, 10)
                    : "";
              return (
                <div key={f.key} className={cell}>
                  <label className="block text-sm font-medium text-neutral-200" htmlFor={`sf-${f.key}`}>
                    {f.label}
                    {f.required ? <span className="text-teal-600"> *</span> : null}
                  </label>
                  <input
                    id={`sf-${f.key}`}
                    type="date"
                    value={str}
                    onChange={(e) => setSectorField(f.key, e.target.value)}
                    className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                    required={!!f.required}
                  />
                  {f.helpText ? <p className="mt-1 text-xs text-neutral-400">{f.helpText}</p> : null}
                </div>
              );
            }
            if (f.type === "textarea") {
              return (
                <div key={f.key} className={cell}>
                  <label className="block text-sm font-medium text-neutral-200" htmlFor={`sf-${f.key}`}>
                    {f.label}
                    {f.required ? <span className="text-teal-600"> *</span> : null}
                  </label>
                  <textarea
                    id={`sf-${f.key}`}
                    rows={f.rows ?? 4}
                    value={typeof value === "string" ? value : value ? String(value) : ""}
                    onChange={(e) => setSectorField(f.key, e.target.value)}
                    className="vendor-field mt-1 w-full resize-y rounded-lg px-3 py-2 text-sm"
                    placeholder={f.placeholder}
                    required={!!f.required}
                  />
                  {f.helpText ? <p className="mt-1 text-xs text-neutral-400">{f.helpText}</p> : null}
                </div>
              );
            }
            return (
              <div key={f.key} className={cell}>
                <label className="block text-sm font-medium text-neutral-200" htmlFor={`sf-${f.key}`}>
                  {f.label}
                  {f.required ? <span className="text-teal-600"> *</span> : null}
                </label>
                <input
                  id={`sf-${f.key}`}
                  value={typeof value === "string" ? value : value ? String(value) : ""}
                  onChange={(e) => setSectorField(f.key, e.target.value)}
                  className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                  placeholder={f.placeholder}
                  required={!!f.required}
                />
                {f.helpText ? <p className="mt-1 text-xs text-neutral-400">{f.helpText}</p> : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="vendor-panel rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Catalog &amp; storefront · iDeliver</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
          Flag SKUs that may be fulfilled by an <span className="text-neutral-100">external</span> verified driver or
          contractor (see Settings → iDeliver). Your item list and planned storefront views show this so staff and
          customers know delivery may use an outside provider.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/12 bg-white/[0.04] p-4">
          <input
            type="checkbox"
            checked={flagExternalIdeliver}
            onChange={(e) => setFlagExternalIdeliver(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600"
          />
          <span className="text-sm leading-relaxed text-neutral-200">
            <span className="font-medium text-white">External iDeliver provider may fulfil this product</span>
            <span className="mt-1 block text-neutral-400">
              When enabled, the catalog shows an &quot;External iDeliver&quot; indicator next to this SKU.
            </span>
          </span>
        </label>
      </div>

      <div className="vendor-panel rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Product images</h2>
            <p className="mt-1 text-sm text-neutral-300">
              JPEG, PNG, GIF, WebP, and other common formats — converted to WebP for storage · instant preview ·{" "}
              {images.length} / {MAX_PRODUCT_IMAGES}
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-teal-500 hover:text-teal-600">
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,image/avif,image/tiff,.jpg,.jpeg,.png,.gif,.webp,.bmp,.avif,.tif,.tiff,.heic,.heif"
              multiple
              className="hidden"
              onChange={(e) => {
                void addImagesFromFiles(e.target.files);
                e.currentTarget.value = "";
              }}
              disabled={isAddingImages || images.length >= MAX_PRODUCT_IMAGES}
            />
            {isAddingImages ? "Adding…" : "Upload images"}
          </label>
        </div>

        {imageError ? (
          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {imageError}
          </div>
        ) : null}

        {images.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-300">No images yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((img, idx) => (
              <li key={img.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="h-16 w-16 overflow-hidden rounded-lg border border-white/10 bg-black/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.previewObjectUrl ?? img.dataUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Image {idx + 1}{idx === 0 ? " · Primary" : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-400">
                        {!img.dataUrl ? "Converting to WebP…" : "Stored as WebP · local"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    className="text-xs font-semibold text-neutral-300 hover:text-white"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveImage(img.id, -1)}
                    disabled={idx === 0}
                    className="rounded border border-white/20 px-2 py-1 text-xs text-white hover:border-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(img.id, 1)}
                    disabled={idx === images.length - 1}
                    className="rounded border border-white/20 px-2 py-1 text-xs text-white hover:border-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ↓
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={imagesStillLoading || isAddingImages}
          className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
