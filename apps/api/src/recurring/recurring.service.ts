import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult, PaginationQuery, RecurringTransactionDto } from "@expense-saas/types";
import type { RecurringInput } from "@expense-saas/validation";
import { PrismaService } from "../core/prisma.service";
import { AuditService } from "../core/audit.service";
import { toPaginatedResult, toSkipTake } from "../core/pagination";
import { toRecurringDto } from "./recurring.mapper";

@Injectable()
export class RecurringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async validateRefs(userId: string, dto: RecurringInput) {
    const account = await this.prisma.account.findFirst({
      where: { id: dto.accountId, userId },
    });
    if (!account) throw new NotFoundException("Account not found");
    if (account.isArchived) {
      throw new BadRequestException("Cannot create a recurring transaction on an archived account");
    }
    if (account.currency !== dto.currency) {
      throw new BadRequestException("Currency must match the account's currency");
    }

    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, OR: [{ userId: null }, { userId }] },
    });
    if (!category) throw new NotFoundException("Category not found");
    if (category.type !== dto.type) {
      throw new BadRequestException(
        `Category type (${category.type}) must match transaction type (${dto.type})`,
      );
    }
  }

  async create(userId: string, dto: RecurringInput): Promise<RecurringTransactionDto> {
    await this.validateRefs(userId, dto);

    const recurring = await this.prisma.recurringTransaction.create({
      data: {
        userId,
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        type: dto.type,
        amountMinor: BigInt(dto.amountMinor),
        currency: dto.currency,
        description: dto.description,
        merchant: dto.merchant,
        frequency: dto.frequency,
        interval: dto.interval,
        startDate: new Date(dto.startDate),
        nextOccurrenceAt: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        isActive: dto.isActive,
      },
    });

    await this.audit.record({
      userId,
      action: "RECURRING_TRANSACTION_CREATED",
      targetType: "RecurringTransaction",
      targetId: recurring.id,
    });

    return toRecurringDto(recurring);
  }

  async findMany(
    userId: string,
    query: Required<PaginationQuery>,
  ): Promise<PaginatedResult<RecurringTransactionDto>> {
    const where = { userId };
    const [items, totalItems] = await Promise.all([
      this.prisma.recurringTransaction.findMany({
        where,
        orderBy: { nextOccurrenceAt: "asc" },
        ...toSkipTake(query),
      }),
      this.prisma.recurringTransaction.count({ where }),
    ]);
    return toPaginatedResult(items.map(toRecurringDto), totalItems, query);
  }

  private async findOwnedOrThrow(userId: string, id: string) {
    const recurring = await this.prisma.recurringTransaction.findFirst({ where: { id, userId } });
    if (!recurring) throw new NotFoundException("Recurring transaction not found");
    return recurring;
  }

  async findOne(userId: string, id: string): Promise<RecurringTransactionDto> {
    return toRecurringDto(await this.findOwnedOrThrow(userId, id));
  }

  async update(userId: string, id: string, dto: RecurringInput): Promise<RecurringTransactionDto> {
    const existing = await this.findOwnedOrThrow(userId, id);
    await this.validateRefs(userId, dto);

    const recurring = await this.prisma.recurringTransaction.update({
      where: { id: existing.id },
      data: {
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        type: dto.type,
        amountMinor: BigInt(dto.amountMinor),
        currency: dto.currency,
        description: dto.description,
        merchant: dto.merchant,
        frequency: dto.frequency,
        interval: dto.interval,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        isActive: dto.isActive,
      },
    });
    return toRecurringDto(recurring);
  }

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.findOwnedOrThrow(userId, id);
    await this.prisma.recurringTransaction.delete({ where: { id: existing.id } });
    await this.audit.record({
      userId,
      action: "RECURRING_TRANSACTION_DELETED",
      targetType: "RecurringTransaction",
      targetId: existing.id,
    });
  }
}
