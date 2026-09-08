import { getCurrencyDigits } from "@expense-saas/config";

/** Formats a minor-units amount string (see amountMinorSchema) as localized currency. */
export function formatCurrency(amountMinor: string, currency: string): string {
  const digits = getCurrencyDigits(currency);
  const value = Number(BigInt(amountMinor)) / 10 ** digits;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Converts a minor-units amount string to a plain display number (e.g. for charts). */
export function toDisplayNumber(amountMinor: string, currency: string): number {
  const digits = getCurrencyDigits(currency);
  return Number(BigInt(amountMinor)) / 10 ** digits;
}

/** Formats an already-converted display number (see toDisplayNumber) as localized currency. */
export function formatDisplayCurrency(value: number, currency: string): string {
  const digits = getCurrencyDigits(currency);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
