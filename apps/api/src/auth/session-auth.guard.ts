import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { SESSION } from "@expense-saas/config";
import { AuthService } from "./auth.service";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[SESSION.COOKIE_NAME] as string | undefined;
    if (!token) throw new UnauthorizedException("Not authenticated");

    const userId = await this.authService.validateSession(token);
    if (!userId) throw new UnauthorizedException("Session expired or invalid");

    (request as Request & { user: { id: string } }).user = { id: userId };
    return true;
  }
}
