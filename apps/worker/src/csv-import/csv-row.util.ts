import { CSV_IMPORT, parseToMinorUnits } from "@expense-saas/config";

export interface ParsedImportRow {
  occurredAt: Date;
  type: "INCOME" | "EXPENSE";
  amountMinor: string;
  categoryName: string;
  description: string | null;
  merchant: string | null;
}

export type RowResult = { ok: true; row: ParsedImportRow } | { ok: false; error: string };

// Sequential (not nested/overlapping) quantifiers over a single-char class —
// linear-time, not susceptible to catastrophic backtracking.
// eslint-disable-next-line security/detect-unsafe-regex
const AMOUNT_PATTERN = /^\d+(\.\d+)?$/;

function truncate(value: string): string {
  return value.length > CSV_IMPORT.MAX_CELL_LENGTH
    ? value.slice(0, CSV_IMPORT.MAX_CELL_LENGTH)
    : value;
}

/** Case/whitespace-insensitive lookup — real-world CSV exports vary in header casing. */
function get(record: Record<string, string>, ...names: string[]): string | undefined {
  const normalized = new Map(
    Object.entries(record).map(([key, value]) => [key.trim().toLowerCase(), value]),
  );
  for (const name of names) {
    const value = normalized.get(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

/**
 * Validates and normalizes a single raw CSV record. Pure — no I/O — so
 * category resolution and duplicate detection (which need the database)
 * happen separately in the processor.
 */
export function parseImportRow(
  record: Record<string, string>,
  currency: string,
): RowResult {
  const dateRaw = get(record, "date", "occurredat", "transaction date");
  const typeRaw = get(record, "type")?.toUpperCase();
  const amountRaw = get(record, "amount");
  const categoryName = get(record, "category") ?? "Imported";
  const description = get(record, "description", "memo", "notes");
  const merchant = get(record, "merchant", "payee");

  if (!dateRaw) return { ok: false, error: "Missing date" };
  const occurredAt = new Date(dateRaw);
  if (Number.isNaN(occurredAt.getTime())) return { ok: false, error: `Invalid date: ${dateRaw}` };

  if (typeRaw !== "INCOME" && typeRaw !== "EXPENSE") {
    return { ok: false, error: `Type must be INCOME or EXPENSE, got: ${typeRaw ?? "(missing)"}` };
  }

  if (!amountRaw || !AMOUNT_PATTERN.test(amountRaw)) {
    return { ok: false, error: `Invalid amount: ${amountRaw ?? "(missing)"}` };
  }

  let amountMinor: string;
  try {
    amountMinor = parseToMinorUnits(amountRaw, currency);
  } catch {
    return { ok: false, error: `Could not parse amount: ${amountRaw}` };
  }
  if (BigInt(amountMinor) <= 0n) {
    return { ok: false, error: "Amount must be greater than zero" };
  }

  return {
    ok: true,
    row: {
      occurredAt,
      type: typeRaw,
      amountMinor,
      categoryName: truncate(categoryName),
      description: description ? truncate(description) : null,
      merchant: merchant ? truncate(merchant) : null,
    },
  };
}
