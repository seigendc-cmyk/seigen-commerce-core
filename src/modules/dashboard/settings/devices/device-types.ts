export type DeviceKind =
  | "receipt_printer"
  | "label_printer"
  | "barcode_printer"
  | "cash_drawer"
  | "barcode_scanner"
  | "inventory_scanner"
  | "pole_display"
  | "payment_terminal"
  | "scale"
  | "other";

export type VendorDevice = {
  id: string;
  kind: DeviceKind;
  /** Friendly name shown in the app, e.g. "Front counter Epson". */
  displayName: string;
  /** Optional branch from Settings → Branches. */
  branchId: string;
  /** USB, Ethernet, Bluetooth, COM port, IP:host, etc. */
  connectionSummary: string;
  /** Till / register / station this device is paired with. */
  registerOrStation: string;
  enabled: boolean;
  notes: string;
};

export const DEVICE_KIND_OPTIONS: { id: DeviceKind; label: string; description: string }[] = [
  {
    id: "receipt_printer",
    label: "Receipt printer",
    description: "Thermal or impact printer for customer and kitchen tickets.",
  },
  {
    id: "label_printer",
    label: "Label printer",
    description: "Shelf, shipping, or product labels.",
  },
  {
    id: "barcode_printer",
    label: "Barcode printer",
    description: "Dedicated printer for barcode labels (often Zebra-style).",
  },
  {
    id: "cash_drawer",
    label: "Cash drawer",
    description: "Drawer triggered by printer kick or standalone interface.",
  },
  {
    id: "barcode_scanner",
    label: "Barcode scanner",
    description: "Handheld or presentation scanner at POS.",
  },
  {
    id: "inventory_scanner",
    label: "Inventory scanner",
    description: "Scanner used for receiving, counts, or stocktake workflows.",
  },
  {
    id: "pole_display",
    label: "Pole / customer display",
    description: "Line display facing the customer at checkout.",
  },
  {
    id: "payment_terminal",
    label: "Payment terminal",
    description: "Card PIN pad or integrated payment device.",
  },
  {
    id: "scale",
    label: "Scale",
    description: "Weighing scale integrated with POS or inventory.",
  },
  {
    id: "other",
    label: "Other",
    description: "Any peripheral not listed above.",
  },
];

const KIND_MAP = new Map(DEVICE_KIND_OPTIONS.map((o) => [o.id, o]));

export function labelForDeviceKind(kind: DeviceKind): string {
  return KIND_MAP.get(kind)?.label ?? kind;
}

export function emptyVendorDevice(id: string): VendorDevice {
  return {
    id,
    kind: "receipt_printer",
    displayName: "",
    branchId: "",
    connectionSummary: "",
    registerOrStation: "",
    enabled: true,
    notes: "",
  };
}
