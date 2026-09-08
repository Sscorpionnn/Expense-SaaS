import { CSV_FORMULA_TRIGGER_CHARS } from "./constants";

/**
 * Neutralizes a value that would otherwise be interpreted as a spreadsheet
 * formula by Excel/Sheets/LibreOffice when a generated CSV is opened
 * (CSV/"Excel" formula injection, OWASP). Only applied when WRITING a CSV
 * export — never when storing or displaying the value inside the app
 * itself, since that would permanently corrupt legitimate data (e.g. a
 * description that happens to start with "-5% off").
 */
export function sanitizeCsvField(value: string): string {
  if (CSV_FORMULA_TRIGGER_CHARS.some((char) => value.startsWith(char))) {
    return `'${value}`;
  }
  return value;
}

/** Escapes a single field for inclusion in a CSV row per RFC 4180. */
export function escapeCsvField(value: string): string {
  const sanitized = sanitizeCsvField(value);
  if (/[",\n\r]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

export function toCsvRow(fields: readonly string[]): string {
  return fields.map(escapeCsvField).join(",");
}
