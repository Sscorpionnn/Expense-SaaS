import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { confirmDeletionSchema, type ConfirmDeletionInput } from "@expense-saas/validation";
import { RATE_LIMITS } from "@expense-saas/config";
import type { DeletionRequestDto } from "@expense-saas/types";
import { CurrentUser, type AuthenticatedRequestUser } from "../auth/current-user.decorator";
import { Public } from "../auth/public.decorator";
import { ZodValidationPipe } from "../core/zod-validation.pipe";
import { AccountDeletionService } from "./account-deletion.service";

@Controller("account-deletion-requests")
export class AccountDeletionController {
  constructor(private readonly accountDeletionService: AccountDeletionService) {}

  @Get("current")
  getCurrent(
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<DeletionRequestDto | null> {
    return this.accountDeletionService.getCurrent(user.id);
  }

  @Throttle({
    default: {
      limit: RATE_LIMITS.AUTH_PASSWORD_RESET.limit,
      ttl: RATE_LIMITS.AUTH_PASSWORD_RESET.ttlSeconds * 1000,
    },
  })
  @HttpCode(201)
  @Post()
  request(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ): Promise<DeletionRequestDto> {
    return this.accountDeletionService.requestDeletion(user.id, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
  }

  @Public()
  @HttpCode(200)
  @Post("confirm")
  confirm(
    @Body(new ZodValidationPipe(confirmDeletionSchema)) dto: ConfirmDeletionInput,
  ): Promise<DeletionRequestDto> {
    return this.accountDeletionService.confirm(dto.token);
  }

  @HttpCode(204)
  @Delete(":id")
  cancel(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<void> {
    return this.accountDeletionService.cancel(user.id, id, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
  }
}
