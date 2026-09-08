import { formatMinorUnits, getCurrencyDigits, parseToMinorUnits } from "./currency";

describe("getCurrencyDigits", () => {
  it("defaults to 2 decimal places for common currencies", () => {
    expect(getCurrencyDigits("USD")).toBe(2);
    expect(getCurrencyDigits("EUR")).toBe(2);
  });

  it("returns 0 for zero-decimal currencies", () => {
    expect(getCurrencyDigits("JPY")).toBe(0);
    expect(getCurrencyDigits("KRW")).toBe(0);
  });

  it("returns 3 for three-decimal currencies", () => {
    expect(getCurrencyDigits("BHD")).toBe(3);
    expect(getCurrencyDigits("KWD")).toBe(3);
  });

  it("is case-insensitive", () => {
    expect(getCurrencyDigits("jpy")).toBe(0);
  });
});

describe("formatMinorUnits", () => {
  it("formats a 2-decimal currency correctly", () => {
    expect(formatMinorUnits(105099n, "USD")).toBe("1050.99");
  });

  it("formats a 0-decimal currency without a fractional part", () => {
    expect(formatMinorUnits(1500n, "JPY")).toBe("1500");
  });

  it("formats a 3-decimal currency correctly", () => {
    expect(formatMinorUnits(1500n, "BHD")).toBe("1.500");
  });

  it("handles negative amounts", () => {
    expect(formatMinorUnits(-500n, "USD")).toBe("-5.00");
  });

  it("pads small fractional amounts with leading zeros", () => {
    expect(formatMinorUnits(5n, "USD")).toBe("0.05");
  });
});

describe("parseToMinorUnits", () => {
  it("round-trips with formatMinorUnits for a 2-decimal currency", () => {
    expect(parseToMinorUnits("1050.99", "USD")).toBe("105099");
    expect(formatMinorUnits(105099n, "USD")).toBe("1050.99");
  });

  it("handles a 0-decimal currency", () => {
    expect(parseToMinorUnits("1500", "JPY")).toBe("1500");
  });

  it("handles a 3-decimal currency and pads a short fraction", () => {
    expect(parseToMinorUnits("1.5", "BHD")).toBe("1500");
  });

  it("handles negative amounts", () => {
    expect(parseToMinorUnits("-5.00", "USD")).toBe("-500");
  });

  it("truncates excess fractional precision rather than throwing", () => {
    expect(parseToMinorUnits("19.999", "USD")).toBe("1999");
  });

  it("throws on non-numeric input", () => {
    expect(() => parseToMinorUnits("not-a-number", "USD")).toThrow();
  });
});
