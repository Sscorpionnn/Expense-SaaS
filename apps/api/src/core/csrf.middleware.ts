import { ForbiddenException, Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { SESSION } from "@expense-saas/config";
import { SERVER_ENV, type ServerEnv } from "./env.module";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Double-submit-cookie CSRF protection. A non-httpOnly, signed CSRF cookie is
 * issued to every client; state-changing requests must echo its token back
 * in the X-CSRF-Token header. A cross-site attacker cannot read the victim's
 * cookie (browser same-origin policy), so they cannot produce a matching
 * header value.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(@Inject(SERVER_ENV) private readonly env: ServerEnv) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const cookieValue = req.cookies?.[SESSION.CSRF_COOKIE_NAME] as string | undefined;
    const existing = cookieValue ? this.verify(cookieValue) : null;
    const token = existing ?? this.issue(res);

    if (!SAFE_METHODS.has(req.method)) {
      const header = req.headers[SESSION.CSRF_HEADER_NAME];
      const headerValue = Array.isArray(header) ? header[0] : header;
      if (!headerValue || !safeEqual(headerValue, token)) {
        throw new ForbiddenException("Invalid or missing CSRF token");
      }
    }

    next();
  }

  private issue(res: Response): string {
    const token = randomBytes(32).toString("base64url");
    const signature = this.sign(token);
    res.cookie(SESSION.CSRF_COOKIE_NAME, `${token}.${signature}`, {
      httpOnly: false,
      secure: this.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      domain: this.env.COOKIE_DOMAIN,
      maxAge: 24 * 60 * 60 * 1000,
    });
    return token;
  }

  private verify(cookieValue: string): string | null {
    const separatorIndex = cookieValue.lastIndexOf(".");
    if (separatorIndex === -1) return null;
    const token = cookieValue.slice(0, separatorIndex);
    const signature = cookieValue.slice(separatorIndex + 1);
    return safeEqual(signature, this.sign(token)) ? token : null;
  }

  private sign(token: string): string {
    return createHmac("sha256", this.env.CSRF_SECRET).update(token).digest("base64url");
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
