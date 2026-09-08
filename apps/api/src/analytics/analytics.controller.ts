import { Controller, Get, Query } from "@nestjs/common";
import {
  analyticsQuerySchema,
  monthlyTrendsQuerySchema,
  type AnalyticsQuery,
  type MonthlyTrendsQuery,
} from "@expense-saas/validation";
import type {
  AnalyticsSummaryDto,
  BudgetDto,
  CategorySpendingDto,
  MonthlyTrendDto,
  PaginatedResult,
} from "@expense-saas/types";
import { CurrentUser, type AuthenticatedRequestUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../core/zod-validation.pipe";
import { AnalyticsService } from "./analytics.service";
import { BudgetsService } from "../budgets/budgets.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly budgetsService: BudgetsService,
  ) {}

  @Get("summary")
  summary(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query(new ZodValidationPipe(analyticsQuerySchema)) query: AnalyticsQuery,
  ): Promise<AnalyticsSummaryDto> {
    return this.analyticsService.summary(user.id, query);
  }

  @Get("spending-by-category")
  spendingByCategory(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query(new ZodValidationPipe(analyticsQuerySchema)) query: AnalyticsQuery,
  ): Promise<CategorySpendingDto[]> {
    return this.analyticsService.spendingByCategory(user.id, query);
  }

  @Get("monthly-trends")
  monthlyTrends(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query(new ZodValidationPipe(monthlyTrendsQuerySchema)) query: MonthlyTrendsQuery,
  ): Promise<MonthlyTrendDto[]> {
    return this.analyticsService.monthlyTrends(user.id, query.months);
  }

  @Get("budget-utilization")
  budgetUtilization(
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<PaginatedResult<BudgetDto>> {
    return this.budgetsService.findMany(user.id, { page: 1, pageSize: 100 });
  }
}
