import { Injectable, NotFoundException } from "@nestjs/common";
import type { AnalyticsSummaryDto, CategorySpendingDto, MonthlyTrendDto } from "@expense-saas/types";
import type { AnalyticsQuery } from "@expense-saas/validation";
import { PrismaService } from "../core/prisma.service";

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getDefaultCurrency(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { defaultCurrency: true },
    });
    if (!user) throw new NotFoundException("User not found");
    return user.defaultCurrency;
  }

  async summary(userId: string, query: AnalyticsQuery): Promise<AnalyticsSummaryDto> {
    const currency = await this.getDefaultCurrency(userId);
    const occurredAt = dateRangeFilter(query);

    const [incomeAgg, expenseAgg, balanceAgg] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { userId, currency, type: "INCOME", occurredAt },
        _sum: { amountMinor: true },
      }),
      this.prisma.transaction.aggregate({
        where: { userId, currency, type: "EXPENSE", occurredAt },
        _sum: { amountMinor: true },
      }),
      this.prisma.account.aggregate({
        where: { userId, currency },
        _sum: { balanceMinor: true },
      }),
    ]);

    const incomeMinor = incomeAgg._sum.amountMinor ?? 0n;
    const expenseMinor = expenseAgg._sum.amountMinor ?? 0n;

    return {
      currency,
      incomeMinor: incomeMinor.toString(),
      expenseMinor: expenseMinor.toString(),
      netMinor: (incomeMinor - expenseMinor).toString(),
      totalBalanceMinor: (balanceAgg._sum.balanceMinor ?? 0n).toString(),
    };
  }

  async spendingByCategory(userId: string, query: AnalyticsQuery): Promise<CategorySpendingDto[]> {
    const currency = await this.getDefaultCurrency(userId);
    const occurredAt = dateRangeFilter(query);

    const grouped = await this.prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, currency, type: "EXPENSE", occurredAt },
      _sum: { amountMinor: true },
    });

    const categoryIds = grouped.map((g) => g.categoryId).filter((id): id is string => id !== null);
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(categories.map((c) => [c.id, c.name]));

    return grouped
      .map((g) => ({
        categoryId: g.categoryId,
        categoryName: g.categoryId ? (nameById.get(g.categoryId) ?? "Unknown") : "Uncategorized",
        spentMinor: (g._sum.amountMinor ?? 0n).toString(),
      }))
      .sort((a, b) => (BigInt(b.spentMinor) > BigInt(a.spentMinor) ? 1 : -1));
  }

  async monthlyTrends(userId: string, months: number): Promise<MonthlyTrendDto[]> {
    const currency = await this.getDefaultCurrency(userId);
    const now = new Date();
    const results: MonthlyTrendDto[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));

      const [incomeAgg, expenseAgg] = await Promise.all([
        this.prisma.transaction.aggregate({
          where: { userId, currency, type: "INCOME", occurredAt: { gte: start, lt: end } },
          _sum: { amountMinor: true },
        }),
        this.prisma.transaction.aggregate({
          where: { userId, currency, type: "EXPENSE", occurredAt: { gte: start, lt: end } },
          _sum: { amountMinor: true },
        }),
      ]);

      results.push({
        month: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
        incomeMinor: (incomeAgg._sum.amountMinor ?? 0n).toString(),
        expenseMinor: (expenseAgg._sum.amountMinor ?? 0n).toString(),
      });
    }

    return results;
  }
}

function dateRangeFilter(query: AnalyticsQuery): { gte?: Date; lte?: Date } | undefined {
  if (!query.dateFrom && !query.dateTo) return undefined;
  return {
    gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
    lte: query.dateTo ? new Date(query.dateTo) : undefined,
  };
}
