import { escapeCsvField, sanitizeCsvField, toCsvRow } from "./csv";

describe("sanitizeCsvField", () => {
  it.each(["=SUM(A1:A9)", "+1+1", "-1+1", "@SUM(1+1)", "\ttab", "\rcr"])(
    "prefixes a leading apostrophe for a formula-injection payload: %s",
    (payload) => {
      expect(sanitizeCsvField(payload)).toBe(`'${payload}`);
    },
  );

  it("leaves an ordinary value untouched", () => {
    expect(sanitizeCsvField("Grocery shopping")).toBe("Grocery shopping");
  });

  it("does not mangle a legitimate value that happens to start with a hyphen", () => {
    // Still sanitized, per OWASP guidance — a leading '-' is a real formula
    // trigger in Excel too. Documented here so the behavior isn't surprising.
    expect(sanitizeCsvField("-5% off coupon")).toBe("'-5% off coupon");
  });
});

describe("escapeCsvField", () => {
  it("wraps a value containing a comma in quotes", () => {
    expect(escapeCsvField("Smith, John")).toBe('"Smith, John"');
  });

  it("doubles internal quotes", () => {
    expect(escapeCsvField('Say "hi"')).toBe('"Say ""hi"""');
  });

  it("sanitizes formula injection before quoting", () => {
    expect(escapeCsvField("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
  });

  it("leaves a plain value unquoted", () => {
    expect(escapeCsvField("Groceries")).toBe("Groceries");
  });
});

describe("toCsvRow", () => {
  it("joins escaped fields with commas", () => {
    expect(toCsvRow(["2025-01-01", "Groceries", "12.50"])).toBe("2025-01-01,Groceries,12.50");
  });

  it("neutralizes formula injection in any column", () => {
    expect(toCsvRow(["2025-01-01", "=cmd|' /C calc'!A0", "12.50"])).toBe(
      "2025-01-01,'=cmd|' /C calc'!A0,12.50",
    );
  });
});
