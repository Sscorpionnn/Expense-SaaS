import { createBudgetSchema, recurringInputSchema } from "./planning";

const baseBudget = {
  name: "Groceries",
  amountMinor: "50000",
  currency: "USD",
  startDate: "2025-01-01T00:00:00.000Z",
};

describe("createBudgetSchema", () => {
  it("requires endDate for a CUSTOM period", () => {
    const result = createBudgetSchema.safeParse({ ...baseBudget, periodType: "CUSTOM" });
    expect(result.success).toBe(false);
  });

  it("rejects an endDate before startDate", () => {
    const result = createBudgetSchema.safeParse({
      ...baseBudget,
      periodType: "CUSTOM",
      endDate: "2024-12-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid CUSTOM period", () => {
    const result = createBudgetSchema.safeParse({
      ...baseBudget,
      periodType: "CUSTOM",
      endDate: "2025-02-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an endDate on a MONTHLY budget", () => {
    const result = createBudgetSchema.safeParse({
      ...baseBudget,
      periodType: "MONTHLY",
      endDate: "2025-02-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a MONTHLY budget without an endDate", () => {
    const result = createBudgetSchema.safeParse({ ...baseBudget, periodType: "MONTHLY" });
    expect(result.success).toBe(true);
  });
});

describe("recurringInputSchema", () => {
  const base = {
    accountId: "clh3s9j8x0000qzrmn831i7ru",
    categoryId: "clh3s9j8x0000qzrmn831i7rv",
    type: "EXPENSE" as const,
    amountMinor: "1500",
    currency: "USD",
    frequency: "MONTHLY" as const,
    startDate: "2025-01-01T00:00:00.000Z",
  };

  it("defaults interval to 1 and isActive to true", () => {
    const result = recurringInputSchema.parse(base);
    expect(result.interval).toBe(1);
    expect(result.isActive).toBe(true);
  });

  it("rejects an endDate before startDate", () => {
    const result = recurringInputSchema.safeParse({
      ...base,
      endDate: "2024-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a TRANSFER type", () => {
    const result = recurringInputSchema.safeParse({ ...base, type: "TRANSFER" });
    expect(result.success).toBe(false);
  });
});
