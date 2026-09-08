/**
 * Seeds synthetic/demo data only — never run this against a database that
 * could contain real user data. Idempotent: does nothing if the demo user
 * already exists, so `pnpm seed` is safe to re-run.
 */
import * as argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@expensesaas.local";
const DEMO_PASSWORD = "DemoPass1234!";

const SYSTEM_CATEGORIES = [
  { id: "seed-cat-salary", name: "Salary", type: "INCOME", icon: "briefcase", color: "#16A34A" },
  { id: "seed-cat-freelance", name: "Freelance", type: "INCOME", icon: "laptop", color: "#0EA5E9" },
  { id: "seed-cat-groceries", name: "Groceries", type: "EXPENSE", icon: "shopping-cart", color: "#F59E0B" },
  { id: "seed-cat-rent", name: "Rent", type: "EXPENSE", icon: "home", color: "#DC2626" },
  { id: "seed-cat-utilities", name: "Utilities", type: "EXPENSE", icon: "bolt", color: "#7C3AED" },
  { id: "seed-cat-dining", name: "Dining Out", type: "EXPENSE", icon: "utensils", color: "#DB2777" },
  { id: "seed-cat-transport", name: "Transportation", type: "EXPENSE", icon: "car", color: "#2563EB" },
  { id: "seed-cat-entertainment", name: "Entertainment", type: "EXPENSE", icon: "film", color: "#9333EA" },
] as const;

