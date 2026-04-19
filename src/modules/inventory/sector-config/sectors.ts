import type { SectorConfig } from "../types/sector";

/**
 * Canonical sector definitions (mirrored in Supabase `product_sectors.field_definitions`).
 * Prefer {@link import("./sector-registry").listSectorDefinitions} for app-wide reads.
 */
export const SECTORS: SectorConfig[] = [
  {
    id: "motor_spares",
    label: "Motor spares",
    fields: [
      { key: "vehicleMake", label: "Vehicle make", type: "text", placeholder: "e.g. Toyota" },
      { key: "vehicleModel", label: "Vehicle model", type: "text", placeholder: "e.g. Hilux" },
      { key: "partNumber", label: "Part number", type: "text", required: true },
      { key: "compatibilityNotes", label: "Compatibility notes", type: "text" },
    ],
  },
  {
    id: "clothing",
    label: "Clothing",
    fields: [
      { key: "size", label: "Size", type: "select", options: [{ value: "XS", label: "XS" }, { value: "S", label: "S" }, { value: "M", label: "M" }, { value: "L", label: "L" }, { value: "XL", label: "XL" }, { value: "XXL", label: "XXL" }] },
      { key: "color", label: "Color", type: "text" },
      { key: "material", label: "Material", type: "text" },
      { key: "gender", label: "Gender", type: "select", options: [{ value: "unisex", label: "Unisex" }, { value: "mens", label: "Men's" }, { value: "womens", label: "Women's" }, { value: "kids", label: "Kids" }] },
    ],
  },
  {
    id: "pharmacy",
    label: "Pharmacy",
    fields: [
      { key: "dosageForm", label: "Dosage form", type: "select", options: [{ value: "tablet", label: "Tablet" }, { value: "capsule", label: "Capsule" }, { value: "syrup", label: "Syrup" }, { value: "ointment", label: "Ointment" }, { value: "injection", label: "Injection" }, { value: "other", label: "Other" }] },
      { key: "strength", label: "Strength", type: "text", placeholder: "e.g. 500mg" },
      { key: "requiresPrescription", label: "Requires prescription", type: "boolean" },
      { key: "activeIngredient", label: "Active ingredient", type: "text" },
    ],
  },
  {
    id: "grocery",
    label: "Grocery",
    fields: [
      { key: "expiryDays", label: "Expiry (days)", type: "number", placeholder: "e.g. 30" },
      { key: "perishable", label: "Perishable", type: "boolean" },
      { key: "originCountry", label: "Origin country", type: "text" },
    ],
  },
  {
    id: "hardware",
    label: "Hardware",
    fields: [
      { key: "spec", label: "Specification", type: "text", placeholder: "e.g. 10mm, galvanized" },
      { key: "warrantyMonths", label: "Warranty (months)", type: "number" },
      { key: "powerRating", label: "Power rating", type: "text", placeholder: "e.g. 500W" },
    ],
  },
  {
    id: "electronics",
    label: "Electronics",
    fields: [
      { key: "modelNumber", label: "Model number", type: "text" },
      { key: "warrantyMonths", label: "Warranty (months)", type: "number" },
      { key: "voltage", label: "Voltage", type: "text", placeholder: "e.g. 220V" },
    ],
  },
  {
    id: "agriculture",
    label: "Agriculture",
    fields: [
      {
        key: "agriProductType",
        label: "Product type",
        type: "select",
        required: true,
        helpText: "Livestock, grains, or horticulture — drives how buyers filter this listing.",
        options: [
          { value: "livestock", label: "Livestock" },
          { value: "grains", label: "Grains" },
          { value: "horticulture", label: "Horticulture" },
        ],
      },
      {
        key: "cropOrProduct",
        label: "Crop / product name",
        type: "text",
        required: true,
        placeholder: "e.g. Maize, beef weaners, baby marrows",
        helpText: "Searchable name for this line (what you are selling).",
      },
      {
        key: "varietyOrBreed",
        label: "Variety or breed",
        type: "text",
        placeholder: "e.g. PAN 14, Angus, Roma tomato",
      },
      {
        key: "harvestDate",
        label: "Harvest / ready date",
        type: "date",
        helpText: "Expected harvest, slaughter-ready, or pack date for fresh produce.",
      },
      {
        key: "packaging",
        label: "Packaging",
        type: "select",
        options: [
          { value: "bulk", label: "Bulk" },
          { value: "bags", label: "Bags" },
          { value: "crates", label: "Crates" },
          { value: "punnets", label: "Punnets" },
          { value: "bales", label: "Bales" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "packagingDetail",
        label: "Packaging detail",
        type: "text",
        placeholder: "e.g. 25kg bags, 4×4 kg punnets",
      },
      {
        key: "season",
        label: "Season",
        type: "select",
        options: [
          { value: "all", label: "All-year" },
          { value: "rainy", label: "Rainy" },
          { value: "dry", label: "Dry" },
        ],
      },
      {
        key: "pricePerUnitOffer",
        label: "Offer price per unit",
        type: "number",
        placeholder: "e.g. 12.50",
        step: "0.01",
        min: 0,
        helpText: "Asking price for this listing (sale lead). Main catalog price above should match or reflect your floor.",
      },
      {
        key: "unitForOffer",
        label: "Unit for offer",
        type: "select",
        options: [
          { value: "kg", label: "kg" },
          { value: "ton", label: "ton" },
          { value: "bag", label: "bag" },
          { value: "crate", label: "crate" },
          { value: "head", label: "head" },
          { value: "dozen", label: "dozen" },
          { value: "each", label: "each" },
        ],
      },
      {
        key: "organicCertified",
        label: "Certified organic",
        type: "boolean",
      },
      {
        key: "saleLeadNotes",
        label: "Sale lead details",
        type: "textarea",
        fullWidth: true,
        rows: 5,
        placeholder:
          "MOQ, delivery radius, cold chain, grading, certifications, payment terms — anything that turns a browser into a buyer.",
        helpText: "Shown in search text and helps staff qualify leads.",
      },
    ],
  },
  {
    id: "cosmetics",
    label: "Cosmetics",
    fields: [
      { key: "skinType", label: "Skin type", type: "select", options: [{ value: "all", label: "All" }, { value: "oily", label: "Oily" }, { value: "dry", label: "Dry" }, { value: "sensitive", label: "Sensitive" }] },
      { key: "shade", label: "Shade", type: "text" },
      { key: "fragranceFree", label: "Fragrance-free", type: "boolean" },
    ],
  },
  {
    id: "stationery",
    label: "Stationery",
    fields: [
      { key: "paperSize", label: "Paper size", type: "select", options: [{ value: "A4", label: "A4" }, { value: "A5", label: "A5" }, { value: "A3", label: "A3" }, { value: "letter", label: "Letter" }] },
      { key: "pages", label: "Pages", type: "number" },
      { key: "binding", label: "Binding", type: "select", options: [{ value: "spiral", label: "Spiral" }, { value: "glued", label: "Glued" }, { value: "stitched", label: "Stitched" }, { value: "none", label: "None" }] },
    ],
  },
  {
    id: "general_merchandise",
    label: "General merchandise",
    fields: [{ key: "notes", label: "Sector notes", type: "text", placeholder: "Any extra details" }],
  },
];

export function getSectorConfig(sectorId: string) {
  return SECTORS.find((s) => s.id === sectorId);
}
