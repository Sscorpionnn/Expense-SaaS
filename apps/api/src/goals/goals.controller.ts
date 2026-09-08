import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import {
  contributeGoalSchema,
  createGoalSchema,
  paginationQuerySchema,
  updateGoalSchema,
  type ContributeGoalInput,
  type CreateGoalInput,
  type UpdateGoalInput,
} from "@expense-saas/validation";
import type { FinancialGoalDto, PaginatedResult, PaginationQuery } from "@expense-saas/types";
import { CurrentUser, type AuthenticatedRequestUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../core/zod-validation.pipe";
import { GoalsService } from "./goals.service";

@Controller("goals")
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body(new ZodValidationPipe(createGoalSchema)) dto: CreateGoalInput,
  ): Promise<FinancialGoalDto> {
    return this.goalsService.create(user.id, dto);
  }

  @Get()
  findMany(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: Required<PaginationQuery>,
  ): Promise<PaginatedResult<FinancialGoalDto>> {
    return this.goalsService.findMany(user.id, query);
  }

  @Get(":id")
  findOne(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param("id") id: string,
  ): Promise<FinancialGoalDto> {
    return this.goalsService.findOne(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateGoalSchema)) dto: UpdateGoalInput,
  ): Promise<FinancialGoalDto> {
    return this.goalsService.update(user.id, id, dto);
  }

  @Post(":id/contribute")
  contribute(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(contributeGoalSchema)) dto: ContributeGoalInput,
  ): Promise<FinancialGoalDto> {
    return this.goalsService.contribute(user.id, id, dto);
  }

  @HttpCode(204)
  @Delete(":id")
  remove(@CurrentUser() user: AuthenticatedRequestUser, @Param("id") id: string): Promise<void> {
    return this.goalsService.remove(user.id, id);
  }
}
