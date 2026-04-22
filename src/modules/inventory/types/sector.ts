export type ProductSectorId =
  | "motor_spares"
  | "motor_vehicle"
  | "property"
  | "clothing"
  | "pharmacy"
  | "grocery"
  | "hardware"
  | "confectionery"
  | "leisure_resort"
  | "hotel"
  | "electronics"
  | "agriculture"
  | "cosmetics"
  | "stationery"
  | "general_merchandise";

export type SectorFieldType = "text" | "number" | "select" | "boolean" | "date" | "textarea";

export type SectorFieldDefinition = {
  key: string;
  label: string;
  type: SectorFieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  helpText?: string;
  /** Use full width in the sector grid (e.g. long notes). */
  fullWidth?: boolean;
  rows?: number;
  /** For `number` inputs (e.g. `0.01` for money). */
  step?: string;
  min?: number;
};

export type SectorConfig = {
  id: ProductSectorId;
  label: string;
  fields: SectorFieldDefinition[];
};
