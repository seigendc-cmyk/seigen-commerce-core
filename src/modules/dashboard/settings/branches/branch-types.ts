export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const WEEKDAYS: { id: Weekday; label: string }[] = [
  { id: "mon", label: "Monday" },
  { id: "tue", label: "Tuesday" },
  { id: "wed", label: "Wednesday" },
  { id: "thu", label: "Thursday" },
  { id: "fri", label: "Friday" },
  { id: "sat", label: "Saturday" },
  { id: "sun", label: "Sunday" },
];

export type DayHours = {
  closed: boolean;
  open: string;
  close: string;
};

export type ShopBranch = {
  id: string;
  shopName: string;
  streetLine1: string;
  streetLine2: string;
  suburb: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactAlternatePhone: string;
  businessHours: Record<Weekday, DayHours>;
  /** Free-form: trading licence ref, landlord, POS id, etc. */
  otherNotes: string;
};

export function defaultDayHours(): DayHours {
  return { closed: false, open: "09:00", close: "17:00" };
}

export function defaultWeekHours(): Record<Weekday, DayHours> {
  return {
    mon: defaultDayHours(),
    tue: defaultDayHours(),
    wed: defaultDayHours(),
    thu: defaultDayHours(),
    fri: defaultDayHours(),
    sat: { closed: true, open: "09:00", close: "13:00" },
    sun: { closed: true, open: "09:00", close: "13:00" },
  };
}

export function emptyShopBranch(id: string): ShopBranch {
  return {
    id,
    shopName: "",
    streetLine1: "",
    streetLine2: "",
    suburb: "",
    city: "",
    region: "",
    postalCode: "",
    country: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    contactAlternatePhone: "",
    businessHours: defaultWeekHours(),
    otherNotes: "",
  };
}
