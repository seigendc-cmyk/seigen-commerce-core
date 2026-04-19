/**
 * External service providers enlisted for iDeliver — instore-verified delivery logistics
 * (not employees on payroll; separate legal relationship).
 */

/** One radius band: delivery at or below `maxRadiusKm` uses `fee` (tiered lookup). */
export type IdeliverFareBand = {
  id: string;
  /** Inclusive upper bound in kilometres from branch / store (or service centroid). */
  maxRadiusKm: number;
  /** Flat fare for this band (same currency as POS / settings). */
  fee: number;
};

export type IdeliverExternalProvider = {
  id: string;
  fullName: string;
  nationalIdNumber: string;
  phone: string;
  email: string;
  address: string;
  driversLicenseNumber: string;
  /** Profile / ID photo — WebP data URL from client optimization. */
  photoWebp: string | null;
  /** Police clearance or equivalent — WebP scan. */
  policeClearanceWebp: string | null;
  additionalNotes: string;
  /**
   * Fare tiers by radius. Bands should be sorted ascending by maxRadiusKm.
   * POS picks the first band where distanceKm ≤ maxRadiusKm; if none match, the last band applies.
   */
  fareBands: IdeliverFareBand[];
  /** Commercial terms: min order, surcharges, blackout times, vehicle type, etc. */
  businessConditions: string;
};

export function defaultFareBands(): IdeliverFareBand[] {
  return [
    { id: "fb_default_0", maxRadiusKm: 3, fee: 4 },
    { id: "fb_default_1", maxRadiusKm: 8, fee: 8 },
    { id: "fb_default_2", maxRadiusKm: 15, fee: 14 },
  ];
}

export function emptyIdeliverProvider(id: string): IdeliverExternalProvider {
  return {
    id,
    fullName: "",
    nationalIdNumber: "",
    phone: "",
    email: "",
    address: "",
    driversLicenseNumber: "",
    photoWebp: null,
    policeClearanceWebp: null,
    additionalNotes: "",
    fareBands: defaultFareBands(),
    businessConditions: "",
  };
}
