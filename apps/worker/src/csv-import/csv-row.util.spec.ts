import { parseImportRow } from "./csv-row.util";

const validRow = {
  date: "2025-01-15",
  type: "EXPENSE",
  amount: "42.50",
  category: "Groceries",
  description: "Weekly shop",
  merchant: "Big Grocer",
};

describe("parseImportRow", () => {
  it("parses a well-formed row", () => {
    const result = parseImportRow(validRow, "USD");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.row.amountMinor).toBe("4250");
      expect(result.row.type).toBe("EXPENSE");
      expect(result.row.categoryName).toBe("Groceries");
    }
  });

  it("is case-insensitive on headers", () => {
    const result = parseImportRow(
      { Date: "2025-01-15", Type: "income", Amount: "10.00", Category: "Salary" },
      "USD",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a missing date", () => {
    const result = parseImportRow({ ...validRow, date: "" }, "USD");
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid date", () => {
    const result = parseImportRow({ ...validRow, date: "not-a-date" }, "USD");
    expect(result.ok).toBe(false);
  });

  it("rejects a TRANSFER type (unsupported via CSV import)", () => {
    const result = parseImportRow({ ...validRow, type: "TRANSFER" }, "USD");
    expect(result.ok).toBe(false);
  });

  it("rejects a negative or non-numeric amount", () => {
    expect(parseImportRow({ ...validRow, amount: "-5.00" }, "USD").ok).toBe(false);
    expect(parseImportRow({ ...validRow, amount: "abc" }, "USD").ok).toBe(false);
  });

  it("rejects a zero amount", () => {
    expect(parseImportRow({ ...validRow, amount: "0" }, "USD").ok).toBe(false);
  });

  it("defaults category to 'Imported' when missing", () => {
    const { category: _category, ...withoutCategory } = validRow;
    const result = parseImportRow(withoutCategory, "USD");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.categoryName).toBe("Imported");
  });

  it("does not sanitize formula-injection-looking content — that only happens on export", () => {
    const result = parseImportRow({ ...validRow, description: "=SUM(A1:A9)" }, "USD");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.description).toBe("=SUM(A1:A9)");
  });
});
