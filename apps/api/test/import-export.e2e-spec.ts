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
 * Object storage (MinIO) calls happen only inside the worker, not the API,
 * so these tests exercise validation/ownership/job-creation without needing
 * the worker or MinIO running.
 */
describe("CSV import / data export (integration)", () => {
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

  describe("CSV import", () => {
    it("rejects an upload with no file", async () => {
      const user = await newUser("import-no-file");
      const account = await createAccount(user);

      const res = await user.agent
        .post("/import/csv")
        .set("X-CSRF-Token", user.csrfToken)
        .field("accountId", account.id);
      expect(res.status).toBe(400);
    });

    it("rejects an upload targeting another user's account", async () => {
      const owner = await newUser("import-owner");
      const attacker = await newUser("import-attacker");
      const account = await createAccount(owner);

      const res = await attacker.agent
        .post("/import/csv")
        .set("X-CSRF-Token", attacker.csrfToken)
        .field("accountId", account.id)
        .attach("file", Buffer.from("date,type,amount\n2025-01-01,EXPENSE,10.00\n"), {
          filename: "transactions.csv",
          contentType: "text/csv",
        });
      expect(res.status).toBe(404);
    });

    it("accepts a valid CSV upload and creates a pending job", async () => {
      const user = await newUser("import-valid");
      const account = await createAccount(user);

      const res = await user.agent
        .post("/import/csv")
        .set("X-CSRF-Token", user.csrfToken)
        .field("accountId", account.id)
        .attach("file", Buffer.from("date,type,amount\n2025-01-01,EXPENSE,10.00\n"), {
          filename: "transactions.csv",
          contentType: "text/csv",
        });
      expect(res.status).toBe(201);
      expect(["PENDING", "PROCESSING"]).toContain(res.body.status);

      const statusRes = await user.agent.get(`/import/${res.body.id}/status`);
      expect(statusRes.status).toBe(200);
    });

    it("rejects a file disguised as CSV that is actually a ZIP", async () => {
      const user = await newUser("import-fake-zip");
      const account = await createAccount(user);

      const res = await user.agent
        .post("/import/csv")
        .set("X-CSRF-Token", user.csrfToken)
        .field("accountId", account.id)
        .attach("file", Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]), {
          filename: "transactions.csv",
          contentType: "text/csv",
        });
      expect(res.status).toBe(400);
    });

    it("returns 404 (not 403) when another user checks someone else's import job status", async () => {
      const owner = await newUser("import-status-owner");
      const attacker = await newUser("import-status-attacker");
      const account = await createAccount(owner);

      const createRes = await owner.agent
        .post("/import/csv")
        .set("X-CSRF-Token", owner.csrfToken)
        .field("accountId", account.id)
        .attach("file", Buffer.from("date,type,amount\n2025-01-01,EXPENSE,10.00\n"), {
          filename: "transactions.csv",
          contentType: "text/csv",
        });

      const res = await attacker.agent.get(`/import/${createRes.body.id}/status`);
      expect(res.status).toBe(404);
    });
  });

  describe("data export", () => {
    it("creates a pending export request", async () => {
      const user = await newUser("export-create");
      const res = await user.agent.post("/exports").set("X-CSRF-Token", user.csrfToken);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe("PENDING");
    });

    it("rejects downloading before the export is ready", async () => {
      const user = await newUser("export-not-ready");
      const createRes = await user.agent.post("/exports").set("X-CSRF-Token", user.csrfToken);

      const res = await user.agent.get(`/exports/${createRes.body.id}/download`);
      expect(res.status).toBe(400);
    });

    it("returns 404 (not 403) when another user requests someone else's export", async () => {
      const owner = await newUser("export-owner");
      const attacker = await newUser("export-attacker");
      const createRes = await owner.agent.post("/exports").set("X-CSRF-Token", owner.csrfToken);

      const statusRes = await attacker.agent.get(`/exports/${createRes.body.id}`);
      expect(statusRes.status).toBe(404);

      const downloadRes = await attacker.agent.get(`/exports/${createRes.body.id}/download`);
      expect(downloadRes.status).toBe(404);
    });
  });
});
