import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResendVerificationInput,
  type ResetPasswordInput,
  type VerifyEmailInput,
} from "@expense-saas/validation";
import { SESSION, RATE_LIMITS } from "@expense-saas/config";
import type { SessionInfo, UserProfile } from "@expense-saas/types";
import { AuthService } from "./auth.service";
import { Public } from "./public.decorator";
import { CurrentUser, type AuthenticatedRequestUser } from "./current-user.decorator";
import { ZodValidationPipe } from "../core/zod-validation.pipe";
import { SERVER_ENV, type ServerEnv } from "../core/env.module";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(SERVER_ENV) private readonly env: ServerEnv,
  ) {}

  @Public()
  @Get("csrf")
  csrf(): { ok: true } {
    // The CsrfMiddleware issues the cookie on this (or any) request —
    // this endpoint just gives the frontend something safe to call first.
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { limit: RATE_LIMITS.AUTH_REGISTER.limit, ttl: RATE_LIMITS.AUTH_REGISTER.ttlSeconds * 1000 } })
  @Post("register")
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterInput,
    @Req() req: Request,
  ): Promise<{ user: UserProfile }> {
    const user = await this.authService.register(dto, requestMeta(req));
    return { user };
  }

  @Public()
  @Throttle({ default: { limit: RATE_LIMITS.AUTH_LOGIN.limit, ttl: RATE_LIMITS.AUTH_LOGIN.ttlSeconds * 1000 } })
  @HttpCode(200)
  @Post("login")
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: UserProfile }> {
    const { user, sessionToken, expiresAt } = await this.authService.login(dto, requestMeta(req));
    this.setSessionCookie(res, sessionToken, expiresAt);
    return { user };
  }

  @HttpCode(204)
  @Post("logout")
  async logout(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = req.cookies?.[SESSION.COOKIE_NAME] as string | undefined;
    if (token) {
      await this.authService.logout(token, currentUser.id, requestMeta(req));
    }
    res.clearCookie(SESSION.COOKIE_NAME, { path: "/", domain: this.env.COOKIE_DOMAIN });
  }

  @Public()
  @HttpCode(204)
  @Post("verify-email")
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) dto: VerifyEmailInput,
  ): Promise<void> {
    await this.authService.verifyEmail(dto.token);
  }

  @Public()
  @Throttle({ default: { limit: RATE_LIMITS.AUTH_PASSWORD_RESET.limit, ttl: RATE_LIMITS.AUTH_PASSWORD_RESET.ttlSeconds * 1000 } })
  @HttpCode(204)
  @Post("resend-verification")
  async resendVerification(
    @Body(new ZodValidationPipe(resendVerificationSchema)) dto: ResendVerificationInput,
  ): Promise<void> {
    await this.authService.resendVerification(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: RATE_LIMITS.AUTH_PASSWORD_RESET.limit, ttl: RATE_LIMITS.AUTH_PASSWORD_RESET.ttlSeconds * 1000 } })
  @HttpCode(204)
  @Post("forgot-password")
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) dto: ForgotPasswordInput,
  ): Promise<void> {
    await this.authService.forgotPassword(dto);
  }

  @Public()
  @Throttle({ default: { limit: RATE_LIMITS.AUTH_PASSWORD_RESET.limit, ttl: RATE_LIMITS.AUTH_PASSWORD_RESET.ttlSeconds * 1000 } })
  @HttpCode(204)
  @Post("reset-password")
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordInput,
  ): Promise<void> {
    await this.authService.resetPassword(dto);
  }

  @Get("me")
  async me(@CurrentUser() currentUser: AuthenticatedRequestUser): Promise<{ user: UserProfile }> {
    return { user: await this.authService.getProfile(currentUser.id) };
  }

  @Get("sessions")
  async sessions(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Req() req: Request,
  ): Promise<{ sessions: SessionInfo[] }> {
    const currentToken = req.cookies?.[SESSION.COOKIE_NAME] as string | undefined;
    return { sessions: await this.authService.listSessions(currentUser.id, currentToken) };
  }

  @HttpCode(204)
  @Delete("sessions/:id")
  async revokeSession(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Param("id") sessionId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.authService.revokeSession(currentUser.id, sessionId, requestMeta(req));
  }

  private setSessionCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(SESSION.COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      domain: this.env.COOKIE_DOMAIN,
      expires: expiresAt,
    });
  }
}

function requestMeta(req: Request): { ip?: string; userAgent?: string } {
  return { ip: req.ip, userAgent: req.headers["user-agent"] };
}
