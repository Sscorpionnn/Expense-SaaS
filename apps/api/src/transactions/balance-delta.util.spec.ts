import { computeBalanceDeltas, mergeBalanceDeltas, negateBalanceDelta } from "./balance-delta.util";

describe("computeBalanceDeltas", () => {
  it("credits the account for INCOME", () => {
    const delta = computeBalanceDeltas("INCOME", 1000n, "acc-1", null);
    expect(delta.get("acc-1")).toBe(1000n);
  });

  it("debits the account for EXPENSE", () => {
    const delta = computeBalanceDeltas("EXPENSE", 1000n, "acc-1", null);
    expect(delta.get("acc-1")).toBe(-1000n);
  });

  it("debits the source and credits the destination for TRANSFER", () => {
    const delta = computeBalanceDeltas("TRANSFER", 500n, "acc-1", "acc-2");
    expect(delta.get("acc-1")).toBe(-500n);
    expect(delta.get("acc-2")).toBe(500n);
  });

  it("throws for TRANSFER without a destination account", () => {
    expect(() => computeBalanceDeltas("TRANSFER", 500n, "acc-1", null)).toThrow();
  });
});

describe("negateBalanceDelta", () => {
  it("flips the sign of every entry", () => {
    const delta = computeBalanceDeltas("TRANSFER", 500n, "acc-1", "acc-2");
    const negated = negateBalanceDelta(delta);
    expect(negated.get("acc-1")).toBe(500n);
    expect(negated.get("acc-2")).toBe(-500n);
  });
});

describe("mergeBalanceDeltas", () => {
  it("sums deltas for the same account across multiple deltas", () => {
    const a = computeBalanceDeltas("INCOME", 1000n, "acc-1", null);
    const b = computeBalanceDeltas("EXPENSE", 300n, "acc-1", null);
    const merged = mergeBalanceDeltas(a, b);
    expect(merged.get("acc-1")).toBe(700n);
  });

  it("correctly nets an edit that reassigns a transaction to a different account", () => {
    // Editing a $10 EXPENSE from acc-1 to acc-2: reverse the old effect,
    // apply the new one.
    const oldDelta = computeBalanceDeltas("EXPENSE", 1000n, "acc-1", null);
    const newDelta = computeBalanceDeltas("EXPENSE", 1000n, "acc-2", null);
    const net = mergeBalanceDeltas(negateBalanceDelta(oldDelta), newDelta);
    expect(net.get("acc-1")).toBe(1000n); // reversed
    expect(net.get("acc-2")).toBe(-1000n); // newly applied
  });
});
