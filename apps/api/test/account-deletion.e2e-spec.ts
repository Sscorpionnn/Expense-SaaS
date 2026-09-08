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
describe("Account deletion + privacy settings (integration)", () => {
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

  describe("privacy settings", () => {
    it("updates and reflects the analytics opt-in on the profile", async () => {
      const user = await newUser("privacy");

      const before = await user.agent.get("/auth/me");
      expect(before.body.user.shareUsageAnalytics).toBe(false);

      const patchRes = await user.agent
        .patch("/users/me/privacy")
        .set("X-CSRF-Token", user.csrfToken)
        .send({ shareUsageAnalytics: true });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.shareUsageAnalytics).toBe(true);

      const after = await user.agent.get("/auth/me");
      expect(after.body.user.shareUsageAnalytics).toBe(true);
    });
  });

  describe("account deletion", () => {
    it("requires email confirmation before scheduling a purge", async () => {
      const user = await newUser("deletion-flow");

      const requestRes = await user.agent
        .post("/account-deletion-requests")
        .set("X-CSRF-Token", user.csrfToken);
      expect(requestRes.status).toBe(201);
      expect(requestRes.body.status).toBe("PENDING");
      expect(requestRes.body.scheduledPurgeAt).toBeNull();

      const confirmToken = mailer.lastTokenFor(user.email);
      const confirmRes = await user.agent
        .post("/account-deletion-requests/confirm")
        .set("X-CSRF-Token", user.csrfToken)
        .send({ token: confirmToken });
      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.status).toBe("CONFIRMED");
      expect(confirmRes.body.scheduledPurgeAt).not.toBeNull();
    });

    it("rejects an invalid or already-used confirmation token", async () => {
      const user = await newUser("deletion-bad-token");
      await user.agent.post("/account-deletion-requests").set("X-CSRF-Token", user.csrfToken);

      const res = await user.agent
        .post("/account-deletion-requests/confirm")
        .set("X-CSRF-Token", user.csrfToken)
        .send({ token: "not-a-real-token" });
      expect(res.status).toBe(401);
    });

    it("is idempotent — repeat requests return the same pending request", async () => {
      const user = await newUser("deletion-idempotent");
      const first = await user.agent
        .post("/account-deletion-requests")
        .set("X-CSRF-Token", user.csrfToken);
      const second = await user.agent
        .post("/account-deletion-requests")
        .set("X-CSRF-Token", user.csrfToken);
      expect(second.body.id).toBe(first.body.id);
      expect(mailer.sent.filter((m) => m.subject.includes("deletion"))).toHaveLength(1);
    });

    it("lets a user cancel a pending deletion request", async () => {
      const user = await newUser("deletion-cancel");
      const requestRes = await user.agent
        .post("/account-deletion-requests")
        .set("X-CSRF-Token", user.csrfToken);

      const cancelRes = await user.agent
        .delete(`/account-deletion-requests/${requestRes.body.id}`)
        .set("X-CSRF-Token", user.csrfToken);
      expect(cancelRes.status).toBe(204);

      const currentRes = await user.agent.get("/account-deletion-requests/current");
      expect(currentRes.body).toBeNull();
    });

    it("returns 404 (not 403) when another user tries to cancel someone else's deletion request", async () => {
      const owner = await newUser("deletion-owner");
      const attacker = await newUser("deletion-attacker");
      const requestRes = await owner.agent
        .post("/account-deletion-requests")
        .set("X-CSRF-Token", owner.csrfToken);

      const res = await attacker.agent
        .delete(`/account-deletion-requests/${requestRes.body.id}`)
        .set("X-CSRF-Token", attacker.csrfToken);
      expect(res.status).toBe(404);

      const stillThere = await owner.agent.get("/account-deletion-requests/current");
      expect(stillThere.body.id).toBe(requestRes.body.id);
    });
  });
});
