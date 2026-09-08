import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import {
  paginationQuerySchema,
  recurringInputSchema,
  type RecurringInput,
} from "@expense-saas/validation";
import type { PaginatedResult, PaginationQuery, RecurringTransactionDto } from "@expense-saas/types";
import { CurrentUser, type AuthenticatedRequestUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../core/zod-validation.pipe";
import { RecurringService } from "./recurring.service";

@Controller("recurring-transactions")
export class RecurringController {
  constructor(private readonly recurringService: RecurringService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body(new ZodValidationPipe(recurringInputSchema)) dto: RecurringInput,
  ): Promise<RecurringTransactionDto> {
    return this.recurringService.create(user.id, dto);
  }

  @Get()
  findMany(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: Required<PaginationQuery>,
  ): Promise<PaginatedResult<RecurringTransactionDto>> {
    return this.recurringService.findMany(user.id, query);
  }

  @Get(":id")
  findOne(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param("id") id: string,
  ): Promise<RecurringTransactionDto> {
    return this.recurringService.findOne(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(recurringInputSchema)) dto: RecurringInput,
  ): Promise<RecurringTransactionDto> {
    return this.recurringService.update(user.id, id, dto);
  }

  @HttpCode(204)
  @Delete(":id")
  remove(@CurrentUser() user: AuthenticatedRequestUser, @Param("id") id: string): Promise<void> {
    return this.recurringService.remove(user.id, id);
  }
}
