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
describe("Budgets, goals, recurring, notifications (integration)", () => {
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

  async function createAccount(user: Awaited<ReturnType<typeof newUser>>) {
    const res = await user.agent
      .post("/accounts")
      .set("X-CSRF-Token", user.csrfToken)
      .send({ name: "Checking", type: "BANK", currency: "USD", initialBalanceMinor: "0" });
    return res.body as { id: string };
  }

  async function createCategory(
    user: Awaited<ReturnType<typeof newUser>>,
    type: "INCOME" | "EXPENSE",
  ) {
    const res = await user.agent
      .post("/categories")
      .set("X-CSRF-Token", user.csrfToken)
      .send({ name: type === "INCOME" ? "Salary" : "Groceries", type });
    return res.body as { id: string };
  }

  describe("budgets", () => {
    it("computes spent/remaining from real transactions in the budget's category", async () => {
      const user = await newUser("budget-progress");
      const account = await createAccount(user);
      const category = await createCategory(user, "EXPENSE");

      const budgetRes = await user.agent
        .post("/budgets")
        .set("X-CSRF-Token", user.csrfToken)
        .send({
          name: "Groceries budget",
          categoryId: category.id,
          amountMinor: "50000",
          currency: "USD",
          periodType: "MONTHLY",
          startDate: new Date().toISOString(),
        });
      expect(budgetRes.status).toBe(201);
      expect(budgetRes.body.currentPeriod.spentMinor).toBe("0");

      await user.agent
        .post("/transactions")
        .set("X-CSRF-Token", user.csrfToken)
        .send({
          accountId: account.id,
          categoryId: category.id,
          type: "EXPENSE",
          amountMinor: "12000",
          currency: "USD",
          occurredAt: new Date().toISOString(),
        });

      const progressRes = await user.agent.get(`/budgets/${budgetRes.body.id}/progress`);
      expect(progressRes.body.currentPeriod.spentMinor).toBe("12000");
      expect(progressRes.body.currentPeriod.remainingMinor).toBe("38000");
      expect(progressRes.body.currentPeriod.percentage).toBeCloseTo(24, 5);
    });

    it("rejects a budget on a non-EXPENSE category", async () => {
      const user = await newUser("budget-income-cat");
      const income = await createCategory(user, "INCOME");

      const res = await user.agent
        .post("/budgets")
        .set("X-CSRF-Token", user.csrfToken)
        .send({
          name: "Bad budget",
          categoryId: income.id,
          amountMinor: "10000",
          currency: "USD",
          periodType: "MONTHLY",
          startDate: new Date().toISOString(),
        });
      expect(res.status).toBe(400);
    });

    it("returns 404 (not 403) when another user requests someone else's budget", async () => {
      const owner = await newUser("budget-owner");
      const attacker = await newUser("budget-attacker");
      const budgetRes = await owner.agent
        .post("/budgets")
        .set("X-CSRF-Token", owner.csrfToken)
        .send({
          name: "Overall budget",
          amountMinor: "100000",
          currency: "USD",
          periodType: "MONTHLY",
          startDate: new Date().toISOString(),
        });

      const res = await attacker.agent.get(`/budgets/${budgetRes.body.id}`);
      expect(res.status).toBe(404);
    });
  });

  describe("goals", () => {
    it("auto-completes when a contribution reaches the target", async () => {
      const user = await newUser("goal-complete");
      const createRes = await user.agent
        .post("/goals")
        .set("X-CSRF-Token", user.csrfToken)
        .send({ name: "Emergency fund", targetAmountMinor: "100000", currency: "USD" });

      const partial = await user.agent
        .post(`/goals/${createRes.body.id}/contribute`)
        .set("X-CSRF-Token", user.csrfToken)
        .send({ amountMinor: "40000" });
      expect(partial.body.status).toBe("ACTIVE");

      const complete = await user.agent
        .post(`/goals/${createRes.body.id}/contribute`)
        .set("X-CSRF-Token", user.csrfToken)
        .send({ amountMinor: "60000" });
      expect(complete.body.status).toBe("COMPLETED");
      expect(complete.body.currentAmountMinor).toBe("100000");
    });

    it("rejects contributing to a non-active goal", async () => {
      const user = await newUser("goal-inactive");
      const createRes = await user.agent
        .post("/goals")
        .set("X-CSRF-Token", user.csrfToken)
        .send({ name: "Vacation", targetAmountMinor: "50000", currency: "USD" });
      await user.agent
        .patch(`/goals/${createRes.body.id}`)
        .set("X-CSRF-Token", user.csrfToken)
        .send({ status: "PAUSED" });

      const res = await user.agent
        .post(`/goals/${createRes.body.id}/contribute`)
        .set("X-CSRF-Token", user.csrfToken)
        .send({ amountMinor: "1000" });
      expect(res.status).toBe(400);
    });

    it("returns 404 when another user tries to contribute to someone else's goal", async () => {
      const owner = await newUser("goal-owner");
      const attacker = await newUser("goal-attacker");
      const createRes = await owner.agent
        .post("/goals")
        .set("X-CSRF-Token", owner.csrfToken)
        .send({ name: "House", targetAmountMinor: "500000", currency: "USD" });

      const res = await attacker.agent
        .post(`/goals/${createRes.body.id}/contribute`)
        .set("X-CSRF-Token", attacker.csrfToken)
        .send({ amountMinor: "1000" });
      expect(res.status).toBe(404);
    });
  });

  describe("recurring transactions", () => {
    it("creates a recurring transaction with nextOccurrenceAt seeded from startDate", async () => {
      const user = await newUser("recurring-create");
      const account = await createAccount(user);
      const category = await createCategory(user, "EXPENSE");
      const startDate = new Date().toISOString();

      const res = await user.agent
        .post("/recurring-transactions")
        .set("X-CSRF-Token", user.csrfToken)
        .send({
          accountId: account.id,
          categoryId: category.id,
          type: "EXPENSE",
          amountMinor: "1500",
          currency: "USD",
          frequency: "MONTHLY",
          startDate,
        });
      expect(res.status).toBe(201);
      expect(res.body.nextOccurrenceAt).toBe(startDate);
      expect(res.body.interval).toBe(1);
    });

    it("rejects a category type mismatch", async () => {
      const user = await newUser("recurring-cat-mismatch");
      const account = await createAccount(user);
      const income = await createCategory(user, "INCOME");

      const res = await user.agent
        .post("/recurring-transactions")
        .set("X-CSRF-Token", user.csrfToken)
        .send({
          accountId: account.id,
          categoryId: income.id,
          type: "EXPENSE",
          amountMinor: "1500",
          currency: "USD",
          frequency: "MONTHLY",
          startDate: new Date().toISOString(),
        });
      expect(res.status).toBe(400);
    });

    it("returns 404 (not 403) when another user requests someone else's recurring transaction", async () => {
      const owner = await newUser("recurring-owner");
      const attacker = await newUser("recurring-attacker");
      const account = await createAccount(owner);
      const category = await createCategory(owner, "EXPENSE");
      const createRes = await owner.agent
        .post("/recurring-transactions")
        .set("X-CSRF-Token", owner.csrfToken)
        .send({
          accountId: account.id,
          categoryId: category.id,
          type: "EXPENSE",
          amountMinor: "1500",
          currency: "USD",
          frequency: "MONTHLY",
          startDate: new Date().toISOString(),
        });

      const res = await attacker.agent.get(`/recurring-transactions/${createRes.body.id}`);
      expect(res.status).toBe(404);
    });
  });

  describe("notifications", () => {
    it("lists only the current user's notifications and lets them mark one read", async () => {
      const owner = await newUser("notif-owner");
      const attacker = await newUser("notif-attacker");
      const ownerId = (await prisma.user.findUniqueOrThrow({ where: { email: owner.email } })).id;

      const notification = await prisma.notification.create({
        data: {
          userId: ownerId,
          type: "RECURRING_REMINDER",
          title: "Rent is due",
          body: "Your recurring Rent expense is due today.",
        },
      });

      const attackerList = await attacker.agent.get("/notifications");
      expect(attackerList.body.items).toHaveLength(0);

      const attackerMarkRead = await attacker.agent
        .patch(`/notifications/${notification.id}/read`)
        .set("X-CSRF-Token", attacker.csrfToken);
      expect(attackerMarkRead.status).toBe(404);

      const ownerList = await owner.agent.get("/notifications");
      expect(ownerList.body.items).toHaveLength(1);
      expect(ownerList.body.items[0].isRead).toBe(false);

      const ownerMarkRead = await owner.agent
        .patch(`/notifications/${notification.id}/read`)
        .set("X-CSRF-Token", owner.csrfToken);
      expect(ownerMarkRead.status).toBe(200);
      expect(ownerMarkRead.body.isRead).toBe(true);
    });
  });
});
