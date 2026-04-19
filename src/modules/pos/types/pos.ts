import type { Id } from "@/modules/inventory/types/models";

export type PaymentMethod = "cash" | "mobile_money" | "bank" | "other";

export type Payment = {
  method: PaymentMethod;
  amount: number;
};

export type CartItem = {
  productId: Id;
  sku: string;
  name: string;
  unit: string;
  /** Unit selling price (from ProductReadModel.sellingPrice at add time). */
  unitPrice: number;
  qty: number;
  lineTotal: number;
};

export type CartDelivery = {
  enabled: boolean;
  providerId: string | null;
  /** Distance from store / branch used for radius fare lookup (km). */
  distanceKm: number;
  overrideEnabled: boolean;
  /** When override is on, this amount replaces computed fare. */
  overrideAmount: number;
};

export type Cart = {
  items: CartItem[];
  /** Sum of product line totals (goods). */
  subtotal: number;
  delivery: CartDelivery;
};

export type SaleLine = {
  productId: Id;
  sku: string;
  name: string;
  unit: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
};

export type IdeliverFareSource = "none" | "computed" | "override";

/** Phase 2: `completed` on tender; `voided` reserved for future void flows. */
export type SaleStatus = "completed" | "voided";

export type Sale = {
  id: Id;
  /** Human-readable receipt id for operators (e.g. REC-20260414-00001). */
  receiptNumber: string;
  status: SaleStatus;
  createdAt: string;
  branchId: Id;
  lines: SaleLine[];
  /** Goods subtotal (sum of lines). */
  subtotal: number;
  /** iDeliver / delivery fee; 0 if walk-out. */
  deliveryFee: number;
  /** subtotal + deliveryFee — amount that must be covered by tender. */
  amountDue: number;
  /** External provider credited for delivery component (ledger / iDeliver tab). */
  ideliverProviderId: string | null;
  ideliverProviderName: string | null;
  ideliverFareSource: IdeliverFareSource;
  payments: Payment[];
  totalPaid: number;
  /** Cash-style change; 0 if exact or non-cash emphasis. */
  changeDue: number;
};
