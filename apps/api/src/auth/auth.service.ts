import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type Redis from "ioredis";
import { Prisma } from "@expense-saas/database";
import type { UserProfile, SessionInfo } from "@expense-saas/types";
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "@expense-saas/validation";
import { PrismaService } from "../core/prisma.service";
import { REDIS_CLIENT } from "../core/redis.module";
import { MailerService } from "../core/mailer.service";
import { AuditService } from "../core/audit.service";
import { SERVER_ENV, type ServerEnv } from "../core/env.module";
import { generateOpaqueToken, hashToken, hashIdentifier } from "./token.util";
import { hashPassword, verifyPassword } from "./password.util";

interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

const SESSION_CACHE_PREFIX = "session:";

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MailerService) private readonly mailer: MailerService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(SERVER_ENV) private readonly env: ServerEnv,
  ) {}

  async register(input: RegisterInput, meta: RequestMeta): Promise<UserProfile> {
    const passwordHash = await hashPassword(input.password);

    let user;
    try {
      user = await this.prisma.user.create({
        data: { email: input.email, passwordHash, name: input.name },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("An account with this email already exists");
      }
      throw error;
    }

    await this.issueVerificationEmail(user.id, user.email);
    await this.audit.record({
      userId: user.id,
      action: "REGISTER",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return toUserProfile(user);
  }

  async login(
    input: LoginInput,
    meta: RequestMeta,
  ): Promise<{ user: UserProfile; sessionToken: string; expiresAt: Date }> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });

    // Constant-shaped failure path regardless of *why* it failed, to avoid
    // leaking whether the email exists via response differences.
    const failLogin = async (): Promise<never> => {
      await this.audit.record({
        userId: user?.id ?? null,
        action: "LOGIN_FAILURE",
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { emailHash: hashIdentifier(input.email) },
      });
      throw new UnauthorizedException("Invalid email or password");
    };

    if (!user || !user.isActive || user.deletedAt) return failLogin();

    const validPassword = await verifyPassword(user.passwordHash, input.password);
    if (!validPassword) return failLogin();

    const sessionToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + this.env.SESSION_TTL_HOURS * 60 * 60 * 1000);
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(sessionToken),
        userAgent: meta.userAgent,
        ipHash: meta.ip ? hashIdentifier(meta.ip) : null,
        expiresAt,
      },
    });

    await this.audit.record({
      userId: user.id,
      action: "LOGIN_SUCCESS",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { user: toUserProfile(user), sessionToken, expiresAt };
  }

  async logout(sessionToken: string, userId: string, meta: RequestMeta): Promise<void> {
    const tokenHash = hashToken(sessionToken);
    await this.prisma.session.updateMany({
      where: { tokenHash, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.redis.del(SESSION_CACHE_PREFIX + tokenHash);
    await this.audit.record({ userId, action: "LOGOUT", ip: meta.ip, userAgent: meta.userAgent });
  }

  /** Returns the authenticated userId, or null if the session is missing/expired/revoked. */
  async validateSession(sessionToken: string): Promise<string | null> {
    const tokenHash = hashToken(sessionToken);
    const cacheKey = SESSION_CACHE_PREFIX + tokenHash;

    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const session = await this.prisma.session.findUnique({ where: { tokenHash } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;

    const ttlSeconds = Math.max(
      1,
      Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
    );
    await this.redis.set(cacheKey, session.userId, "EX", ttlSeconds);
    return session.userId;
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return toUserProfile(user);
  }

  async listSessions(userId: string, currentSessionToken?: string): Promise<SessionInfo[]> {
    const currentTokenHash = currentSessionToken ? hashToken(currentSessionToken) : null;
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    return sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      userAgent: session.userAgent,
      isCurrent: session.tokenHash === currentTokenHash,
    }));
  }

  async revokeSession(userId: string, sessionId: string, meta: RequestMeta): Promise<void> {
    const session = await this.prisma.session.findFirst({ where: { id: sessionId, userId } });
    if (!session) return; // Not owned / doesn't exist — no-op, no information leaked.

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    await this.redis.del(SESSION_CACHE_PREFIX + session.tokenHash);
    await this.audit.record({
      userId,
      action: "SESSION_REVOKED",
      targetType: "Session",
      targetId: session.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const record = await this.prisma.verificationToken.findUnique({ where: { tokenHash } });
    if (
      !record ||
      record.purpose !== "EMAIL_VERIFY" ||
      record.consumedAt ||
      record.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException("Invalid or expired verification link");
    }

    await this.prisma.$transaction([
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);

    await this.audit.record({ userId: record.userId, action: "EMAIL_VERIFIED" });
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt) {
      await this.issueVerificationEmail(user.id, user.email);
      await this.audit.record({ userId: user.id, action: "EMAIL_VERIFICATION_RESENT" });
    }
    // Always return successfully regardless of outcome — avoids confirming
    // whether an email is registered.
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (user && user.isActive && !user.deletedAt) {
      const rawToken = generateOpaqueToken();
      await this.prisma.verificationToken.create({
        data: {
          userId: user.id,
          purpose: "PASSWORD_RESET",
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      const resetUrl = `${this.env.WEB_URL}/reset-password?token=${rawToken}`;
      await this.mailer.sendPasswordResetEmail(user.email, resetUrl);
      await this.audit.record({ userId: user.id, action: "PASSWORD_RESET_REQUESTED" });
    }
    // Always return successfully — enumeration-safe.
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const tokenHash = hashToken(input.token);
    const record = await this.prisma.verificationToken.findUnique({ where: { tokenHash } });
    if (
      !record ||
      record.purpose !== "PASSWORD_RESET" ||
      record.consumedAt ||
      record.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException("Invalid or expired reset link");
    }

    const newPasswordHash = await hashPassword(input.newPassword);
    await this.prisma.$transaction([
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: newPasswordHash },
      }),
      // Resetting a password invalidates every existing session as a
      // precaution — the credential may have been reset because it leaked.
      this.prisma.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.record({ userId: record.userId, action: "PASSWORD_RESET_COMPLETED" });
  }

  private async issueVerificationEmail(userId: string, email: string): Promise<void> {
    const rawToken = generateOpaqueToken();
    await this.prisma.verificationToken.create({
      data: {
        userId,
        purpose: "EMAIL_VERIFY",
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    const verifyUrl = `${this.env.WEB_URL}/verify-email?token=${rawToken}`;
    await this.mailer.sendVerificationEmail(email, verifyUrl);
  }
}

function toUserProfile(user: {
  id: string;
  email: string;
  name: string;
  emailVerifiedAt: Date | null;
  defaultCurrency: string;
  timezone: string;
  shareUsageAnalytics: boolean;
  createdAt: Date;
}): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerifiedAt !== null,
    defaultCurrency: user.defaultCurrency,
    timezone: user.timezone,
    shareUsageAnalytics: user.shareUsageAnalytics,
    createdAt: user.createdAt.toISOString(),
  };
}
