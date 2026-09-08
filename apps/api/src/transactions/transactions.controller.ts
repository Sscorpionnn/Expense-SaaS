import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import {
  transactionInputSchema,
  transactionQuerySchema,
  type TransactionInput,
  type TransactionQuery,
} from "@expense-saas/validation";
import type { PaginatedResult, TransactionDto } from "@expense-saas/types";
import { CurrentUser, type AuthenticatedRequestUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../core/zod-validation.pipe";
import { TransactionsService } from "./transactions.service";

@Controller("transactions")
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body(new ZodValidationPipe(transactionInputSchema)) dto: TransactionInput,
  ): Promise<TransactionDto> {
    return this.transactionsService.create(user.id, dto);
  }

  @Get()
  findMany(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query(new ZodValidationPipe(transactionQuerySchema)) query: TransactionQuery,
  ): Promise<PaginatedResult<TransactionDto>> {
    return this.transactionsService.findMany(user.id, query);
  }

  @Get(":id")
  findOne(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param("id") id: string,
  ): Promise<TransactionDto> {
    return this.transactionsService.findOne(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(transactionInputSchema)) dto: TransactionInput,
  ): Promise<TransactionDto> {
    return this.transactionsService.update(user.id, id, dto);
  }

  @HttpCode(204)
  @Delete(":id")
  remove(@CurrentUser() user: AuthenticatedRequestUser, @Param("id") id: string): Promise<void> {
    return this.transactionsService.remove(user.id, id);
  }
}
