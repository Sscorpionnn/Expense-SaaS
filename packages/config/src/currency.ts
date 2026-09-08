/**
 * ISO 4217 minor-unit digits per currency. Do not assume every currency has
 * 2 decimal places (e.g. JPY has 0, BHD has 3) — always look it up here.
 * Currencies not listed default to 2 (the ISO 4217 default) via `getCurrencyDigits`.
 */
export const CURRENCY_MINOR_UNIT_DIGITS: Readonly<Record<string, number>> = {
  // Zero-decimal currencies
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  UYI: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  // Three-decimal currencies
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
};

const DEFAULT_MINOR_UNIT_DIGITS = 2;

export function getCurrencyDigits(currencyCode: string): number {
  const code = currencyCode.toUpperCase();
  return CURRENCY_MINOR_UNIT_DIGITS[code] ?? DEFAULT_MINOR_UNIT_DIGITS;
}

/** Converts an integer minor-unit amount (e.g. cents) to a decimal string for display. */
export function formatMinorUnits(amountMinor: bigint, currencyCode: string): string {
  const digits = getCurrencyDigits(currencyCode);
  const negative = amountMinor < 0n;
  const abs = negative ? -amountMinor : amountMinor;
  const divisor = 10n ** BigInt(digits);
  const whole = abs / divisor;
  const fraction = (abs % divisor).toString().padStart(digits, "0");
  const sign = negative ? "-" : "";
  return digits > 0 ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

/**
 * Converts a user-entered decimal string (e.g. "19.99") to an integer
 * minor-unit string (e.g. "1999") for a given currency. Throws on input
 * that isn't a plain decimal number — validate/sanitize user input first.
 */
export function parseToMinorUnits(decimalInput: string, currencyCode: string): string {
  const trimmed = decimalInput.trim();
  // Sequential (not nested/overlapping) quantifiers over a single-char
  // class — linear-time, not susceptible to catastrophic backtracking.
  // eslint-disable-next-line security/detect-unsafe-regex
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid decimal amount: ${decimalInput}`);
  }
  const digits = getCurrencyDigits(currencyCode);
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [wholePart, fractionPart = ""] = unsigned.split(".");
  const paddedFraction = fractionPart.padEnd(digits, "0").slice(0, digits);
  const minor = BigInt(wholePart + paddedFraction || "0");
  return (negative ? -minor : minor).toString();
}
