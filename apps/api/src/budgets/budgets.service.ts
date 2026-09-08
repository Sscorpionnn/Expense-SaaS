import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Budget } from "@expense-saas/database";
import type { BudgetDto, PaginatedResult, PaginationQuery } from "@expense-saas/types";
import type { CreateBudgetInput, UpdateBudgetInput } from "@expense-saas/validation";
import { PrismaService } from "../core/prisma.service";
import { AuditService } from "../core/audit.service";
import { toPaginatedResult, toSkipTake } from "../core/pagination";
import { computeCurrentPeriodBounds } from "./budget-period.util";

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, dto: CreateBudgetInput): Promise<BudgetDto> {
    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, OR: [{ userId: null }, { userId }] },
      });
      if (!category) throw new NotFoundException("Category not found");
      if (category.type !== "EXPENSE") {
        throw new BadRequestException("Budgets can only be set on EXPENSE categories");
      }
    }

    const budget = await this.prisma.budget.create({
      data: {
        userId,
        categoryId: dto.categoryId ?? null,
        name: dto.name,
        amountMinor: BigInt(dto.amountMinor),
        currency: dto.currency,
        periodType: dto.periodType,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });

    await this.audit.record({
      userId,
      action: "BUDGET_CREATED",
      targetType: "Budget",
      targetId: budget.id,
    });

    return this.toDto(budget);
  }

  async findMany(
    userId: string,
    query: Required<PaginationQuery>,
  ): Promise<PaginatedResult<BudgetDto>> {
    const where = { userId };
    const [budgets, totalItems] = await Promise.all([
      this.prisma.budget.findMany({ where, orderBy: { createdAt: "desc" }, ...toSkipTake(query) }),
      this.prisma.budget.count({ where }),
    ]);

    const items = await Promise.all(budgets.map((budget) => this.toDto(budget)));
    return toPaginatedResult(items, totalItems, query);
  }

  private async findOwnedOrThrow(userId: string, id: string): Promise<Budget> {
    const budget = await this.prisma.budget.findFirst({ where: { id, userId } });
    if (!budget) throw new NotFoundException("Budget not found");
    return budget;
  }

  async findOne(userId: string, id: string): Promise<BudgetDto> {
    return this.toDto(await this.findOwnedOrThrow(userId, id));
  }

  async update(userId: string, id: string, dto: UpdateBudgetInput): Promise<BudgetDto> {
    const existing = await this.findOwnedOrThrow(userId, id);
    const budget = await this.prisma.budget.update({
      where: { id: existing.id },
      data: {
        name: dto.name,
        amountMinor: dto.amountMinor !== undefined ? BigInt(dto.amountMinor) : undefined,
        isActive: dto.isActive,
      },
    });

    // Keep the *current* period's target in sync with a live edit — past
    // periods stay historical snapshots.
    if (dto.amountMinor !== undefined) {
      const { start } = computeCurrentPeriodBounds(budget);
      await this.prisma.budgetPeriod.updateMany({
        where: { budgetId: budget.id, periodStart: start },
        data: { amountMinor: BigInt(dto.amountMinor) },
      });
    }

    return this.toDto(budget);
  }

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.findOwnedOrThrow(userId, id);
    await this.prisma.budget.delete({ where: { id: existing.id } });
    await this.audit.record({
      userId,
      action: "BUDGET_DELETED",
      targetType: "Budget",
      targetId: existing.id,
    });
  }

  private async findOrCreateCurrentPeriod(budget: Budget) {
    const { start, end } = computeCurrentPeriodBounds(budget);

    let period = await this.prisma.budgetPeriod.findUnique({
      where: { budgetId_periodStart: { budgetId: budget.id, periodStart: start } },
    });
    if (!period) {
      period = await this.prisma.budgetPeriod.create({
        data: {
          budgetId: budget.id,
          periodStart: start,
          periodEnd: end,
          amountMinor: budget.amountMinor,
        },
      });
    }

    const spentMinor = await this.computeSpent(budget, start, end);
    if (spentMinor !== period.spentMinor) {
      period = await this.prisma.budgetPeriod.update({
        where: { id: period.id },
        data: { spentMinor },
      });
    }
    return period;
  }

  private async computeSpent(budget: Budget, start: Date, end: Date): Promise<bigint> {
    const aggregate = await this.prisma.transaction.aggregate({
      where: {
        userId: budget.userId,
        type: "EXPENSE",
        categoryId: budget.categoryId ?? undefined,
        occurredAt: { gte: start, lt: end },
      },
      _sum: { amountMinor: true },
    });
    return aggregate._sum.amountMinor ?? 0n;
  }

  private async toDto(budget: Budget): Promise<BudgetDto> {
    const period = await this.findOrCreateCurrentPeriod(budget);
    const category = budget.categoryId
      ? await this.prisma.category.findUnique({ where: { id: budget.categoryId } })
      : null;

    const remainingMinor = period.amountMinor - period.spentMinor;
    const percentage =
      period.amountMinor > 0n
        ? Number((period.spentMinor * 10000n) / period.amountMinor) / 100
        : 0;

    return {
      id: budget.id,
      name: budget.name,
      categoryId: budget.categoryId,
      categoryName: category?.name ?? null,
      amountMinor: budget.amountMinor.toString(),
      currency: budget.currency,
      periodType: budget.periodType,
      startDate: budget.startDate.toISOString(),
      endDate: budget.endDate?.toISOString() ?? null,
      isActive: budget.isActive,
      currentPeriod: {
        periodStart: period.periodStart.toISOString(),
        periodEnd: period.periodEnd.toISOString(),
        amountMinor: period.amountMinor.toString(),
        spentMinor: period.spentMinor.toString(),
        remainingMinor: remainingMinor.toString(),
        percentage,
      },
    };
  }
}
