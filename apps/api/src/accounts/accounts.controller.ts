import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import {
  createAccountSchema,
  paginationQuerySchema,
  updateAccountSchema,
  type CreateAccountInput,
  type UpdateAccountInput,
} from "@expense-saas/validation";
import type { AccountDto, PaginatedResult, PaginationQuery } from "@expense-saas/types";
import { CurrentUser, type AuthenticatedRequestUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../core/zod-validation.pipe";
import { AccountsService } from "./accounts.service";

@Controller("accounts")
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body(new ZodValidationPipe(createAccountSchema)) dto: CreateAccountInput,
  ): Promise<AccountDto> {
    return this.accountsService.create(user.id, dto);
  }

  @Get()
  findMany(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: Required<PaginationQuery>,
  ): Promise<PaginatedResult<AccountDto>> {
    return this.accountsService.findMany(user.id, query);
  }

  @Get(":id")
  findOne(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param("id") id: string,
  ): Promise<AccountDto> {
    return this.accountsService.findOne(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateAccountSchema)) dto: UpdateAccountInput,
  ): Promise<AccountDto> {
    return this.accountsService.update(user.id, id, dto);
  }

  @HttpCode(204)
  @Delete(":id")
  remove(@CurrentUser() user: AuthenticatedRequestUser, @Param("id") id: string): Promise<void> {
    return this.accountsService.remove(user.id, id);
  }
}
