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
describe("Financial domain (integration)", () => {
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
    overrides: Partial<{ name: string; type: string; currency: string; initialBalanceMinor: string }> = {},
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
    return res.body as { id: string; balanceMinor: string };
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

  describe("accounts", () => {
    it("creates an account with the given initial balance", async () => {
      const user = await newUser("acc-create");
      const account = await createAccount(user, { initialBalanceMinor: "50000" });
      expect(account.balanceMinor).toBe("50000");
    });

    it("returns 404 (not 403) when another user requests someone else's account", async () => {
      const owner = await newUser("acc-owner");
      const attacker = await newUser("acc-attacker");
      const account = await createAccount(owner);

      const res = await attacker.agent.get(`/accounts/${account.id}`);
      expect(res.status).toBe(404);
    });

    it("refuses to delete an account with transactions, but allows archiving", async () => {
      const user = await newUser("acc-delete");
      const account = await createAccount(user, { initialBalanceMinor: "10000" });
      const category = await createCategory(user, "EXPENSE");

      await user.agent
        .post("/transactions")
        .set("X-CSRF-Token", user.csrfToken)
        .send({
          accountId: account.id,
          categoryId: category.id,
          type: "EXPENSE",
          amountMinor: "1500",
          currency: "USD",
          occurredAt: new Date().toISOString(),
        });

      const deleteRes = await user.agent
        .delete(`/accounts/${account.id}`)
        .set("X-CSRF-Token", user.csrfToken);
      expect(deleteRes.status).toBe(409);

      const archiveRes = await user.agent
        .patch(`/accounts/${account.id}`)
        .set("X-CSRF-Token", user.csrfToken)
        .send({ isArchived: true });
      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.isArchived).toBe(true);
    });

    it("rejects posting a new transaction to an archived account", async () => {
      const user = await newUser("acc-archived-post");
      const account = await createAccount(user);
      const category = await createCategory(user, "EXPENSE");
      await user.agent
        .patch(`/accounts/${account.id}`)
        .set("X-CSRF-Token", user.csrfToken)
        .send({ isArchived: true });

      const res = await user.agent
        .post("/transactions")
        .set("X-CSRF-Token", user.csrfToken)
        .send({
          accountId: account.id,
          categoryId: category.id,
          type: "EXPENSE",
          amountMinor: "100",
          currency: "USD",
          occurredAt: new Date().toISOString(),
        });
      expect(res.status).toBe(400);
    });
  });

  describe("categories", () => {
    it("lets a user manage their own custom category but not another user's", async () => {
      const owner = await newUser("cat-owner");
      const attacker = await newUser("cat-attacker");
      const category = await createCategory(owner, "EXPENSE");

      const attackRes = await attacker.agent
        .patch(`/categories/${category.id}`)
        .set("X-CSRF-Token", attacker.csrfToken)
        .send({ name: "Hijacked" });
      expect(attackRes.status).toBe(404);

      const ownerRes = await owner.agent
        .patch(`/categories/${category.id}`)
        .set("X-CSRF-Token", owner.csrfToken)
        .send({ name: "Renamed" });
      expect(ownerRes.status).toBe(200);
      expect(ownerRes.body.name).toBe("Renamed");
    });
  });

  describe("transactions — balance maintenance", () => {
    it("credits the account balance for INCOME", async () => {
      const user = await newUser("tx-income");
      const account = await createAccount(user);
      const category = await createCategory(user, "INCOME");

      await user.agent
        .post("/transactions")
        .set("X-CSRF-Token", user.csrfToken)
        .send({
          accountId: account.id,
          categoryId: category.id,
          type: "INCOME",
          amountMinor: "250000",
          currency: "USD",
          occurredAt: new Date().toISOString(),
        });

      const refreshed = await user.agent.get(`/accounts/${account.id}`);
      expect(refreshed.body.balanceMinor).toBe("250000");
    });

    it("debits the account balance for EXPENSE", async () => {
      const user = await newUser("tx-expense");
      const account = await createAccount(user, { initialBalanceMinor: "10000" });
      const category = await createCategory(user, "EXPENSE");

      await user.agent
        .post("/transactions")
        .set("X-CSRF-Token", user.csrfToken)
        .send({
          accountId: account.id,
          categoryId: category.id,
          type: "EXPENSE",
          amountMinor: "3000",
          currency: "USD",
          occurredAt: new Date().toISOString(),
        });

      const refreshed = await user.agent.get(`/accounts/${account.id}`);
      expect(refreshed.body.balanceMinor).toBe("7000");
    });

    it("moves money between two of the same user's accounts on TRANSFER", async () => {
      const user = await newUser("tx-transfer");
      const source = await createAccount(user, { name: "Checking", initialBalanceMinor: "10000" });
      const destination = await createAccount(user, { name: "Savings", initialBalanceMinor: "0" });

      const res = await user.agent
        .post("/transactions")
        .set("X-CSRF-Token", user.csrfToken)
        .send({
          accountId: source.id,
          transferAccountId: destination.id,
          type: "TRANSFER",
          amountMinor: "4000",
          currency: "USD",
          occurredAt: new Date().toISOString(),
        });
      expect(res.status).toBe(201);

      const sourceAfter = await user.agent.get(`/accounts/${source.id}`);
      const destAfter = await user.agent.get(`/accounts/${destination.id}`);
      expect(sourceAfter.body.balanceMinor).toBe("6000");
      expect(destAfter.body.balanceMinor).toBe("4000");
    });

    it("rejects a transfer between accounts of different currencies", async () => {
      const user = await newUser("tx-fx");
      const usd = await createAccount(user, { currency: "USD" });
      const eur = await createAccount(user, { currency: "EUR" });

      const res = await user.agent
        .post("/transactions")
        .set("X-CSRF-Token", user.csrfToken)
        .send({
          accountId: usd.id,
          transferAccountId: eur.id,
          type: "TRANSFER",
          amountMinor: "1000",
          currency: "USD",
          occurredAt: new Date().toISOString(),
        });
      expect(res.status).toBe(400);
    });

    it("rejects a category whose type doesn't match the transaction type", async () => {
      const user = await newUser("tx-cat-mismatch");
      const account = await createAccount(user);
      const incomeCategory = await createCategory(user, "INCOME");

      const res = await user.agent
        .post("/transactions")
        .set("X-CSRF-Token", user.csrfToken)
        .send({
          accountId: account.id,
          categoryId: incomeCategory.id,
          type: "EXPENSE",
          amountMinor: "1000",
          currency: "USD",
          occurredAt: new Date().toISOString(),
        });
      expect(res.status).toBe(400);
    });

    it("re-nets balances correctly when a transaction is edited to a different account and amount", async () => {
      const user = await newUser("tx-edit");
      const accountA = await createAccount(user, { name: "A", initialBalanceMinor: "0" });
      const accountB = await createAccount(user, { name: "B", initialBalanceMinor: "0" });
      const category = await createCategory(user, "EXPENSE");

      const createRes = await user.agent
        .post("/transactions")
        .set("X-CSRF-Token", user.csrfToken)
        .send({
          accountId: accountA.id,
          categoryId: category.id,
          type: "EXPENSE",
          amountMinor: "1000",
          currency: "USD",
          occurredAt: new Date().toISOString(),
        });
      const transactionId = createRes.body.id as string;

      // A is now -1000. Edit the transaction to post 4000 against B instead.
      await user.agent
        .patch(`/transactions/${transactionId}`)
        .set("X-CSRF-Token", user.csrfToken)
        .send({
          accountId: accountB.id,
          categoryId: category.id,
          type: "EXPENSE",
          amountMinor: "4000",
          currency: "USD",
          occurredAt: new Date().toISOString(),
        });

      const aAfter = await user.agent.get(`/accounts/${accountA.id}`);
      const bAfter = await user.agent.get(`/accounts/${accountB.id}`);
      expect(aAfter.body.balanceMinor).toBe("0"); // fully reversed
      expect(bAfter.body.balanceMinor).toBe("-4000"); // newly applied
    });

    it("reverses the balance effect when a transaction is deleted", async () => {
      const user = await newUser("tx-delete");
      const account = await createAccount(user, { initialBalanceMinor: "5000" });
      const category = await createCategory(user, "EXPENSE");

      const createRes = await user.agent
        .post("/transactions")
        .set("X-CSRF-Token", user.csrfToken)
        .send({
          accountId: account.id,
          categoryId: category.id,
          type: "EXPENSE",
          amountMinor: "2000",
          currency: "USD",
          occurredAt: new Date().toISOString(),
        });

      let refreshed = await user.agent.get(`/accounts/${account.id}`);
      expect(refreshed.body.balanceMinor).toBe("3000");

      await user.agent
        .delete(`/transactions/${createRes.body.id}`)
        .set("X-CSRF-Token", user.csrfToken);

      refreshed = await user.agent.get(`/accounts/${account.id}`);
      expect(refreshed.body.balanceMinor).toBe("5000");
    });

    it("returns 404 (not 403) when another user requests someone else's transaction", async () => {
      const owner = await newUser("tx-owner");
      const attacker = await newUser("tx-attacker");
      const account = await createAccount(owner);
      const category = await createCategory(owner, "EXPENSE");

      const createRes = await owner.agent
        .post("/transactions")
        .set("X-CSRF-Token", owner.csrfToken)
        .send({
          accountId: account.id,
          categoryId: category.id,
          type: "EXPENSE",
          amountMinor: "1000",
          currency: "USD",
          occurredAt: new Date().toISOString(),
        });

      const readRes = await attacker.agent.get(`/transactions/${createRes.body.id}`);
      expect(readRes.status).toBe(404);

      const deleteRes = await attacker.agent
        .delete(`/transactions/${createRes.body.id}`)
        .set("X-CSRF-Token", attacker.csrfToken);
      expect(deleteRes.status).toBe(404);

      // Confirm the attacker's no-op delete didn't touch the owner's data.
      const stillThere = await owner.agent.get(`/transactions/${createRes.body.id}`);
      expect(stillThere.status).toBe(200);
    });

    it("cannot post a transaction against another user's account (IDOR on accountId)", async () => {
      const owner = await newUser("tx-account-idor-owner");
      const attacker = await newUser("tx-account-idor-attacker");
      const account = await createAccount(owner);
      const category = await createCategory(attacker, "EXPENSE");

      const res = await attacker.agent
        .post("/transactions")
        .set("X-CSRF-Token", attacker.csrfToken)
        .send({
          accountId: account.id,
          categoryId: category.id,
          type: "EXPENSE",
          amountMinor: "1000",
          currency: "USD",
          occurredAt: new Date().toISOString(),
        });
      expect(res.status).toBe(404);
    });

    it("rejects unexpected extra fields (mass-assignment protection)", async () => {
      const user = await newUser("tx-mass-assign");
      const account = await createAccount(user);
      const category = await createCategory(user, "EXPENSE");

      const res = await user.agent
        .post("/transactions")
        .set("X-CSRF-Token", user.csrfToken)
        .send({
          accountId: account.id,
          categoryId: category.id,
          type: "EXPENSE",
          amountMinor: "1000",
          currency: "USD",
          occurredAt: new Date().toISOString(),
          userId: "attacker-supplied",
        });
      expect(res.status).toBe(400);
    });
  });
});
