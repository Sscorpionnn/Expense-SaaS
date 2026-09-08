import type { TransactionType } from "@expense-saas/database";

/** accountId -> signed balance change in minor units. */
export type BalanceDelta = Map<string, bigint>;

function addDelta(delta: BalanceDelta, accountId: string, amount: bigint): void {
  delta.set(accountId, (delta.get(accountId) ?? 0n) + amount);
}

/**
 * `amountMinor` is always stored as a positive integer — direction comes
 * from `type`, never from the sign — so this is the single place that
 * translates a transaction into signed per-account balance changes.
 */
export function computeBalanceDeltas(
  type: TransactionType,
  amountMinor: bigint,
  accountId: string,
  transferAccountId: string | null,
): BalanceDelta {
  const delta: BalanceDelta = new Map();
  if (type === "INCOME") {
    addDelta(delta, accountId, amountMinor);
  } else if (type === "EXPENSE") {
    addDelta(delta, accountId, -amountMinor);
  } else {
    if (!transferAccountId) {
      throw new Error("transferAccountId is required to compute a TRANSFER delta");
    }
    addDelta(delta, accountId, -amountMinor);
    addDelta(delta, transferAccountId, amountMinor);
  }
  return delta;
}

export function negateBalanceDelta(delta: BalanceDelta): BalanceDelta {
  const result: BalanceDelta = new Map();
  for (const [accountId, amount] of delta) result.set(accountId, -amount);
  return result;
}

export function mergeBalanceDeltas(...deltas: BalanceDelta[]): BalanceDelta {
  const result: BalanceDelta = new Map();
  for (const delta of deltas) {
    for (const [accountId, amount] of delta) addDelta(result, accountId, amount);
  }
  return result;
}
