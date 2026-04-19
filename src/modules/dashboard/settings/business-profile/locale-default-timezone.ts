/**
 * Maps BCP 47 locale regions to a primary IANA time zone for business defaults.
 * Used when "Default locale" changes so "Default time zone" stays aligned (user can still override).
 */

/** One canonical zone per ISO 3166-1 alpha-2 country / territory in our locale list. */
const PRIMARY_IANA_BY_ISO2: Record<string, string> = {
  AE: "Asia/Dubai",
  AF: "Asia/Kabul",
  AG: "America/Antigua",
  AI: "America/Anguilla",
  AL: "Europe/Tirane",
  AO: "Africa/Luanda",
  AR: "America/Argentina/Buenos_Aires",
  AS: "Pacific/Pago_Pago",
  AT: "Europe/Vienna",
  AU: "Australia/Sydney",
  BA: "Europe/Sarajevo",
  BB: "America/Barbados",
  BD: "Asia/Dhaka",
  BE: "Europe/Brussels",
  BF: "Africa/Ouagadougou",
  BG: "Europe/Sofia",
  BH: "Asia/Bahrain",
  BI: "Africa/Bujumbura",
  BJ: "Africa/Porto-Novo",
  BN: "Asia/Brunei",
  BO: "America/La_Paz",
  BR: "America/Sao_Paulo",
  BS: "America/Nassau",
  BT: "Asia/Thimphu",
  BW: "Africa/Gaborone",
  BY: "Europe/Minsk",
  BZ: "America/Belize",
  CA: "America/Toronto",
  CD: "Africa/Kinshasa",
  CF: "Africa/Bangui",
  CG: "Africa/Brazzaville",
  CH: "Europe/Zurich",
  CI: "Africa/Abidjan",
  CL: "America/Santiago",
  CM: "Africa/Douala",
  CN: "Asia/Shanghai",
  CO: "America/Bogota",
  CR: "America/Costa_Rica",
  CU: "America/Havana",
  CV: "Atlantic/Cape_Verde",
  CY: "Asia/Nicosia",
  CZ: "Europe/Prague",
  DE: "Europe/Berlin",
  DJ: "Africa/Djibouti",
  DK: "Europe/Copenhagen",
  DO: "America/Santo_Domingo",
  DZ: "Africa/Algiers",
  EC: "America/Guayaquil",
  EE: "Europe/Tallinn",
  EG: "Africa/Cairo",
  ER: "Africa/Asmara",
  ES: "Europe/Madrid",
  ET: "Africa/Addis_Ababa",
  FI: "Europe/Helsinki",
  FJ: "Pacific/Fiji",
  FR: "Europe/Paris",
  GA: "Africa/Libreville",
  GB: "Europe/London",
  GF: "America/Cayenne",
  GH: "Africa/Accra",
  GM: "Africa/Banjul",
  GN: "Africa/Conakry",
  GQ: "Africa/Malabo",
  GR: "Europe/Athens",
  GT: "America/Guatemala",
  GU: "Pacific/Guam",
  GW: "Africa/Bissau",
  GY: "America/Guyana",
  HK: "Asia/Hong_Kong",
  HN: "America/Tegucigalpa",
  HR: "Europe/Zagreb",
  HU: "Europe/Budapest",
  ID: "Asia/Jakarta",
  IE: "Europe/Dublin",
  IL: "Asia/Jerusalem",
  IN: "Asia/Kolkata",
  IQ: "Asia/Baghdad",
  IR: "Asia/Tehran",
  IS: "Atlantic/Reykjavik",
  IT: "Europe/Rome",
  JM: "America/Jamaica",
  JO: "Asia/Amman",
  JP: "Asia/Tokyo",
  KE: "Africa/Nairobi",
  KG: "Asia/Bishkek",
  KH: "Asia/Phnom_Penh",
  KM: "Indian/Comoro",
  KR: "Asia/Seoul",
  KW: "Asia/Kuwait",
  KZ: "Asia/Almaty",
  LA: "Asia/Vientiane",
  LB: "Asia/Beirut",
  LK: "Asia/Colombo",
  LR: "Africa/Monrovia",
  LS: "Africa/Maseru",
  LT: "Europe/Vilnius",
  LU: "Europe/Luxembourg",
  LV: "Europe/Riga",
  LY: "Africa/Tripoli",
  MA: "Africa/Casablanca",
  MD: "Europe/Chisinau",
  ME: "Europe/Podgorica",
  MG: "Indian/Antananarivo",
  MK: "Europe/Skopje",
  ML: "Africa/Bamako",
  MM: "Asia/Yangon",
  MN: "Asia/Ulaanbaatar",
  MP: "Pacific/Saipan",
  MR: "Africa/Nouakchott",
  MT: "Europe/Malta",
  MU: "Indian/Mauritius",
  MW: "Africa/Blantyre",
  MX: "America/Mexico_City",
  MY: "Asia/Kuala_Lumpur",
  MZ: "Africa/Maputo",
  NA: "Africa/Windhoek",
  NC: "Pacific/Noumea",
  NE: "Africa/Niamey",
  NG: "Africa/Lagos",
  NI: "America/Managua",
  NL: "Europe/Amsterdam",
  NO: "Europe/Oslo",
  NP: "Asia/Kathmandu",
  NZ: "Pacific/Auckland",
  OM: "Asia/Muscat",
  PA: "America/Panama",
  PE: "America/Lima",
  PF: "Pacific/Tahiti",
  PG: "Pacific/Port_Moresby",
  PH: "Asia/Manila",
  PK: "Asia/Karachi",
  PL: "Europe/Warsaw",
  PR: "America/Puerto_Rico",
  PT: "Europe/Lisbon",
  PY: "America/Asuncion",
  QA: "Asia/Qatar",
  RO: "Europe/Bucharest",
  RS: "Europe/Belgrade",
  RU: "Europe/Moscow",
  RW: "Africa/Kigali",
  SA: "Asia/Riyadh",
  SB: "Pacific/Guadalcanal",
  SC: "Indian/Mahe",
  SD: "Africa/Khartoum",
  SE: "Europe/Stockholm",
  SG: "Asia/Singapore",
  SI: "Europe/Ljubljana",
  SK: "Europe/Bratislava",
  SL: "Africa/Freetown",
  SN: "Africa/Dakar",
  SO: "Africa/Mogadishu",
  SR: "America/Paramaribo",
  SS: "Africa/Juba",
  ST: "Africa/Sao_Tome",
  SV: "America/El_Salvador",
  SY: "Asia/Damascus",
  SZ: "Africa/Mbabane",
  TD: "Africa/Ndjamena",
  TG: "Africa/Lome",
  TH: "Asia/Bangkok",
  TJ: "Asia/Dushanbe",
  TM: "Asia/Ashgabat",
  TN: "Africa/Tunis",
  TO: "Pacific/Tongatapu",
  TR: "Europe/Istanbul",
  TT: "America/Port_of_Spain",
  TW: "Asia/Taipei",
  TZ: "Africa/Dar_es_Salaam",
  UA: "Europe/Kyiv",
  UG: "Africa/Kampala",
  US: "America/New_York",
  UY: "America/Montevideo",
  UZ: "Asia/Tashkent",
  VA: "Europe/Vatican",
  VE: "America/Caracas",
  VN: "Asia/Ho_Chi_Minh",
  VU: "Pacific/Efate",
  YE: "Asia/Aden",
  ZA: "Africa/Johannesburg",
  ZM: "Africa/Lusaka",
  ZW: "Africa/Harare",
};

