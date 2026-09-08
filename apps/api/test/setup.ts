import "reflect-metadata";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { GlobalExceptionFilter } from "../src/core/http-exception.filter";
import { SERVER_ENV, type ServerEnv } from "../src/core/env.module";
import { PrismaService } from "../src/core/prisma.service";
import { REDIS_CLIENT } from "../src/core/redis.module";
import { MailerService } from "../src/core/mailer.service";
import type Redis from "ioredis";

export interface SentEmail {
  to: string;
  subject: string;
  text: string;
}

export class FakeMailerService {
  public sent: SentEmail[] = [];

  async send(options: { to: string; subject: string; text: string }): Promise<void> {
    this.sent.push(options);
  }

  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    await this.send({ to, subject: "verify", text: verifyUrl });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.send({ to, subject: "reset", text: resetUrl });
  }

  async sendAccountDeletionConfirmationEmail(to: string, confirmUrl: string): Promise<void> {
    await this.send({ to, subject: "account deletion", text: confirmUrl });
  }

  /** Extracts the raw single-use token from the last email sent to `to`. */
  lastTokenFor(to: string): string {
    const email = [...this.sent].reverse().find((entry) => entry.to === to);
    if (!email) throw new Error(`No email sent to ${to}`);
    const match = /token=([^\s&]+)/.exec(email.text);
    const token = match?.[1];
    if (!token) throw new Error(`No token found in email to ${to}`);
    return token;
  }
}

/** superagent/supertest may return a single string or an array for repeated headers. */
export function setCookieHeaders(res: { headers: Record<string, unknown> }): string[] {
  const raw = res.headers["set-cookie"];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw as string];
}

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  redis: Redis;
  mailer: FakeMailerService;
  env: ServerEnv;
}

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(MailerService)
    .useClass(FakeMailerService)
    .compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  const env = app.get<ServerEnv>(SERVER_ENV);
  app.useGlobalFilters(new GlobalExceptionFilter(env));
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    redis: app.get(REDIS_CLIENT),
    mailer: app.get(MailerService) as unknown as FakeMailerService,
    env,
  };
}

/** Wipes every table — call between tests for isolation. Deletion order respects FKs. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.recurringTransaction.deleteMany(),
    prisma.financialGoal.deleteMany(),
    prisma.budgetPeriod.deleteMany(),
    prisma.budget.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.csvImportJob.deleteMany(),
    prisma.dataExportRequest.deleteMany(),
    prisma.account.deleteMany(),
    prisma.category.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.deletionRequest.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

interface AuthedAgent {
  agent: ReturnType<typeof request.agent>;
  csrfToken: string;
  email: string;
}

/** Registers, verifies, and logs in a fresh user; returns an agent ready for authenticated requests. */
export async function registerAndLogin(
  app: INestApplication,
  mailer: FakeMailerService,
  emailPrefix: string,
): Promise<AuthedAgent> {
  const agent = request.agent(app.getHttpServer());
  const email = `${emailPrefix}-${Math.random().toString(36).slice(2)}@example.com`;

  const csrfRes = await agent.get("/auth/csrf");
  const cookie = setCookieHeaders(csrfRes).find((c) => c.startsWith("esaas_csrf="));
  const csrfToken = decodeURIComponent(cookie!.split(";")[0]!.slice("esaas_csrf=".length)).split(
    ".",
  )[0]!;

  await agent
    .post("/auth/register")
    .set("X-CSRF-Token", csrfToken)
    .send({ email, password: "correct-horse-battery", name: "Test User" });
  await agent
    .post("/auth/verify-email")
    .set("X-CSRF-Token", csrfToken)
    .send({ token: mailer.lastTokenFor(email) });
  await agent
    .post("/auth/login")
    .set("X-CSRF-Token", csrfToken)
    .send({ email, password: "correct-horse-battery" });

  return { agent, csrfToken, email };
}
