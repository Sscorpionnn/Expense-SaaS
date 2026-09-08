import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import {
  createBudgetSchema,
  paginationQuerySchema,
  updateBudgetSchema,
  type CreateBudgetInput,
  type UpdateBudgetInput,
} from "@expense-saas/validation";
import type { BudgetDto, PaginatedResult, PaginationQuery } from "@expense-saas/types";
import { CurrentUser, type AuthenticatedRequestUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../core/zod-validation.pipe";
import { BudgetsService } from "./budgets.service";

@Controller("budgets")
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body(new ZodValidationPipe(createBudgetSchema)) dto: CreateBudgetInput,
  ): Promise<BudgetDto> {
    return this.budgetsService.create(user.id, dto);
  }

  @Get()
  findMany(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: Required<PaginationQuery>,
  ): Promise<PaginatedResult<BudgetDto>> {
    return this.budgetsService.findMany(user.id, query);
  }

  @Get(":id")
  findOne(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param("id") id: string,
  ): Promise<BudgetDto> {
    return this.budgetsService.findOne(user.id, id);
  }

  @Get(":id/progress")
  progress(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param("id") id: string,
  ): Promise<BudgetDto> {
    return this.budgetsService.findOne(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateBudgetSchema)) dto: UpdateBudgetInput,
  ): Promise<BudgetDto> {
    return this.budgetsService.update(user.id, id, dto);
  }

  @HttpCode(204)
  @Delete(":id")
  remove(@CurrentUser() user: AuthenticatedRequestUser, @Param("id") id: string): Promise<void> {
    return this.budgetsService.remove(user.id, id);
  }
}