const FALLBACK_TIME_ZONE_IDS = [
  "UTC",
  "Africa/Johannesburg",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/Berlin",
  "Europe/London",
  "Europe/Paris",
  "Pacific/Auckland",
];

export function listSortedTimeZoneIds(): string[] {
  try {
    const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] })
      .supportedValuesOf;
    if (typeof supportedValuesOf === "function") {
      return [...supportedValuesOf("timeZone")].sort((a, b) => a.localeCompare(b));
    }
  } catch {
    /* ignore */
  }
  return [...FALLBACK_TIME_ZONE_IDS];
}

/** ISO region from a BCP 47 tag (`en-ZA` → ZA, `zh-Hans-CN` → CN). */
export function getRegionFromLocaleTag(localeTag: string): string | undefined {
  const t = localeTag.trim();
  if (t === "en-001") return "001";
  if (t === "en-150") return "150";
  try {
    const loc = new Intl.Locale(t);
    if (loc.region) return loc.region;
  } catch {
    /* ignore */
  }
  const parts = t.split(/[-_]/);
  const last = parts[parts.length - 1] ?? "";
  if (/^[A-Z]{2}$/i.test(last)) return last.toUpperCase();
  return undefined;
}

/**
 * Suggested IANA zone for a default locale. International entries use neutral EU or UTC.
 */
export function getDefaultTimeZoneForLocale(localeTag: string): string {
  const region = getRegionFromLocaleTag(localeTag);
  if (region === "001") return "UTC";
  if (region === "150") return "Europe/Paris";
  if (!region) return "UTC";
  return PRIMARY_IANA_BY_ISO2[region] ?? "UTC";
}
