import type { Id } from "../types/models";
import { InventoryRepo } from "./inventory-repo";
import { listProductReadModels } from "./product-read-model";
import type { ProductReadModel } from "../types/product-read-model";
import { readMoneyContextSnapshot } from "@/modules/financial/services/money-context";
import { readVendorCore } from "@/modules/dashboard/settings/vendor-core-storage";
import type { ShopBranch } from "@/modules/dashboard/settings/branches/branch-types";
import type { StaffMember } from "@/modules/dashboard/settings/staff/staff-types";
import { loadIdeliverProviders } from "@/modules/pos/services/ideliver-repo";
import type { IdeliverExternalProvider } from "@/modules/dashboard/settings/ideliver/ideliver-types";
import { readDemoSession } from "@/lib/demo-session";
import { catalogVerifiedItemCapForPlan } from "@/lib/plans";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeText(s: unknown, max = 4000): string {
  const t = String(s ?? "").trim();
  if (!t) return "";
  return t.length <= max ? t : t.slice(0, max);
}

function money(n: number): string {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function safePhoneDigits(raw: string): string {
  return raw.replace(/[^\d]+/g, "");
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const v of values) {
    const t = (v ?? "").trim();
    if (t) return t;
  }
  return "";
}

function deriveVendorBranchesForPackage(activeBranchId: string): {
  activeBranchId: string;
  branches: Array<{
    id: string;
    name: string;
    address: string;
    city: string;
    region: string;
    country: string;
    contactName: string;
    phone: string;
    email: string;
    hours: Record<string, { closed: boolean; open: string; close: string }>;
  }>;
} {
  const vendorBranches = readVendorCore<ShopBranch[]>("branches", []);
  const byId = new Map(vendorBranches.map((b) => [b.id, b]));
  const invBranches = InventoryRepo.listBranches().filter((b) => b.id !== InventoryRepo.getHeadOfficeBranch().id);

  const branches = invBranches.map((b) => {
    const vb = byId.get(b.id);
    const name = firstNonEmpty(vb?.shopName, b.name, "Branch");
    const address = vb
      ? [vb.streetLine1, vb.streetLine2, vb.suburb].filter((x) => (x ?? "").trim()).join(", ")
      : "";
    const phone = vb?.contactPhone ?? "";
    const email = vb?.contactEmail ?? "";
    return {
      id: b.id,
      name,
      address,
      city: vb?.city ?? "",
      region: vb?.region ?? "",
      country: vb?.country ?? "",
      contactName: vb?.contactName ?? "",
      phone,
      email,
      hours: vb?.businessHours ?? ({} as any),
    };
  });

  return { activeBranchId, branches };
}