function daysAgo(n: number): Date {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - n);
  return date;
}

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    console.log(`Demo user ${DEMO_EMAIL} already exists — skipping seed.`);
    return;
  }

  for (const category of SYSTEM_CATEGORIES) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: {},
      create: { ...category, userId: null },
    });
  }

  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash,
      name: "Demo User",
      emailVerifiedAt: new Date(),
    },
  });

  const checking = await prisma.account.create({
    data: { userId: user.id, name: "Everyday Checking", type: "BANK", currency: "USD", balanceMinor: 0n },
  });
  const cash = await prisma.account.create({
    data: { userId: user.id, name: "Cash Wallet", type: "CASH", currency: "USD", balanceMinor: 0n },
  });
  const creditCard = await prisma.account.create({
    data: {
      userId: user.id,
      name: "Rewards Credit Card",
      type: "CREDIT_CARD",
      currency: "USD",
      // Starts already carrying a balance owed, entered as history rather
      // than a transaction.
      balanceMinor: -12000n,
    },
  });

  const cat = (id: (typeof SYSTEM_CATEGORIES)[number]["id"]) => id;

  interface SeedTx {
    daysAgo: number;
    accountId: string;
    categoryId?: string;
    transferAccountId?: string;
    type: "INCOME" | "EXPENSE" | "TRANSFER";
    amountMinor: bigint;
    description?: string;
    merchant?: string;
  }

  const seedTransactions: SeedTx[] = [
    // ~2 months ago
    { daysAgo: 58, accountId: checking.id, categoryId: cat("seed-cat-salary"), type: "INCOME", amountMinor: 450000n, description: "Monthly salary" },
    { daysAgo: 57, accountId: checking.id, categoryId: cat("seed-cat-rent"), type: "EXPENSE", amountMinor: 150000n, description: "Rent" },
    { daysAgo: 55, accountId: checking.id, categoryId: cat("seed-cat-utilities"), type: "EXPENSE", amountMinor: 8200n, merchant: "City Power & Water" },
    { daysAgo: 54, accountId: checking.id, transferAccountId: cash.id, type: "TRANSFER", amountMinor: 20000n, description: "ATM withdrawal" },
    { daysAgo: 53, accountId: cash.id, categoryId: cat("seed-cat-groceries"), type: "EXPENSE", amountMinor: 6400n, merchant: "Corner Market" },
    { daysAgo: 51, accountId: checking.id, categoryId: cat("seed-cat-groceries"), type: "EXPENSE", amountMinor: 8900n, merchant: "Big Grocer" },
    { daysAgo: 49, accountId: checking.id, categoryId: cat("seed-cat-dining"), type: "EXPENSE", amountMinor: 3200n, merchant: "Ramen House" },
    { daysAgo: 47, accountId: checking.id, categoryId: cat("seed-cat-transport"), type: "EXPENSE", amountMinor: 4500n, merchant: "Metro Transit" },
    { daysAgo: 45, accountId: checking.id, categoryId: cat("seed-cat-freelance"), type: "INCOME", amountMinor: 60000n, description: "Freelance project" },
    { daysAgo: 44, accountId: checking.id, transferAccountId: creditCard.id, type: "TRANSFER", amountMinor: 12000n, description: "Credit card payment" },
    { daysAgo: 42, accountId: checking.id, categoryId: cat("seed-cat-entertainment"), type: "EXPENSE", amountMinor: 1599n, merchant: "Streaming Service" },
    { daysAgo: 40, accountId: cash.id, categoryId: cat("seed-cat-dining"), type: "EXPENSE", amountMinor: 2100n, merchant: "Food Truck" },
    // ~1 month ago
    { daysAgo: 28, accountId: checking.id, categoryId: cat("seed-cat-salary"), type: "INCOME", amountMinor: 450000n, description: "Monthly salary" },
    { daysAgo: 27, accountId: checking.id, categoryId: cat("seed-cat-rent"), type: "EXPENSE", amountMinor: 150000n, description: "Rent" },
    { daysAgo: 25, accountId: checking.id, categoryId: cat("seed-cat-utilities"), type: "EXPENSE", amountMinor: 7800n, merchant: "City Power & Water" },
    { daysAgo: 24, accountId: checking.id, transferAccountId: cash.id, type: "TRANSFER", amountMinor: 15000n, description: "ATM withdrawal" },
    { daysAgo: 22, accountId: checking.id, categoryId: cat("seed-cat-groceries"), type: "EXPENSE", amountMinor: 9200n, merchant: "Big Grocer" },
    { daysAgo: 20, accountId: cash.id, categoryId: cat("seed-cat-groceries"), type: "EXPENSE", amountMinor: 4100n, merchant: "Corner Market" },
    { daysAgo: 18, accountId: checking.id, categoryId: cat("seed-cat-dining"), type: "EXPENSE", amountMinor: 4400n, merchant: "Taco Place" },
    { daysAgo: 16, accountId: checking.id, categoryId: cat("seed-cat-transport"), type: "EXPENSE", amountMinor: 5200n, merchant: "Rideshare" },
    { daysAgo: 14, accountId: checking.id, categoryId: cat("seed-cat-entertainment"), type: "EXPENSE", amountMinor: 3500n, merchant: "Cinema" },
    { daysAgo: 10, accountId: checking.id, categoryId: cat("seed-cat-freelance"), type: "INCOME", amountMinor: 45000n, description: "Freelance project" },
    { daysAgo: 8, accountId: checking.id, transferAccountId: creditCard.id, type: "TRANSFER", amountMinor: 10000n, description: "Credit card payment" },
    { daysAgo: 6, accountId: cash.id, categoryId: cat("seed-cat-dining"), type: "EXPENSE", amountMinor: 1800n, merchant: "Coffee Shop" },
    { daysAgo: 3, accountId: checking.id, categoryId: cat("seed-cat-groceries"), type: "EXPENSE", amountMinor: 7300n, merchant: "Big Grocer" },
    { daysAgo: 1, accountId: checking.id, categoryId: cat("seed-cat-entertainment"), type: "EXPENSE", amountMinor: 1299n, merchant: "Streaming Service" },
  ];

  const balances = new Map<string, bigint>([
    [checking.id, 0n],
    [cash.id, 0n],
    [creditCard.id, -12000n],
  ]);
  const applyDelta = (accountId: string, delta: bigint) =>
    balances.set(accountId, (balances.get(accountId) ?? 0n) + delta);

  for (const tx of seedTransactions) {
    await prisma.transaction.create({
      data: {
        userId: user.id,
        accountId: tx.accountId,
        categoryId: tx.categoryId ?? null,
        transferAccountId: tx.transferAccountId ?? null,
        type: tx.type,
        amountMinor: tx.amountMinor,
        currency: "USD",
        description: tx.description,
        merchant: tx.merchant,
        occurredAt: daysAgo(tx.daysAgo),
      },
    });

    if (tx.type === "INCOME") applyDelta(tx.accountId, tx.amountMinor);
    else if (tx.type === "EXPENSE") applyDelta(tx.accountId, -tx.amountMinor);
    else {
      applyDelta(tx.accountId, -tx.amountMinor);
      applyDelta(tx.transferAccountId!, tx.amountMinor);
    }
  }

  for (const [accountId, balanceMinor] of balances) {
    await prisma.account.update({ where: { id: accountId }, data: { balanceMinor } });
  }

  console.log(`Seeded demo user ${DEMO_EMAIL} / ${DEMO_PASSWORD} with 3 accounts and ${seedTransactions.length} transactions.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
