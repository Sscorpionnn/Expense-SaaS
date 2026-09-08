import { createAccountSchema, transactionInputSchema } from "./financial";

const base = {
  accountId: "clh3s9j8x0000qzrmn831i7ru",
  type: "EXPENSE" as const,
  amountMinor: "1000",
  currency: "USD",
  occurredAt: "2025-01-01T00:00:00.000Z",
};

describe("createAccountSchema", () => {
  it("defaults initialBalanceMinor to 0", () => {
    const result = createAccountSchema.parse({ name: "Checking", type: "BANK", currency: "USD" });
    expect(result.initialBalanceMinor).toBe("0");
  });

  it("allows a negative initial balance (e.g. existing credit card debt)", () => {
    const result = createAccountSchema.parse({
      name: "Card",
      type: "CREDIT_CARD",
      currency: "USD",
      initialBalanceMinor: "-5000",
    });
    expect(result.initialBalanceMinor).toBe("-5000");
  });
});

describe("transactionInputSchema", () => {
  it("requires categoryId for EXPENSE/INCOME", () => {
    const result = transactionInputSchema.safeParse({ ...base, categoryId: undefined });
    expect(result.success).toBe(false);
  });

  it("rejects a transferAccountId on a non-TRANSFER transaction", () => {
    const result = transactionInputSchema.safeParse({
      ...base,
      categoryId: "clh3s9j8x0000qzrmn831i7rv",
      transferAccountId: "clh3s9j8x0000qzrmn831i7rw",
    });
    expect(result.success).toBe(false);
  });

  it("requires transferAccountId for TRANSFER and rejects categoryId", () => {
    const missingDestination = transactionInputSchema.safeParse({
      ...base,
      type: "TRANSFER",
      categoryId: undefined,
    });
    expect(missingDestination.success).toBe(false);

    const withCategory = transactionInputSchema.safeParse({
      ...base,
      type: "TRANSFER",
      transferAccountId: "clh3s9j8x0000qzrmn831i7rw",
      categoryId: "clh3s9j8x0000qzrmn831i7rv",
    });
    expect(withCategory.success).toBe(false);
  });

  it("rejects transferring an account to itself", () => {
    const result = transactionInputSchema.safeParse({
      ...base,
      type: "TRANSFER",
      transferAccountId: base.accountId,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid TRANSFER", () => {
    const result = transactionInputSchema.safeParse({
      ...base,
      type: "TRANSFER",
      transferAccountId: "clh3s9j8x0000qzrmn831i7rw",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a zero or negative amount", () => {
    const result = transactionInputSchema.safeParse({
      ...base,
      categoryId: "clh3s9j8x0000qzrmn831i7rv",
      amountMinor: "0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unexpected extra fields", () => {
    const result = transactionInputSchema.safeParse({
      ...base,
      categoryId: "clh3s9j8x0000qzrmn831i7rv",
      userId: "attacker-supplied",
    });
    expect(result.success).toBe(false);
  });
});
