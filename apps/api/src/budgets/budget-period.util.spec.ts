import { computeCurrentPeriodBounds } from "./budget-period.util";

describe("computeCurrentPeriodBounds", () => {
  it("returns the exact fixed window for a CUSTOM budget", () => {
    const start = new Date("2025-01-10T00:00:00.000Z");
    const end = new Date("2025-02-10T00:00:00.000Z");
    const bounds = computeCurrentPeriodBounds({
      periodType: "CUSTOM",
      startDate: start,
      endDate: end,
    });
    expect(bounds).toEqual({ start, end });
  });

  it("returns the current calendar month for a MONTHLY budget", () => {
    const now = new Date("2025-06-15T12:00:00.000Z");
    const bounds = computeCurrentPeriodBounds(
      { periodType: "MONTHLY", startDate: new Date("2025-01-01T00:00:00.000Z"), endDate: null },
      now,
    );
    expect(bounds.start).toEqual(new Date("2025-06-01T00:00:00.000Z"));
    expect(bounds.end).toEqual(new Date("2025-07-01T00:00:00.000Z"));
  });

  it("never starts before the budget's own anchor date, even mid-month", () => {
    const now = new Date("2025-06-15T12:00:00.000Z");
    const anchor = new Date("2025-06-20T00:00:00.000Z"); // budget created later in the same month
    const bounds = computeCurrentPeriodBounds(
      { periodType: "MONTHLY", startDate: anchor, endDate: null },
      now,
    );
    expect(bounds.start).toEqual(anchor);
  });
});