function deriveVendorStaffForPackage(activeBranchId: string): {
  activeBranchId: string;
  staff: Array<{ id: string; name: string; branchId: string; phone: string; email: string; duties: string }>;
} {
  const staff = readVendorCore<StaffMember[]>("staff", []);
  const rows = staff
    .map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`.trim() || "Staff",
      branchId: s.branchId,
      phone: safeText(s.phone, 64),
      email: safeText(s.email, 128),
      duties: safeText(s.duties, 280),
    }))
    .filter((s) => s.phone.trim() || s.email.trim())
    .sort((a, b) => {
      const aLocal = a.branchId === activeBranchId ? 0 : 1;
      const bLocal = b.branchId === activeBranchId ? 0 : 1;
      if (aLocal !== bLocal) return aLocal - bLocal;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 50);
  return { activeBranchId, staff: rows };
}

function deriveDeliveryProvidersForPackage(): {
  providers: Array<{ id: string; name: string; phone: string; email: string; photoWebp: string | null }>;
} {
  // iDeliver settings is already local-first; the offline package embeds contacts for customer handoff.
  const providers = loadIdeliverProviders();
  const rows = providers
    .map((p: IdeliverExternalProvider) => ({
      id: safeText(p.id, 96) || `prov_${Date.now()}`,
      name: safeText(p.fullName, 160) || "Delivery provider",
      phone: safeText(p.phone, 64),
      email: safeText(p.email, 128),
      photoWebp: (p.photoWebp ?? null) && String(p.photoWebp).startsWith("data:image/") ? String(p.photoWebp) : null,
    }))
    .filter((p) => p.phone.trim() || p.email.trim())
    .slice(0, 50);
  return { providers: rows };
}

type BusinessProfileCoreV1 = {
  schema: "seigen_vendor_business_profile_v1";
  legalName: string;
  tradingName: string;
  businessEmail: string;
  businessPhone: string;
  website: string;
  registeredAddress: string;
  locale: string;
  timezone: string;
  vendorLogoWebp: string | null;
  storefrontBannerWebp: string | null;
  telegramHandle: string;
};

function deriveBusinessProfileForPackage(): {
  legalName: string;
  tradingName: string;
  businessEmail: string;
  businessPhone: string;
  website: string;
  registeredAddress: string;
  telegramHandle: string;
  vendorLogoWebp: string | null;
  storefrontBannerWebp: string | null;
} {
  const empty: BusinessProfileCoreV1 = {
    schema: "seigen_vendor_business_profile_v1",
    legalName: "",
    tradingName: "",
    businessEmail: "",
    businessPhone: "",
    website: "",
    registeredAddress: "",
    locale: "en-US",
    timezone: "UTC",
    vendorLogoWebp: null,
    storefrontBannerWebp: null,
    telegramHandle: "",
  };
  const stored = readVendorCore<BusinessProfileCoreV1 | null>("business_profile", null);
  const bp = stored && stored.schema === "seigen_vendor_business_profile_v1" ? { ...empty, ...stored } : empty;
  const cleanDataUrl = (v: string | null) =>
    v && String(v).startsWith("data:image/") ? String(v) : null;
  return {
    legalName: safeText(bp.legalName, 200),
    tradingName: safeText(bp.tradingName, 200),
    businessEmail: safeText(bp.businessEmail, 200),
    businessPhone: safeText(bp.businessPhone, 64),
    website: safeText(bp.website, 280),
    registeredAddress: safeText(bp.registeredAddress, 800),
    telegramHandle: safeText(String(bp.telegramHandle ?? "").trim().replace(/^@+/, ""), 80),
    vendorLogoWebp: cleanDataUrl(bp.vendorLogoWebp),
    storefrontBannerWebp: cleanDataUrl(bp.storefrontBannerWebp),
  };
}

export type InteractiveCatalogueExportOptions = {
  branchId: Id;
  includeInactive?: boolean;
  includeNotForSale?: boolean;
  includeZeroStock?: boolean;

  /** Optional policy/legal text injected into the package (plain text). */
  privacyPolicyText?: string;
  businessTermsText?: string;
  deliveryInfoText?: string;
};

type PackageProduct = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  sellingPrice: number;
  onHandQty: number;
  forSale: boolean;
  active: boolean;
  taxable: boolean;
  description: string;
  brand: string;
  sectorLabel: string;
  images: string[];
};

function toPackageProduct(p: ProductReadModel): PackageProduct {
  const imgs = (p.images ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((img) => (img?.dataUrl ? String(img.dataUrl) : ""))
    .filter((x) => x.startsWith("data:image/"))
    .slice(0, 6);
  return {
    id: p.id,
    sku: safeText(p.sku, 64) || "—",
    name: safeText(p.name, 160) || "Item",
    unit: safeText(p.unit, 24) || "ea",
    sellingPrice: Number.isFinite(p.sellingPrice) ? Math.round(p.sellingPrice * 100) / 100 : 0,
    onHandQty: Number.isFinite(p.onHandQty) ? p.onHandQty : 0,
    forSale: p.forSale !== false,
    active: Boolean(p.active),
    taxable: Boolean(p.taxable),
    description: safeText(p.description, 1200),
    brand: safeText(p.brand, 120),
    sectorLabel: safeText(p.sectorLabel, 120),
    images: imgs,
  };
}

function isVerifiedForPlanCatalogue(p: ProductReadModel): boolean {
  // “Verified catalogue items” baseline (local-first):
  // - active + forSale
  // - has at least one product image (operators attach images as part of verification readiness)
  return p.active && p.forSale !== false && Array.isArray(p.images) && p.images.length > 0;
}

export function buildInteractiveCataloguePackageHtml(opts: InteractiveCatalogueExportOptions): string {
  const branch = InventoryRepo.getBranch(opts.branchId);
  const branchName = branch?.name ?? "Branch";
  const generatedAtIso = new Date().toISOString();
  const generatedAt = new Date().toLocaleString();

  const mc = readMoneyContextSnapshot();
  const currency = mc.currencyCode;
  const taxInfo = mc.taxInfo;

  const baseRows = listProductReadModels(opts.branchId).filter((p) => {
    if (!opts.includeInactive && !p.active) return false;
    if (!opts.includeNotForSale && p.forSale === false) return false;
    if (!opts.includeZeroStock && p.onHandQty <= 0) return false;
    return true;
  });

  const session = readDemoSession();
  const cap = catalogVerifiedItemCapForPlan(session?.planId ?? null);
  const verified = cap != null ? baseRows.filter(isVerifiedForPlanCatalogue) : baseRows;
  const rows = cap != null ? verified.slice(0, cap) : verified;

  const products = rows.map(toPackageProduct);

  const vendorBranches = deriveVendorBranchesForPackage(String(opts.branchId));
  const vendorStaff = deriveVendorStaffForPackage(String(opts.branchId));
  const deliveryProviders = deriveDeliveryProvidersForPackage();
  const businessProfile = deriveBusinessProfileForPackage();

  const privacy = safeText(opts.privacyPolicyText, 12000);
  const terms = safeText(opts.businessTermsText, 12000);
  const deliveryInfo = safeText(opts.deliveryInfoText, 12000);

  const packageData = {
    schema: "seigen_offline_catalogue_package_v1",
    generatedAtIso,
    branch: { id: String(opts.branchId), name: branchName },
    money: {
      currencyCode: currency,
      taxInfo,
      taxLabel: mc.taxLabel,
      taxRatePercent: mc.taxRatePercent,
      pricesTaxInclusive: mc.pricesTaxInclusive,
      taxEnabled: mc.taxEnabled,
    },
    products,
    exportPolicy: {
      planId: session?.planId ?? null,
      verifiedItemCap: cap,
      exportedItems: rows.length,
      eligibleVerifiedItems: verified.length,
    },
    vendor: {
      profile: businessProfile,
      branches: vendorBranches,
      staff: vendorStaff,
      delivery: deliveryProviders,
      sections: {
        deliveryInfoText: deliveryInfo,
        privacyPolicyText: privacy,
        businessTermsText: terms,
      },
    },
  };

  const title = `${branchName} Catalogue (Interactive)`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="generator" content="seiGEN Commerce" />
    <style>
      :root { color-scheme: light; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; color: #0f172a; background: #f8fafc; }
      a { color: inherit; }
      .app { max-width: 1100px; margin: 0 auto; padding: 18px; }
      .topbar { display: flex; gap: 12px; align-items: center; justify-content: space-between; padding: 14px 16px; border: 1px solid #e2e8f0; background: white; border-radius: 16px; }
      .topbar.banner { background-size: cover; background-position: center; background-repeat: no-repeat; position: relative; }
      .topbar.banner:before { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(255,255,255,0.92), rgba(255,255,255,0.74)); pointer-events: none; }
      .topbar .inner { position: relative; z-index: 1; display: flex; gap: 12px; align-items: center; justify-content: space-between; width: 100%; }
      .brand { display:flex; align-items:center; gap:10px; min-width: 0; }
      .logo { width: 36px; height: 36px; border-radius: 12px; border: 1px solid #e2e8f0; overflow:hidden; background: rgba(255,255,255,0.8); flex: 0 0 auto; display:flex; align-items:center; justify-content:center; }
      .logo img { width: 100%; height: 100%; object-fit: cover; display:block; }
      .title { min-width: 0; }
      .title h1 { font-size: 16px; margin: 0; }
      .meta { margin-top: 4px; font-size: 12px; color: #475569; }
      .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 12px; border: 1px solid #cbd5e1; padding: 9px 12px; background: white; font-weight: 700; font-size: 12px; cursor: pointer; }
      .btn.primary { border-color: #0f766e; background: #0f766e; color: white; }
      .btn.danger { border-color: #fecaca; background: #fff1f2; color: #9f1239; }
      .btn:disabled { opacity: 0.6; cursor: not-allowed; }
      .grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 12px; }
      @media (min-width: 900px) { .grid { grid-template-columns: 1fr 360px; align-items: start; } }
      .panel { border: 1px solid #e2e8f0; background: white; border-radius: 16px; overflow: hidden; }
      .panel .hd { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .panel .hd h2 { margin: 0; font-size: 13px; }
      .panel .bd { padding: 14px; }
      .tabs { display: flex; flex-wrap: wrap; gap: 6px; }
      .kebabWrap { position: relative; }
      .kebabBtn { width: 40px; padding-left: 0; padding-right: 0; }
      .kebabMenu { position: absolute; right: 0; top: calc(100% + 8px); min-width: 220px; border: 1px solid #e2e8f0; background: white; border-radius: 14px; box-shadow: 0 14px 40px rgba(15,23,42,0.12); padding: 8px; display: none; z-index: 50; }
      .kebabMenu.open { display: block; }
      .kebabItem { width: 100%; text-align: left; padding: 10px 10px; border-radius: 12px; border: 0; background: transparent; cursor: pointer; font-weight: 800; font-size: 12px; color: #0f172a; }
      .kebabItem:hover { background: #f1f5f9; }
      .kebabHint { font-size: 11px; color: #64748b; margin-top: 2px; font-weight: 600; }
      .tab { border: 1px solid #e2e8f0; background: #f8fafc; padding: 7px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; cursor: pointer; }
      .tab.active { background: #0f766e; border-color: #0f766e; color: white; }
      .search { display: flex; gap: 10px; align-items: center; margin-top: 10px; }
      .field { width: 100%; border-radius: 12px; border: 1px solid #cbd5e1; padding: 10px 12px; font-size: 13px; }
      .products { display: grid; grid-template-columns: repeat(1, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
      @media (min-width: 680px) { .products { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      .card { border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px; display: grid; grid-template-columns: 86px 1fr; gap: 12px; }
      .thumb { width: 86px; height: 86px; border-radius: 14px; background: #f1f5f9; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
      .thumb img { width: 100%; height: 100%; object-fit: cover; }
      .name { font-weight: 900; font-size: 13px; margin: 0; }
      .sub { margin-top: 4px; font-size: 12px; color: #475569; }
      .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; }
      .pill { font-size: 11px; font-weight: 900; border-radius: 999px; padding: 4px 8px; background: #f1f5f9; border: 1px solid #e2e8f0; color: #0f172a; }
      .pill.ok { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }
      .pill.low { background: #fffbeb; border-color: #fde68a; color: #92400e; }
      .pill.out { background: #fff1f2; border-color: #fecaca; color: #9f1239; }
      .cartLine { display: grid; grid-template-columns: 1fr auto; gap: 10px; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
      .cartLine:last-child { border-bottom: none; }
      .qty { display: inline-flex; align-items: center; gap: 6px; }
      .qty button { width: 30px; height: 30px; border-radius: 10px; border: 1px solid #cbd5e1; background: white; font-weight: 900; cursor: pointer; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
      .muted { color: #64748b; font-size: 12px; }
      .section { display: grid; gap: 10px; }
      .kv { display: grid; grid-template-columns: 140px 1fr; gap: 10px; font-size: 12px; }
      .kv div:first-child { color: #64748b; font-weight: 800; }
      dialog { border: 1px solid #e2e8f0; border-radius: 16px; padding: 0; width: min(92vw, 920px); }
      .dlg { padding: 14px; }
      .gallery { display: grid; grid-template-columns: 1fr; gap: 10px; }
      @media (min-width: 760px) { .gallery { grid-template-columns: 1fr 260px; } }
      .hero { width: 100%; aspect-ratio: 1 / 1; border-radius: 14px; border: 1px solid #e2e8f0; background: #f1f5f9; overflow: hidden; display: flex; align-items: center; justify-content: center; }
      .hero img { width: 100%; height: 100%; object-fit: cover; }
      .thumbs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
      .thumbs button { padding: 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: white; cursor: pointer; aspect-ratio: 1 / 1; }
      .thumbs img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); display: none; }
      .overlay.open { display: block; }
      .cartDrawer { position: fixed; top: 12px; right: 12px; bottom: 12px; width: min(92vw, 420px); display: none; z-index: 50; box-shadow: 0 18px 60px rgba(15,23,42,0.35); }
      .cartDrawer.open { display: block; }
      .cartClose { border: 1px solid #e2e8f0; background: #fff; border-radius: 10px; padding: 6px 10px; font-weight: 900; font-size: 12px; cursor: pointer; }
      @media print {
        .noPrint { display: none !important; }
        body { background: white; }
        .app { max-width: none; padding: 0; }
        .panel { border: none; border-radius: 0; }
        .topbar { border: none; border-radius: 0; }
      }
    </style>
  </head>
  <body>
    <div class="app">
      <div class="topbar noPrint" id="topbar">
        <div class="inner">
          <div class="brand">
            <div class="logo" id="vendorLogo" style="display:none;"></div>
            <div class="title">
              <h1 id="titleText">${escapeHtml(title)}</h1>
              <div class="meta" id="topMeta">Generated ${escapeHtml(generatedAt)} · Items ${products.length} · Currency ${escapeHtml(currency)} · Tax ${escapeHtml(taxInfo)}</div>
            </div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
            <div class="kebabWrap">
              <button class="btn kebabBtn" id="btnMenu" type="button" aria-label="Menu">⋯</button>
              <div class="kebabMenu" id="menu">
                <button class="kebabItem" type="button" data-tab="branches">
                  Vendor branches
                  <div class="kebabHint">Addresses, call, WhatsApp, Telegram</div>
                </button>
                <button class="kebabItem" type="button" data-tab="staff">
                  Staff
                  <div class="kebabHint">Direct contacts for assistance</div>
                </button>
                <button class="kebabItem" type="button" data-tab="delivery">
                  Delivery
                  <div class="kebabHint">iDeliver contacts + delivery info</div>
                </button>
                <button class="kebabItem" type="button" data-tab="catalogue">
                  Back to catalogue
                  <div class="kebabHint">Products and cart</div>
                </button>
              </div>
            </div>
            <button class="btn" id="btnPrint" type="button">Print / Save PDF</button>
            <button class="btn primary" id="btnCart" type="button">Cart <span class="mono" id="cartCount">0</span></button>
          </div>
        </div>
      </div>

      <div class="panel noPrint" style="margin-top:12px;">
        <div class="hd">
          <h2>Menu</h2>
          <div class="muted">Portable catalogue package (offline-first)</div>
        </div>
        <div class="bd">
          <div class="tabs" id="tabs"></div>
        </div>
      </div>

      <div class="grid">
        <div class="panel">
          <div class="hd">
            <h2 id="panelTitle">Catalogue</h2>
            <div class="muted" id="panelHint"></div>
          </div>
          <div class="bd" id="panelBody"></div>
        </div>

        <div class="overlay noPrint" id="cartOverlay"></div>
        <div class="panel noPrint cartDrawer" id="cartPanel">
          <div class="hd">
            <h2>Cart</h2>
            <div style="display:flex; gap:8px; align-items:center;">
              <button class="btn danger" type="button" id="btnClearCart">Clear</button>
              <button class="cartClose" type="button" id="btnCloseCart" aria-label="Close cart">Close</button>
            </div>
          </div>
          <div class="bd">
            <div id="cartLines"></div>
            <div style="margin-top:12px;" class="section">
              <div class="kv"><div>Subtotal</div><div class="mono" id="cartSubtotal">0.00</div></div>
              <div class="kv"><div>Currency</div><div class="mono" id="cartCurrency"></div></div>
              <div class="kv"><div>Tax</div><div class="mono" id="cartTax"></div></div>
              <div class="muted">Checkout sends your cart as a message. Stock and prices may have changed since export.</div>
              <div style="display:flex; flex-wrap:wrap; gap:8px;">
                <button class="btn primary" type="button" id="btnCheckoutWhatsApp">Checkout via WhatsApp</button>
                <button class="btn" type="button" id="btnCheckoutTelegram">Checkout via Telegram</button>
                <button class="btn" type="button" id="btnCopyCheckout">Copy message</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <dialog id="dlgProduct">
      <div class="dlg">
        <div style="display:flex; gap:10px; justify-content:space-between; align-items:start;">
          <div>
            <div class="muted" id="dlgSku"></div>
            <h2 style="margin:4px 0 0 0; font-size:16px;" id="dlgName"></h2>
            <div class="sub" id="dlgMeta"></div>
          </div>
          <button class="btn" type="button" id="dlgClose">Close</button>
        </div>
        <div class="gallery" style="margin-top:12px;">
          <div class="hero"><img id="dlgHero" alt="Product image" /></div>
          <div>
            <div class="thumbs" id="dlgThumbs"></div>
            <div class="section" style="margin-top:10px;">
              <div class="kv"><div>Price</div><div class="mono" id="dlgPrice"></div></div>
              <div class="kv"><div>Stock</div><div class="mono" id="dlgStock"></div></div>
              <div class="kv"><div>Taxable</div><div class="mono" id="dlgTaxable"></div></div>
              <div class="kv"><div>Description</div><div id="dlgDesc" class="muted"></div></div>
              <button class="btn primary" type="button" id="dlgAddToCart">Add to cart</button>
            </div>
          </div>
        </div>
      </div>
    </dialog>

    <script id="seigenPackageData" type="application/json">${escapeHtml(JSON.stringify(packageData))}</script>
    <script>
      (function () {
        const data = JSON.parse(document.getElementById('seigenPackageData').textContent || '{}');
        const currency = (data.money && data.money.currencyCode) ? data.money.currencyCode : 'USD';
        const taxInfo = (data.money && data.money.taxInfo) ? data.money.taxInfo : '';
        const branch = (data.branch && data.branch.name) ? data.branch.name : 'Branch';
        const products = Array.isArray(data.products) ? data.products : [];
        const vendorBranches = (data.vendor && data.vendor.branches && Array.isArray(data.vendor.branches.branches)) ? data.vendor.branches.branches : [];
        const staff = (data.vendor && data.vendor.staff && Array.isArray(data.vendor.staff.staff)) ? data.vendor.staff.staff : [];
        const deliveryProviders = (data.vendor && data.vendor.delivery && Array.isArray(data.vendor.delivery.providers)) ? data.vendor.delivery.providers : [];
        const vendorProfile = (data.vendor && data.vendor.profile && typeof data.vendor.profile === 'object') ? data.vendor.profile : null;
        const sections = (data.vendor && data.vendor.sections) ? data.vendor.sections : { deliveryInfoText: '', privacyPolicyText: '', businessTermsText: '' };
        const exportPolicy = (data.exportPolicy && typeof data.exportPolicy === 'object') ? data.exportPolicy : null;

        const tabs = [
          { id: 'catalogue', label: 'Catalogue' },
          { id: 'delivery', label: 'Delivery info' },
          { id: 'branches', label: 'Branches' },
          { id: 'staff', label: 'Staff contacts' },
          { id: 'privacy', label: 'Privacy policy' },
          { id: 'terms', label: 'Business terms' },
        ];

        const state = {
          tab: 'catalogue',
          q: '',
          cart: loadCart(),
          dlgProductId: null,
          dlgHeroIdx: 0,
        };

        function moneyFmt(n) {
          try { return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n); }
          catch { return String(Math.round((Number(n) || 0) * 100) / 100); }
        }

        function clampMsg(s, max) {
          const t = String(s || '');
          if (t.length <= max) return t;
          return t.slice(0, max - 24) + '\\n…(truncated for share)';
        }

        function waUrl(message, phoneDigits) {
          const text = encodeURIComponent(clampMsg(message, 1800));
          if (phoneDigits) return 'https://wa.me/' + phoneDigits + '?text=' + text;
          return 'https://wa.me/?text=' + text;
        }

        function tgUrl(message) {
          const text = encodeURIComponent(clampMsg(message, 1800));
          return 'https://t.me/share/url?text=' + text;
        }

        function tgProfileUrl(handle) {
          const h = String(handle || '').trim().replace(/^@+/, '');
          if (!h) return '';
          return 'https://t.me/' + encodeURIComponent(h);
        }

        function cartKey() { return 'seigen_offline_catalogue_cart_v1:' + (data.branch && data.branch.id ? data.branch.id : 'branch'); }

        function loadCart() {
          try {
            const raw = localStorage.getItem(cartKey());
            const obj = raw ? JSON.parse(raw) : null;
            return obj && typeof obj === 'object' ? obj : {};
          } catch { return {}; }
        }

        function saveCart() {
          try { localStorage.setItem(cartKey(), JSON.stringify(state.cart)); } catch {}
        }

        function cartCount() {
          return Object.values(state.cart).reduce((s, n) => s + (Number(n) || 0), 0);
        }

        function cartLines() {
          const out = [];
          for (const [id, qty] of Object.entries(state.cart)) {
            const q = Number(qty) || 0;
            if (q <= 0) continue;
            const p = products.find(x => x.id === id);
            if (!p) continue;
            out.push({ p, qty: q });
          }
          return out;
        }

        function cartSubtotal() {
          return cartLines().reduce((s, l) => s + (Number(l.p.sellingPrice) || 0) * l.qty, 0);
        }

        function activeBranchContactPhoneDigits() {
          const activeId = (data.branch && data.branch.id) ? String(data.branch.id) : '';
          const b = vendorBranches.find(x => x.id === activeId) || vendorBranches[0];
          if (!b || !b.phone) return '';
          return String(b.phone).replace(/[^\\d]+/g, '');
        }

        function stockPill(p) {
          if (!p.active || !p.forSale) return { cls: 'out', label: 'Not for sale' };
          const on = Number(p.onHandQty) || 0;
          if (on <= 0) return { cls: 'out', label: 'Out of stock' };
          if (on <= 3) return { cls: 'low', label: 'Low stock' };
          return { cls: 'ok', label: 'In stock' };
        }

        function setTab(id) {
          state.tab = id;
          render();
        }

        function renderTabs() {
          const el = document.getElementById('tabs');
          el.innerHTML = '';
          for (const t of tabs) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'tab' + (state.tab === t.id ? ' active' : '');
            b.textContent = t.label;
            b.onclick = () => setTab(t.id);
            el.appendChild(b);
          }
        }

        function renderCatalogue() {
          document.getElementById('panelTitle').textContent = 'Catalogue';
          document.getElementById('panelHint').textContent = branch + ' · ' + products.length + ' items';
          const bd = document.getElementById('panelBody');
          bd.innerHTML = '';

          const search = document.createElement('div');
          search.className = 'search noPrint';
          search.innerHTML = '<input class="field" id="q" placeholder="Search products…" />';
          bd.appendChild(search);
          const qEl = bd.querySelector('#q');
          qEl.value = state.q;
          qEl.oninput = (e) => { state.q = e.target.value || ''; render(); };

          const list = document.createElement('div');
          list.className = 'products';
          bd.appendChild(list);

          const term = state.q.trim().toLowerCase();
          const filtered = term
            ? products.filter(p => (String(p.name).toLowerCase().includes(term) || String(p.sku).toLowerCase().includes(term) || String(p.brand || '').toLowerCase().includes(term) || String(p.sectorLabel || '').toLowerCase().includes(term)))
            : products.slice();

          if (filtered.length === 0) {
            const d = document.createElement('div');
            d.className = 'muted';
            d.textContent = 'No matching products.';
            bd.appendChild(d);
            return;
          }

          for (const p of filtered.slice(0, 400)) {
            const pill = stockPill(p);
            const card = document.createElement('div');
            card.className = 'card';
            const img = (Array.isArray(p.images) && p.images[0]) ? '<img alt="" src="' + p.images[0] + '" />' : '<span class="muted">No image</span>';
            card.innerHTML =
              '<div class="thumb">' + img + '</div>' +
              '<div>' +
                '<p class="name"></p>' +
                '<div class="sub"></div>' +
                '<div class="row">' +
                  '<span class="pill ' + pill.cls + '">' + pill.label + '</span>' +
                  '<span class="pill mono">' + currency + ' ' + moneyFmt(p.sellingPrice) + '</span>' +
                  '<span class="pill mono">SKU ' + (p.sku || '—') + '</span>' +
                '</div>' +
                '<div class="row noPrint">' +
                  '<button class="btn primary" type="button">Add</button>' +
                  '<button class="btn" type="button">View</button>' +
                '</div>' +
              '</div>';
            card.querySelector('.name').textContent = p.name;
            card.querySelector('.sub').textContent = (p.brand ? p.brand + ' · ' : '') + (p.sectorLabel ? p.sectorLabel : '');
            const btnAdd = card.querySelectorAll('button')[0];
            const btnView = card.querySelectorAll('button')[1];
            btnAdd.onclick = () => addToCart(p.id, 1);
            btnView.onclick = () => openProductDialog(p.id);
            list.appendChild(card);
          }
        }

        function renderBranches() {
          document.getElementById('panelTitle').textContent = 'Branches';
          document.getElementById('panelHint').textContent = 'Vendor branches and contacts';
          const bd = document.getElementById('panelBody');
          bd.innerHTML = '';
          if (!vendorBranches.length) {
            bd.innerHTML = '<div class="muted">No branch contact data stored yet. Configure under Settings → Branches.</div>';
            return;
          }
          const wrap = document.createElement('div');
          wrap.className = 'section';
          bd.appendChild(wrap);
          for (const b of vendorBranches) {
            const box = document.createElement('div');
            box.className = 'panel';
            const phoneDigits = String(b.phone || '').replace(/[^\\d]+/g, '');
            const wa = phoneDigits ? ('https://wa.me/' + phoneDigits) : '';
            const tel = phoneDigits ? ('tel:' + phoneDigits) : '';
            const tg = tgUrl('Hello. I am contacting you from the offline catalogue for ' + branch + '.');
            box.innerHTML =
              '<div class="hd"><h2>' + escapeHtml(String(b.name || 'Branch')) + '</h2><div class="muted mono">' + escapeHtml(String(b.id || '')) + '</div></div>' +
              '<div class="bd">' +
                '<div class="kv"><div>Address</div><div>' + escapeHtml(String(b.address || '')) + '</div></div>' +
                '<div class="kv"><div>City</div><div>' + escapeHtml(String(b.city || '')) + '</div></div>' +
                '<div class="kv"><div>Region</div><div>' + escapeHtml(String(b.region || '')) + '</div></div>' +
                '<div class="kv"><div>Country</div><div>' + escapeHtml(String(b.country || '')) + '</div></div>' +
                '<div class="kv"><div>Contact</div><div>' + escapeHtml(String(b.contactName || '')) + '</div></div>' +
                '<div class="kv"><div>Phone</div><div class="mono">' + escapeHtml(String(b.phone || '')) + '</div></div>' +
                '<div class="kv"><div>Email</div><div class="mono">' + escapeHtml(String(b.email || '')) + '</div></div>' +
                '<div class="row noPrint">' +
                  (tel ? '<a class="btn" href="' + tel + '">Call</a>' : '') +
                  (wa ? '<a class="btn primary" href="' + wa + '" target="_blank" rel="noopener">WhatsApp</a>' : '') +
                  '<a class="btn" href="' + tg + '" target="_blank" rel="noopener">Telegram</a>' +
                '</div>' +
              '</div>';
            wrap.appendChild(box);
          }
        }

        function renderStaff() {
          document.getElementById('panelTitle').textContent = 'Staff contacts';
          document.getElementById('panelHint').textContent = 'People you can message or call';
          const bd = document.getElementById('panelBody');
          bd.innerHTML = '';
          if (!staff.length) {
            bd.innerHTML = '<div class="muted">No staff contact data stored yet. Configure under Settings → Staff.</div>';
            return;
          }
          const wrap = document.createElement('div');
          wrap.className = 'section';
          bd.appendChild(wrap);
          for (const s of staff) {
            const phoneDigits = String(s.phone || '').replace(/[^\\d]+/g, '');
            const tel = phoneDigits ? ('tel:' + phoneDigits) : '';
            const wa = phoneDigits ? ('https://wa.me/' + phoneDigits) : '';
            const tg = tgUrl('Hello ' + (s.name || '') + '. I am contacting you from the offline catalogue for ' + branch + '.');
            const box = document.createElement('div');
            box.className = 'panel';
            box.innerHTML =
              '<div class="hd"><h2>' + escapeHtml(String(s.name || 'Staff')) + '</h2><div class="muted mono">' + escapeHtml(String(s.branchId || '')) + '</div></div>' +
              '<div class="bd">' +
                '<div class="kv"><div>Phone</div><div class="mono">' + escapeHtml(String(s.phone || '')) + '</div></div>' +
                '<div class="kv"><div>Email</div><div class="mono">' + escapeHtml(String(s.email || '')) + '</div></div>' +
                '<div class="kv"><div>Duties</div><div>' + escapeHtml(String(s.duties || '')) + '</div></div>' +
                '<div class="row noPrint">' +
                  (tel ? '<a class="btn" href="' + tel + '">Call</a>' : '') +
                  (wa ? '<a class="btn primary" href="' + wa + '" target="_blank" rel="noopener">WhatsApp</a>' : '') +
                  '<a class="btn" href="' + tg + '" target="_blank" rel="noopener">Telegram</a>' +
                '</div>' +
              '</div>';
            wrap.appendChild(box);
          }
        }

        function renderDelivery() {
          document.getElementById('panelTitle').textContent = 'Delivery';
          document.getElementById('panelHint').textContent = 'Delivery info and iDeliver contacts';
          const bd = document.getElementById('panelBody');
          bd.innerHTML = '';

          const parts = document.createElement('div');
          parts.className = 'section';
          bd.appendChild(parts);

          // Delivery information text block (optional)
          const info = String(sections.deliveryInfoText || '').trim();
          if (info) {
            const box = document.createElement('div');
            box.className = 'panel';
            box.innerHTML =
              '<div class="hd"><h2>Delivery information</h2><div class="muted">Policy</div></div>' +
              '<div class="bd"><pre style="white-space:pre-wrap; margin:0; font-size:12px; color:#0f172a; line-height:1.45;">' + escapeHtml(info) + '</pre></div>';
            parts.appendChild(box);
          }

          // Provider contact list (optional)
          const prov = Array.isArray(deliveryProviders) ? deliveryProviders : [];
          if (!prov.length) {
            const d = document.createElement('div');
            d.className = 'muted';
            d.textContent = 'No delivery providers stored yet. Configure under Settings → iDeliver.';
            bd.appendChild(d);
            return;
          }

          for (const p of prov) {
            const phoneDigits = String(p.phone || '').replace(/[^\\d]+/g, '');
            const tel = phoneDigits ? ('tel:' + phoneDigits) : '';
            const wa = phoneDigits ? ('https://wa.me/' + phoneDigits) : '';
            const tg = tgUrl('Hello. I am contacting you about delivery for an order from the offline catalogue for ' + branch + '.');
            const box = document.createElement('div');
            box.className = 'panel';
            const img = p.photoWebp ? ('<img alt="" src="' + p.photoWebp + '" style="width:36px;height:36px;border-radius:12px;object-fit:cover;border:1px solid #e2e8f0;background:#fff;" />') : '';
            box.innerHTML =
              '<div class="hd"><div style="display:flex; align-items:center; gap:10px;">' + img + '<h2>' + escapeHtml(String(p.name || 'Provider')) + '</h2></div><div class="muted mono">' + escapeHtml(String(p.id || '')) + '</div></div>' +
              '<div class="bd">' +
                '<div class="kv"><div>Phone</div><div class="mono">' + escapeHtml(String(p.phone || '')) + '</div></div>' +
                '<div class="kv"><div>Email</div><div class="mono">' + escapeHtml(String(p.email || '')) + '</div></div>' +
                '<div class="row noPrint">' +
                  (tel ? '<a class="btn" href="' + tel + '">Call</a>' : '') +
                  (wa ? '<a class="btn primary" href="' + wa + '" target="_blank" rel="noopener">WhatsApp</a>' : '') +
                  '<a class="btn" href="' + tg + '" target="_blank" rel="noopener">Telegram</a>' +
                '</div>' +
              '</div>';
            parts.appendChild(box);
          }
        }

        function renderTextPage(title, text) {
          document.getElementById('panelTitle').textContent = title;
          document.getElementById('panelHint').textContent = '';
          const bd = document.getElementById('panelBody');
          const t = String(text || '').trim();
          bd.innerHTML = t ? '<pre style="white-space:pre-wrap; margin:0; font-size:12px; color:#0f172a; line-height:1.45;">' + escapeHtml(t) + '</pre>' : '<div class="muted">No content provided yet.</div>';
        }

        function renderCart() {
          document.getElementById('cartCurrency').textContent = currency;
          document.getElementById('cartTax').textContent = taxInfo;
          document.getElementById('cartCount').textContent = String(cartCount());
          const linesEl = document.getElementById('cartLines');
          linesEl.innerHTML = '';
          const lines = cartLines();
          if (lines.length === 0) {
            linesEl.innerHTML = '<div class="muted">Cart is empty.</div>';
          } else {
            for (const l of lines) {
              const line = document.createElement('div');
              line.className = 'cartLine';
              line.innerHTML =
                '<div>' +
                  '<div style="font-weight:900; font-size:12px;">' + escapeHtml(l.p.name) + '</div>' +
                  '<div class="muted mono">' + escapeHtml(l.p.sku || '') + ' · ' + currency + ' ' + moneyFmt(l.p.sellingPrice) + ' / ' + escapeHtml(l.p.unit || 'ea') + '</div>' +
                '</div>' +
                '<div style="text-align:right;">' +
                  '<div class="qty">' +
                    '<button type="button">-</button>' +
                    '<span class="mono" style="min-width:2ch; display:inline-block; text-align:center;">' + String(l.qty) + '</span>' +
                    '<button type="button">+</button>' +
                  '</div>' +
                  '<div class="muted mono" style="margin-top:6px;">' + currency + ' ' + moneyFmt((Number(l.p.sellingPrice) || 0) * l.qty) + '</div>' +
                '</div>';
              const btnMinus = line.querySelectorAll('button')[0];
              const btnPlus = line.querySelectorAll('button')[1];
              btnMinus.onclick = () => addToCart(l.p.id, -1);
              btnPlus.onclick = () => addToCart(l.p.id, 1);
              linesEl.appendChild(line);
            }
          }
          document.getElementById('cartSubtotal').textContent = currency + ' ' + moneyFmt(cartSubtotal());
        }

        function addToCart(productId, delta) {
          const cur = Number(state.cart[productId] || 0) || 0;
          const next = Math.max(0, cur + delta);
          if (next <= 0) delete state.cart[productId];
          else state.cart[productId] = next;
          saveCart();
          renderCart();
        }

        function buildCheckoutMessage() {
          const lines = cartLines();
          const parts = [];
          parts.push('Order request — ' + branch);
          parts.push('Generated from offline catalogue package.');
          parts.push('');
          for (const l of lines) {
            parts.push('- ' + l.qty + ' x ' + l.p.name + (l.p.sku ? (' (' + l.p.sku + ')') : '') + ' — ' + currency + ' ' + moneyFmt(l.p.sellingPrice) + ' / ' + (l.p.unit || 'ea'));
          }
          parts.push('');
          parts.push('Subtotal: ' + currency + ' ' + moneyFmt(cartSubtotal()));
          parts.push('Tax: ' + (taxInfo || '—'));
          parts.push('');
          parts.push('Please confirm availability, delivery/pickup, and payment method.');
          return parts.join('\\n');
        }

        function openProductDialog(productId) {
          const p = products.find(x => x.id === productId);
          if (!p) return;
          state.dlgProductId = productId;
          state.dlgHeroIdx = 0;
          const dlg = document.getElementById('dlgProduct');
          document.getElementById('dlgSku').textContent = p.sku || '';
          document.getElementById('dlgName').textContent = p.name || '';
          document.getElementById('dlgMeta').textContent = (p.brand ? p.brand + ' · ' : '') + (p.sectorLabel || '');
          document.getElementById('dlgPrice').textContent = currency + ' ' + moneyFmt(p.sellingPrice);
          document.getElementById('dlgStock').textContent = String(p.onHandQty) + ' on hand';
          document.getElementById('dlgTaxable').textContent = p.taxable ? 'Yes' : 'No';
          document.getElementById('dlgDesc').textContent = p.description || '';

          const imgs = Array.isArray(p.images) ? p.images : [];
          const hero = document.getElementById('dlgHero');
          hero.src = imgs[0] || '';
          hero.style.display = hero.src ? 'block' : 'none';

          const thumbs = document.getElementById('dlgThumbs');
          thumbs.innerHTML = '';
          for (let i = 0; i < imgs.length; i++) {
            const b = document.createElement('button');
            b.type = 'button';
            b.innerHTML = '<img alt="" src="' + imgs[i] + '" />';
            b.onclick = () => { hero.src = imgs[i]; hero.style.display = hero.src ? 'block' : 'none'; };
            thumbs.appendChild(b);
          }
          document.getElementById('dlgAddToCart').onclick = () => addToCart(p.id, 1);
          document.getElementById('dlgClose').onclick = () => dlg.close();
          dlg.showModal();
        }

        function render() {
          renderTabs();
          renderCart();
          try {
            const top = document.getElementById('topMeta');
            if (top && exportPolicy && exportPolicy.verifiedItemCap != null) {
              top.textContent = top.textContent + ' · Plan cap: ' + String(exportPolicy.exportedItems) + '/' + String(exportPolicy.verifiedItemCap) + ' verified items';
            }
          } catch {}

          // Branding: banner + logo if present in vendor profile
          try {
            if (vendorProfile && vendorProfile.storefrontBannerWebp) {
              const topbar = document.getElementById('topbar');
              topbar.classList.add('banner');
              topbar.style.backgroundImage = 'url(' + vendorProfile.storefrontBannerWebp + ')';
            }
            if (vendorProfile && vendorProfile.vendorLogoWebp) {
              const logo = document.getElementById('vendorLogo');
              logo.style.display = 'flex';
              logo.innerHTML = '<img alt="" src="' + vendorProfile.vendorLogoWebp + '" />';
            }
          } catch {}

          if (state.tab === 'catalogue') renderCatalogue();
          else if (state.tab === 'branches') renderBranches();
          else if (state.tab === 'staff') renderStaff();
          else if (state.tab === 'delivery') renderDelivery();
          else if (state.tab === 'privacy') renderTextPage('Privacy policy', sections.privacyPolicyText);
          else if (state.tab === 'terms') renderTextPage('Business terms', sections.businessTermsText);
          else renderCatalogue();
        }

        document.getElementById('btnPrint').onclick = () => window.print();

        // Three-dot menu (kebab) for quick navigation
        (function wireMenu() {
          const btn = document.getElementById('btnMenu');
          const menu = document.getElementById('menu');
          if (!btn || !menu) return;
          function close() { menu.classList.remove('open'); }
          function toggle() { menu.classList.toggle('open'); }
          btn.onclick = (e) => { e.stopPropagation(); toggle(); };
          menu.onclick = (e) => {
            const t = e.target && e.target.closest ? e.target.closest('[data-tab]') : null;
            if (t && t.getAttribute) {
              const tab = t.getAttribute('data-tab');
              if (tab) setTab(tab);
              close();
            }
          };
          window.addEventListener('click', () => close());
          window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
        })();

        function openCart() {
          const panel = document.getElementById('cartPanel');
          const ov = document.getElementById('cartOverlay');
          panel.classList.add('open');
          ov.classList.add('open');
        }
        function closeCart() {
          const panel = document.getElementById('cartPanel');
          const ov = document.getElementById('cartOverlay');
          panel.classList.remove('open');
          ov.classList.remove('open');
        }

        document.getElementById('btnCart').onclick = () => openCart();
        document.getElementById('btnCloseCart').onclick = () => closeCart();
        document.getElementById('cartOverlay').onclick = () => closeCart();
        window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCart(); });
        document.getElementById('btnClearCart').onclick = () => { state.cart = {}; saveCart(); renderCart(); };
        document.getElementById('btnCheckoutWhatsApp').onclick = () => {
          const msg = buildCheckoutMessage();
          const phone = activeBranchContactPhoneDigits();
          window.open(waUrl(msg, phone), '_blank', 'noopener,noreferrer');
        };
        document.getElementById('btnCheckoutTelegram').onclick = () => {
          const msg = buildCheckoutMessage();
          window.open(tgUrl(msg), '_blank', 'noopener,noreferrer');
        };
        document.getElementById('btnCopyCheckout').onclick = async () => {
          const msg = buildCheckoutMessage();
          try { await navigator.clipboard.writeText(msg); alert('Copied checkout message.'); }
          catch { prompt('Copy this message:', msg); }
        };

        render();
      })();
    </script>
  </body>
</html>`;
}

export function openCataloguePackageInNewWindow(html: string): void {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
}

export function downloadCataloguePackageHtml(filename: string, html: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

