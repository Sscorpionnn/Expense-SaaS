import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import type { ApiErrorBody } from "@expense-saas/types";
import { SERVER_ENV, type ServerEnv } from "./env.module";

/**
 * Maps every thrown error to a consistent ApiErrorBody shape. In production,
 * unrecognized errors never leak a message or stack trace to the client —
 * only a generic message, with the real error logged server-side.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  constructor(@Inject(SERVER_ENV) private readonly env: ServerEnv) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = typeof body === "string" ? body : (body as { message?: unknown }).message;
      const details =
        typeof body === "object" && body !== null && "details" in body
          ? (body as { details?: Record<string, string[]> }).details
          : undefined;

      const payload: ApiErrorBody = {
        statusCode: status,
        message: Array.isArray(message) ? message.join(", ") : String(message ?? exception.message),
        code: codeFromStatus(status),
        ...(details ? { details } : {}),
      };
      response.status(status).json(payload);
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);

    const payload: ApiErrorBody = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: this.env.NODE_ENV === "production" ? "Internal server error" : String(exception),
      code: "INTERNAL_ERROR",
    };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(payload);
  }
}

function codeFromStatus(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return "BAD_REQUEST";
    case HttpStatus.UNAUTHORIZED:
      return "UNAUTHORIZED";
    case HttpStatus.FORBIDDEN:
      return "FORBIDDEN";
    case HttpStatus.NOT_FOUND:
      return "NOT_FOUND";
    case HttpStatus.CONFLICT:
      return "CONFLICT";
    case HttpStatus.TOO_MANY_REQUESTS:
      return "TOO_MANY_REQUESTS";
    default:
      return "ERROR";
  }
}
