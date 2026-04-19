/**
 * Vendor Settings — flat tab list (?tab=… in the URL).
 */

export type VendorSettingsTabId =
  | "business-profile"
  | "staff"
  | "roles-permissions"
  | "branches"
  | "ideliver"
  | "currency"
  | "devices"
  | "banks"
  | "coa"
  | "report-writer"
  | "billing";

export type SettingsTabDef = {
  id: VendorSettingsTabId;
  label: string;
  hint?: string;
};

export const VENDOR_SETTINGS_TABS: SettingsTabDef[] = [
  { id: "business-profile", label: "Business Profile", hint: "Legal name, contacts, locale" },
  { id: "staff", label: "Staff", hint: "People and access" },
  { id: "roles-permissions", label: "Roles & permissions", hint: "Menus and access" },
  { id: "branches", label: "Branches", hint: "Stores and locations" },
  { id: "ideliver", label: "iDeliver", hint: "External verified drivers & compliance" },
  { id: "currency", label: "Currency", hint: "Base, reporting & transaction currencies" },
  { id: "devices", label: "Devices", hint: "Printers, scanners, drawers, displays" },
  { id: "banks", label: "Banks", hint: "Institutions & provider connections" },
  { id: "coa", label: "COA", hint: "Ledger, subaccounts & double-entry" },
  { id: "report-writer", label: "Report Writer", hint: "Templates, layouts & scheduled exports" },
  { id: "billing", label: "Billing", hint: "Plans, invoices, activation codes" },
];

const ALL_TAB_IDS: VendorSettingsTabId[] = VENDOR_SETTINGS_TABS.map((t) => t.id);

export const VENDOR_SETTINGS_TAB_IDS = new Set<string>(ALL_TAB_IDS);

export const VENDOR_SETTINGS_DEFAULT_TAB: VendorSettingsTabId = "business-profile";

export function normalizeVendorSettingsTab(raw: string | null): VendorSettingsTabId {
  if (raw && VENDOR_SETTINGS_TAB_IDS.has(raw)) {
    return raw as VendorSettingsTabId;
  }
  return VENDOR_SETTINGS_DEFAULT_TAB;
}

export type SettingsPanelCopy = {
  title: string;
  lead: string;
  pillars: string[];
};

export const VENDOR_SETTINGS_PANEL_COPY: Record<VendorSettingsTabId, SettingsPanelCopy> = {
  "business-profile": {
    title: "Business Profile",
    lead: "Your legal and trading details, contacts, and how dates and times appear in the system.",
    pillars: [
      "Use the form below to keep names and addresses consistent on receipts and tax documents.",
      "You can adjust locale and time zone as your operation grows.",
    ],
  },
  staff: {
    title: "Staff",
    lead: "Manage who can sign in, and assign people to branches or roles.",
    pillars: [
      "Add or remove users and reset access when someone leaves.",
      "Later: job titles, shifts, and tighter permissions per role.",
    ],
  },
  "roles-permissions": {
    title: "Roles & permissions",
    lead: "Create roles and choose which sidebar menus each role may use. Enforcement layers in after Supabase RLS.",
    pillars: [
      "Menu keys match the vendor dashboard navigation (Overview, Inventory, POS, Settings).",
      "Assign roles to staff in the directory when provisioning is connected.",
    ],
  },
  branches: {
    title: "Branches",
    lead: "Each branch is a place you sell or stock from—stores, warehouses, or counters.",
    pillars: [
      "Name branches, set addresses and hours, and link them to registers or stock.",
      "Reports can roll up by branch or across the whole business.",
    ],
  },
  ideliver: {
    title: "iDeliver",
    lead:
      "Record external service providers who may fulfil verified in-store delivery, with lawful identity and clearance documentation.",
    pillars: [
      "Legal basis for collecting provider photos, ID, licence, police clearance, and contact details.",
      "Product-level flags in catalog and storefront when external iDeliver may apply.",
    ],
  },
  currency: {
    title: "Currency",
    lead:
      "Choose your base book currency, reporting currency, and every currency you will accept in live transactions.",
    pillars: [
      "Base and reporting can match or differ (e.g. local ops vs group roll-up).",
      "Enable multiple ISO currencies so staff can switch between them at the till or on invoices.",
    ],
  },
  devices: {
    title: "Devices",
    lead:
      "Configure printers, cash drawers, scanners, pole displays, payment terminals, and other peripherals for POS and inventory.",
    pillars: [
      "Choose device type, display name, branch, and register or station.",
      "Record connection details so support can match hardware to the right till or back-office machine.",
    ],
  },
  banks: {
    title: "Banks",
    lead:
      "Create bank profiles and connect them to service providers—manual entry, open banking, aggregators, or card-settlement feeds.",
    pillars: [
      "Record institution, masked identifiers, and currency per account.",
      "Simulated connect flow stands in until live OAuth and secure vault storage are enabled.",
    ],
  },
  coa: {
    title: "Chart of accounts (COA)",
    lead:
      "Define account codes with up to three nested subaccount levels, aligned to double-entry rules and downstream modules.",
    pillars: [
      "Account classes with debit/credit normal balances for validated journals.",
      "Designed to integrate with cashbooks, COGS, banks, POS, and inventory postings.",
    ],
  },
  "report-writer": {
    title: "Report Writer",
    lead:
      "Management report templates plus your own saved layouts—columns, branch and date filters, recurring schedules, and exports.",
    pillars: [
      "Start from a template or a blank report; edit and save for repeat runs.",
      "Spreadsheet and PDF exports when the reporting engine is connected to your workspace.",
    ],
  },
  billing: {
    title: "Billing",
    lead: "Commercial plans, subscription invoices, optional feature charges, and activation codes tied to Supabase billing tables.",
    pillars: [
      "Plan prices are read from billing_plan_catalog; adjust amounts in the database.",
      "Invoices generate on signup and when you accept pending feature charges.",
      "Redeem an activation code to pay an invoice and activate paid add-on modules.",
    ],
  },
};
