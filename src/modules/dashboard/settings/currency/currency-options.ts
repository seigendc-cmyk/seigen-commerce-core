/**
 * ISO 4217 codes commonly used for retail and reporting. Extend as needed.
 */
export const TRANSACTION_CURRENCY_OPTIONS: { code: string; label: string }[] = [
  { code: "AED", label: "UAE dirham" },
  { code: "AUD", label: "Australian dollar" },
  { code: "BHD", label: "Bahraini dinar" },
  { code: "BRL", label: "Brazilian real" },
  { code: "CAD", label: "Canadian dollar" },
  { code: "CHF", label: "Swiss franc" },
  { code: "CNY", label: "Chinese yuan" },
  { code: "DKK", label: "Danish krone" },
  { code: "EGP", label: "Egyptian pound" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "Pound sterling" },
  { code: "HKD", label: "Hong Kong dollar" },
  { code: "HUF", label: "Hungarian forint" },
  { code: "IDR", label: "Indonesian rupiah" },
  { code: "ILS", label: "Israeli shekel" },
  { code: "INR", label: "Indian rupee" },
  { code: "JPY", label: "Japanese yen" },
  { code: "KES", label: "Kenyan shilling" },
  { code: "KRW", label: "South Korean won" },
  { code: "MXN", label: "Mexican peso" },
  { code: "MYR", label: "Malaysian ringgit" },
  { code: "NGN", label: "Nigerian naira" },
  { code: "NOK", label: "Norwegian krone" },
  { code: "NZD", label: "New Zealand dollar" },
  { code: "PHP", label: "Philippine peso" },
  { code: "PKR", label: "Pakistani rupee" },
  { code: "PLN", label: "Polish złoty" },
  { code: "QAR", label: "Qatari riyal" },
  { code: "RON", label: "Romanian leu" },
  { code: "SAR", label: "Saudi riyal" },
  { code: "SEK", label: "Swedish krona" },
  { code: "SGD", label: "Singapore dollar" },
  { code: "THB", label: "Thai baht" },
  { code: "TRY", label: "Turkish lira" },
  { code: "TWD", label: "New Taiwan dollar" },
  { code: "TZS", label: "Tanzanian shilling" },
  { code: "USD", label: "US dollar" },
  { code: "ZAR", label: "South African rand" },
].sort((a, b) => a.code.localeCompare(b.code));

const CODE_SET = new Set(TRANSACTION_CURRENCY_OPTIONS.map((c) => c.code));

export function isKnownCurrencyCode(code: string): boolean {
  return CODE_SET.has(code);
}

export function labelForCurrencyCode(code: string): string {
  return TRANSACTION_CURRENCY_OPTIONS.find((c) => c.code === code)?.label ?? code;
}
