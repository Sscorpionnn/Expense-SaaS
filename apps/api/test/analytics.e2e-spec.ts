import type { INestApplication } from "@nestjs/common";
import type Redis from "ioredis";
import {
  createTestApp,
  registerAndLogin,
  resetDatabase,
  type FakeMailerService,
  type TestApp,
} from "./setup";
import type { PrismaService } from "../src/core/prisma.service";

/**
 * Integration tests — require a live Postgres + Redis (see docker-compose.yml).
 * Run via `pnpm test:integration`.
 */
describe("Analytics (integration)", () => {
  let ctx: TestApp;
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let mailer: FakeMailerService;

  beforeAll(async () => {
    ctx = await createTestApp();
    ({ app, prisma, redis, mailer } = ctx);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await redis.flushdb();
    mailer.sent = [];
  });

  async function newUser(prefix: string) {
    return registerAndLogin(app, mailer, prefix);
  }

  async function createAccount(
    user: Awaited<ReturnType<typeof newUser>>,
    overrides: Partial<{ name: string; initialBalanceMinor: string }> = {},
  ) {
    const res = await user.agent
      .post("/accounts")
      .set("X-CSRF-Token", user.csrfToken)
      .send({
        name: "Checking",
        type: "BANK",
        currency: "USD",
        initialBalanceMinor: "0",
        ...overrides,
      });
    return res.body as { id: string };
  }

  async function createCategory(
    user: Awaited<ReturnType<typeof newUser>>,
    type: "INCOME" | "EXPENSE",
    name?: string,
  ) {
    const res = await user.agent
      .post("/categories")
      .set("X-CSRF-Token", user.csrfToken)
      .send({ name: name ?? (type === "INCOME" ? "Salary" : "Groceries"), type });
    return res.body as { id: string };
  }

  async function createTransaction(
    user: Awaited<ReturnType<typeof newUser>>,
    params: {
      accountId: string;
      categoryId: string;
      type: "INCOME" | "EXPENSE";
      amountMinor: string;
      occurredAt?: Date;
    },
  ) {
    const res = await user.agent
      .post("/transactions")
      .set("X-CSRF-Token", user.csrfToken)
      .send({
        accountId: params.accountId,
        categoryId: params.categoryId,
        type: params.type,
        amountMinor: params.amountMinor,
        currency: "USD",
        occurredAt: (params.occurredAt ?? new Date()).toISOString(),
      });
    return res.body as { id: string };
  }

  describe("summary", () => {
    it("computes income, expense, net, and total balance from real transactions", async () => {
      const user = await newUser("analytics-summary");
      const account = await createAccount(user, { initialBalanceMinor: "10000" });
      const income = await createCategory(user, "INCOME");
      const expense = await createCategory(user, "EXPENSE");

      await createTransaction(user, {
        accountId: account.id,
        categoryId: income.id,
        type: "INCOME",
        amountMinor: "50000",
      });
      await createTransaction(user, {
        accountId: account.id,
        categoryId: expense.id,
        type: "EXPENSE",
        amountMinor: "12000",
      });

      const res = await user.agent.get("/analytics/summary");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        currency: "USD",
        incomeMinor: "50000",
        expenseMinor: "12000",
        netMinor: "38000",
        // Starting balance 10000 + income 50000 - expense 12000.
        totalBalanceMinor: "48000",
      });
    });

    it("only reflects the requesting user's own transactions and accounts", async () => {
      const userA = await newUser("analytics-summary-a");
      const userB = await newUser("analytics-summary-b");

      const accountA = await createAccount(userA, { initialBalanceMinor: "10000" });
      const incomeA = await createCategory(userA, "INCOME");
      await createTransaction(userA, {
        accountId: accountA.id,
        categoryId: incomeA.id,
        type: "INCOME",
        amountMinor: "99999",
      });

      const res = await userB.agent.get("/analytics/summary");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        incomeMinor: "0",
        expenseMinor: "0",
        netMinor: "0",
        totalBalanceMinor: "0",
      });
    });
  });

  describe("spending-by-category", () => {
    it("groups expense totals by category, sorted highest-spend first", async () => {
      const user = await newUser("analytics-spending");
      const account = await createAccount(user);
      const groceries = await createCategory(user, "EXPENSE", "Groceries");
      const transport = await createCategory(user, "EXPENSE", "Transport");

      await createTransaction(user, {
        accountId: account.id,
        categoryId: groceries.id,
        type: "EXPENSE",
        amountMinor: "3000",
      });
      await createTransaction(user, {
        accountId: account.id,
        categoryId: transport.id,
        type: "EXPENSE",
        amountMinor: "9000",
      });

      const res = await user.agent.get("/analytics/spending-by-category");
      expect(res.status).toBe(200);
      const body = res.body as { categoryId: string | null; categoryName: string; spentMinor: string }[];
      expect(body).toHaveLength(2);
      expect(body[0]).toMatchObject({ categoryName: "Transport", spentMinor: "9000" });
      expect(body[1]).toMatchObject({ categoryName: "Groceries", spentMinor: "3000" });
    });

    it("does not include another user's spending", async () => {
      const userA = await newUser("analytics-spending-a");
      const userB = await newUser("analytics-spending-b");
      const accountA = await createAccount(userA);
      const categoryA = await createCategory(userA, "EXPENSE");
      await createTransaction(userA, {
        accountId: accountA.id,
        categoryId: categoryA.id,
        type: "EXPENSE",
        amountMinor: "5000",
      });

      const res = await userB.agent.get("/analytics/spending-by-category");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("monthly-trends", () => {
    it("returns the requested number of months, most recent last, including this month's totals", async () => {
      const user = await newUser("analytics-trends");
      const account = await createAccount(user);
      const income = await createCategory(user, "INCOME");
      const expense = await createCategory(user, "EXPENSE");

      await createTransaction(user, {
        accountId: account.id,
        categoryId: income.id,
        type: "INCOME",
        amountMinor: "20000",
      });
      await createTransaction(user, {
        accountId: account.id,
        categoryId: expense.id,
        type: "EXPENSE",
        amountMinor: "5000",
      });

      const res = await user.agent.get("/analytics/monthly-trends").query({ months: 3 });
      expect(res.status).toBe(200);
      const body = res.body as { month: string; incomeMinor: string; expenseMinor: string }[];
      expect(body).toHaveLength(3);

      const now = new Date();
      const expectedCurrentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      const current = body[body.length - 1]!;
      expect(current.month).toBe(expectedCurrentMonth);
      expect(current.incomeMinor).toBe("20000");
      expect(current.expenseMinor).toBe("5000");
    });

    it("rejects an out-of-range months value", async () => {
      const user = await newUser("analytics-trends-invalid");
      const res = await user.agent.get("/analytics/monthly-trends").query({ months: 25 });
      expect(res.status).toBe(400);
    });
  });

  describe("budget-utilization", () => {
    it("returns only the requesting user's budgets", async () => {
      const userA = await newUser("analytics-budget-a");
      const userB = await newUser("analytics-budget-b");
      const categoryA = await createCategory(userA, "EXPENSE");

      const budgetRes = await userA.agent
        .post("/budgets")
        .set("X-CSRF-Token", userA.csrfToken)
        .send({
          name: "Groceries budget",
          categoryId: categoryA.id,
          amountMinor: "50000",
          currency: "USD",
          periodType: "MONTHLY",
          startDate: new Date().toISOString(),
        });
      expect(budgetRes.status).toBe(201);

      const resA = await userA.agent.get("/analytics/budget-utilization");
      expect(resA.status).toBe(200);
      const bodyA = resA.body as { items: { id: string }[] };
      expect(bodyA.items.some((item) => item.id === budgetRes.body.id)).toBe(true);

      const resB = await userB.agent.get("/analytics/budget-utilization");
      expect(resB.status).toBe(200);
      const bodyB = resB.body as { items: { id: string }[] };
      expect(bodyB.items).toHaveLength(0);
    });
  });
});
