import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { SESSION } from "@expense-saas/config";
import {
  createTestApp,
  resetDatabase,
  setCookieHeaders,
  type FakeMailerService,
  type TestApp,
} from "./setup";
import type { PrismaService } from "../src/core/prisma.service";
import type Redis from "ioredis";

/**
 * Integration tests — require a live Postgres + Redis (see docker-compose.yml)
 * with DATABASE_URL / REDIS_URL pointed at them. Run via `pnpm test:integration`.
 */

function extractCookie(setCookie: string[] | undefined, name: string): string | null {
  const header = setCookie?.find((c) => c.startsWith(`${name}=`));
  if (!header) return null;
  return header.split(";")[0]!.slice(name.length + 1);
}

async function withCsrf(agent: ReturnType<typeof request.agent>): Promise<string> {
  const res = await agent.get("/auth/csrf");
  const cookie = extractCookie(setCookieHeaders(res), SESSION.CSRF_COOKIE_NAME);
  if (!cookie) throw new Error("CSRF cookie not issued");
  return decodeURIComponent(cookie).split(".")[0]!;
}

describe("Auth (integration)", () => {
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

  const server = () => app.getHttpServer();

  describe("register", () => {
    it("creates a user and never returns the password hash", async () => {
      const agent = request.agent(server());
      const csrf = await withCsrf(agent);

      const res = await agent
        .post("/auth/register")
        .set("X-CSRF-Token", csrf)
        .send({ email: "ada@example.com", password: "correct-horse-battery", name: "Ada" });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe("ada@example.com");
      expect(res.body.user).not.toHaveProperty("passwordHash");
      expect(res.body.user.emailVerified).toBe(false);
    });

    it("rejects a duplicate email with 409", async () => {
      const agent = request.agent(server());
      const csrf = await withCsrf(agent);
      const payload = { email: "dup@example.com", password: "correct-horse-battery", name: "A" };

      await agent.post("/auth/register").set("X-CSRF-Token", csrf).send(payload);
      const res = await agent.post("/auth/register").set("X-CSRF-Token", csrf).send(payload);

      expect(res.status).toBe(409);
    });

    it("rejects requests missing a valid CSRF token", async () => {
      const agent = request.agent(server());
      await agent.get("/auth/csrf"); // issues the cookie but we don't send the header back

      const res = await agent
        .post("/auth/register")
        .send({ email: "nope@example.com", password: "correct-horse-battery", name: "A" });

      expect(res.status).toBe(403);
    });

    it("rejects unexpected extra fields (mass-assignment protection)", async () => {
      const agent = request.agent(server());
      const csrf = await withCsrf(agent);

      const res = await agent
        .post("/auth/register")
        .set("X-CSRF-Token", csrf)
        .send({
          email: "mass@example.com",
          password: "correct-horse-battery",
          name: "A",
          isActive: true,
          id: "attacker-chosen-id",
        });

      expect(res.status).toBe(400);
    });
  });

  describe("login + session", () => {
    async function registerUser(agent: ReturnType<typeof request.agent>, email: string) {
      const csrf = await withCsrf(agent);
      await agent
        .post("/auth/register")
        .set("X-CSRF-Token", csrf)
        .send({ email, password: "correct-horse-battery", name: "User" });
      return csrf;
    }

    it("rejects an unknown email and a wrong password with the same generic message", async () => {
      const agent = request.agent(server());
      const csrf = await registerUser(agent, "user@example.com");

      const wrongPassword = await agent
        .post("/auth/login")
        .set("X-CSRF-Token", csrf)
        .send({ email: "user@example.com", password: "totally-wrong" });
      const unknownEmail = await agent
        .post("/auth/login")
        .set("X-CSRF-Token", csrf)
        .send({ email: "nobody@example.com", password: "totally-wrong" });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    });

    it("logs in, sets an httpOnly cookie, and allows GET /auth/me", async () => {
      const agent = request.agent(server());
      const csrf = await registerUser(agent, "login@example.com");

      const loginRes = await agent
        .post("/auth/login")
        .set("X-CSRF-Token", csrf)
        .send({ email: "login@example.com", password: "correct-horse-battery" });

      expect(loginRes.status).toBe(200);
      const sessionCookie = setCookieHeaders(loginRes).find((c) =>
        c.startsWith(`${SESSION.COOKIE_NAME}=`),
      );
      expect(sessionCookie).toContain("HttpOnly");

      const meRes = await agent.get("/auth/me");
      expect(meRes.status).toBe(200);
      expect(meRes.body.user.email).toBe("login@example.com");
    });

    it("rejects requests with no session cookie", async () => {
      const res = await request(server()).get("/auth/me");
      expect(res.status).toBe(401);
    });

    it("logout revokes the session so it can no longer be used", async () => {
      const agent = request.agent(server());
      const csrf = await registerUser(agent, "logout@example.com");
      await agent
        .post("/auth/login")
        .set("X-CSRF-Token", csrf)
        .send({ email: "logout@example.com", password: "correct-horse-battery" });

      await agent.post("/auth/logout").set("X-CSRF-Token", csrf);
      const res = await agent.get("/auth/me");
      expect(res.status).toBe(401);
    });
  });

  describe("email verification", () => {
    it("verifies an account via the emailed token", async () => {
      const agent = request.agent(server());
      const csrf = await withCsrf(agent);
      await agent
        .post("/auth/register")
        .set("X-CSRF-Token", csrf)
        .send({ email: "verify@example.com", password: "correct-horse-battery", name: "A" });

      const token = mailer.lastTokenFor("verify@example.com");
      const res = await agent
        .post("/auth/verify-email")
        .set("X-CSRF-Token", csrf)
        .send({ token });
      expect(res.status).toBe(204);

      await agent
        .post("/auth/login")
        .set("X-CSRF-Token", csrf)
        .send({ email: "verify@example.com", password: "correct-horse-battery" });
      const me = await agent.get("/auth/me");
      expect(me.body.user.emailVerified).toBe(true);
    });

    it("rejects an already-used or unknown token", async () => {
      const agent = request.agent(server());
      const csrf = await withCsrf(agent);
      const res = await agent
        .post("/auth/verify-email")
        .set("X-CSRF-Token", csrf)
        .send({ token: "not-a-real-token" });
      expect(res.status).toBe(401);
    });
  });

  describe("password reset", () => {
    it("resets the password and revokes existing sessions", async () => {
      const agent = request.agent(server());
      const csrf = await withCsrf(agent);
      const email = "reset@example.com";
      await agent
        .post("/auth/register")
        .set("X-CSRF-Token", csrf)
        .send({ email, password: "correct-horse-battery", name: "A" });
      await agent
        .post("/auth/login")
        .set("X-CSRF-Token", csrf)
        .send({ email, password: "correct-horse-battery" });
      expect((await agent.get("/auth/me")).status).toBe(200);

      await agent.post("/auth/forgot-password").set("X-CSRF-Token", csrf).send({ email });
      const token = mailer.lastTokenFor(email);

      const resetRes = await agent
        .post("/auth/reset-password")
        .set("X-CSRF-Token", csrf)
        .send({ token, newPassword: "brand-new-password" });
      expect(resetRes.status).toBe(204);

      // Old session is now invalid.
      expect((await agent.get("/auth/me")).status).toBe(401);

      // New password works, old one doesn't.
      const oldPasswordLogin = await agent
        .post("/auth/login")
        .set("X-CSRF-Token", csrf)
        .send({ email, password: "correct-horse-battery" });
      expect(oldPasswordLogin.status).toBe(401);

      const newPasswordLogin = await agent
        .post("/auth/login")
        .set("X-CSRF-Token", csrf)
        .send({ email, password: "brand-new-password" });
      expect(newPasswordLogin.status).toBe(200);
    });

    it("always responds successfully for forgot-password, even for an unknown email", async () => {
      const agent = request.agent(server());
      const csrf = await withCsrf(agent);
      const res = await agent
        .post("/auth/forgot-password")
        .set("X-CSRF-Token", csrf)
        .send({ email: "nobody@example.com" });
      expect(res.status).toBe(204);
      expect(mailer.sent).toHaveLength(0);
    });
  });

  describe("session ownership (IDOR)", () => {
    it("cannot revoke another user's session, and it stays active", async () => {
      const agentA = request.agent(server());
      const csrfA = await withCsrf(agentA);
      await agentA
        .post("/auth/register")
        .set("X-CSRF-Token", csrfA)
        .send({ email: "victim@example.com", password: "correct-horse-battery", name: "A" });
      await agentA
        .post("/auth/login")
        .set("X-CSRF-Token", csrfA)
        .send({ email: "victim@example.com", password: "correct-horse-battery" });
      const victimSessions = await agentA.get("/auth/sessions");
      const victimSessionId = victimSessions.body.sessions[0].id;

      const agentB = request.agent(server());
      const csrfB = await withCsrf(agentB);
      await agentB
        .post("/auth/register")
        .set("X-CSRF-Token", csrfB)
        .send({ email: "attacker@example.com", password: "correct-horse-battery", name: "B" });
      await agentB
        .post("/auth/login")
        .set("X-CSRF-Token", csrfB)
        .send({ email: "attacker@example.com", password: "correct-horse-battery" });

      // Attacker guesses/enumerates the victim's session id.
      const attackRes = await agentB
        .delete(`/auth/sessions/${victimSessionId}`)
        .set("X-CSRF-Token", csrfB);
      expect(attackRes.status).toBe(204); // no information leaked either way

      // Victim's session is untouched.
      expect((await agentA.get("/auth/me")).status).toBe(200);
    });
  });

  describe("rate limiting", () => {
    it("throttles repeated login attempts from the same client", async () => {
      const agent = request.agent(server());
      const csrf = await withCsrf(agent);

      const attempts = await Promise.all(
        Array.from({ length: 10 }, () =>
          agent
            .post("/auth/login")
            .set("X-CSRF-Token", csrf)
            .send({ email: "flood@example.com", password: "wrong" }),
        ),
      );

      expect(attempts.some((res) => res.status === 429)).toBe(true);
    });
  });
});
