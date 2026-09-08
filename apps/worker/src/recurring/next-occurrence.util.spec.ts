import { addMonthsClamped, computeNextOccurrence } from "./next-occurrence.util";

describe("addMonthsClamped", () => {
  it("clamps Jan 31 + 1 month to Feb 28 in a non-leap year", () => {
    const result = addMonthsClamped(new Date("2025-01-31T00:00:00.000Z"), 1);
    expect(result.toISOString()).toBe("2025-02-28T00:00:00.000Z");
  });

  it("clamps Jan 31 + 1 month to Feb 29 in a leap year", () => {
    const result = addMonthsClamped(new Date("2024-01-31T00:00:00.000Z"), 1);
    expect(result.toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });

  it("does not clamp when the target month has enough days", () => {
    const result = addMonthsClamped(new Date("2025-01-15T00:00:00.000Z"), 1);
    expect(result.toISOString()).toBe("2025-02-15T00:00:00.000Z");
  });

  it("rolls across a year boundary", () => {
    const result = addMonthsClamped(new Date("2025-12-15T00:00:00.000Z"), 1);
    expect(result.toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });

  it("preserves the time-of-day", () => {
    const result = addMonthsClamped(new Date("2025-01-15T09:30:00.000Z"), 1);
    expect(result.toISOString()).toBe("2025-02-15T09:30:00.000Z");
  });
});

describe("computeNextOccurrence", () => {
  const base = new Date("2025-01-01T00:00:00.000Z");

  it("advances by N days for DAILY", () => {
    expect(computeNextOccurrence(base, "DAILY", 3).toISOString()).toBe(
      "2025-01-04T00:00:00.000Z",
    );
  });

  it("advances by N weeks for WEEKLY", () => {
    expect(computeNextOccurrence(base, "WEEKLY", 2).toISOString()).toBe(
      "2025-01-15T00:00:00.000Z",
    );
  });

  it("advances by N months for MONTHLY, clamped", () => {
    const endOfJan = new Date("2025-01-31T00:00:00.000Z");
    expect(computeNextOccurrence(endOfJan, "MONTHLY", 1).toISOString()).toBe(
      "2025-02-28T00:00:00.000Z",
    );
  });

  it("advances by N years for YEARLY, clamped on a leap day", () => {
    const leapDay = new Date("2024-02-29T00:00:00.000Z");
    expect(computeNextOccurrence(leapDay, "YEARLY", 1).toISOString()).toBe(
      "2025-02-28T00:00:00.000Z",
    );
  });
});
