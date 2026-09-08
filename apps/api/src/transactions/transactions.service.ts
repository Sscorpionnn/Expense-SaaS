import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type Account, type Category } from "@expense-saas/database";
import type { PaginatedResult, TransactionDto } from "@expense-saas/types";
import type { TransactionInput, TransactionQuery } from "@expense-saas/validation";
import { PrismaService } from "../core/prisma.service";
import { AuditService } from "../core/audit.service";
import { toPaginatedResult, toSkipTake } from "../core/pagination";
import { toTransactionDto } from "./transactions.mapper";
import { computeBalanceDeltas, mergeBalanceDeltas, negateBalanceDelta } from "./balance-delta.util";

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, dto: TransactionInput): Promise<TransactionDto> {
    const amountMinor = BigInt(dto.amountMinor);
    await this.validateRefs(userId, dto);

    const delta = computeBalanceDeltas(dto.type, amountMinor, dto.accountId, dto.transferAccountId ?? null);

    const transaction = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.transaction.create({
          data: {
            userId,
            accountId: dto.accountId,
            categoryId: dto.categoryId ?? null,
            transferAccountId: dto.transferAccountId ?? null,
            type: dto.type,
            amountMinor,
            currency: dto.currency,
            description: dto.description,
            merchant: dto.merchant,
            notes: dto.notes,
            occurredAt: new Date(dto.occurredAt),
          },
        });
        await this.applyDelta(tx, delta);
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.audit.record({
      userId,
      action: "TRANSACTION_CREATED",
      targetType: "Transaction",
      targetId: transaction.id,
    });

    return toTransactionDto(transaction);
  }

  async findMany(
    userId: string,
    query: TransactionQuery,
  ): Promise<PaginatedResult<TransactionDto>> {
    const where: Prisma.TransactionWhereInput = {
      userId,
      accountId: query.accountId,
      categoryId: query.categoryId,
      type: query.type,
      occurredAt: {
        gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
        lte: query.dateTo ? new Date(query.dateTo) : undefined,
      },
    };

    const [transactions, totalItems] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        ...toSkipTake(query),
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return toPaginatedResult(transactions.map(toTransactionDto), totalItems, query);
  }

  private async findOwnedOrThrow(userId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({ where: { id, userId } });
    if (!transaction) throw new NotFoundException("Transaction not found");
    return transaction;
  }

  async findOne(userId: string, id: string): Promise<TransactionDto> {
    return toTransactionDto(await this.findOwnedOrThrow(userId, id));
  }

  async update(userId: string, id: string, dto: TransactionInput): Promise<TransactionDto> {
    const existing = await this.findOwnedOrThrow(userId, id);
    const newAmount = BigInt(dto.amountMinor);
    await this.validateRefs(userId, dto);

    const oldDelta = computeBalanceDeltas(
      existing.type,
      existing.amountMinor,
      existing.accountId,
      existing.transferAccountId,
    );
    const newDelta = computeBalanceDeltas(
      dto.type,
      newAmount,
      dto.accountId,
      dto.transferAccountId ?? null,
    );
    const netDelta = mergeBalanceDeltas(negateBalanceDelta(oldDelta), newDelta);

    const transaction = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.transaction.update({
          where: { id: existing.id },
          data: {
            accountId: dto.accountId,
            categoryId: dto.categoryId ?? null,
            transferAccountId: dto.transferAccountId ?? null,
            type: dto.type,
            amountMinor: newAmount,
            currency: dto.currency,
            description: dto.description,
            merchant: dto.merchant,
            notes: dto.notes,
            occurredAt: new Date(dto.occurredAt),
          },
        });
        await this.applyDelta(tx, netDelta);
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.audit.record({
      userId,
      action: "TRANSACTION_UPDATED",
      targetType: "Transaction",
      targetId: transaction.id,
    });

    return toTransactionDto(transaction);
  }

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.findOwnedOrThrow(userId, id);
    const reversal = negateBalanceDelta(
      computeBalanceDeltas(
        existing.type,
        existing.amountMinor,
        existing.accountId,
        existing.transferAccountId,
      ),
    );

    await this.prisma.$transaction(
      async (tx) => {
        await tx.transaction.delete({ where: { id: existing.id } });
        await this.applyDelta(tx, reversal);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.audit.record({
      userId,
      action: "TRANSACTION_DELETED",
      targetType: "Transaction",
      targetId: existing.id,
    });
  }

  private async applyDelta(
    tx: Prisma.TransactionClient,
    delta: Map<string, bigint>,
  ): Promise<void> {
    for (const [accountId, amount] of delta) {
      if (amount === 0n) continue;
      await tx.account.update({
        where: { id: accountId },
        data: { balanceMinor: { increment: amount } },
      });
    }
  }

  /** Validates ownership, archival state, and currency/category consistency server-side. */
  private async validateRefs(
    userId: string,
    dto: TransactionInput,
  ): Promise<{ account: Account; transferAccount: Account | null; category: Category | null }> {
    const account = await this.prisma.account.findFirst({
      where: { id: dto.accountId, userId },
    });
    if (!account) throw new NotFoundException("Account not found");
    if (account.isArchived) throw new BadRequestException("Cannot post to an archived account");
    if (account.currency !== dto.currency) {
      throw new BadRequestException("Transaction currency must match the account's currency");
    }

    let transferAccount: Account | null = null;
    if (dto.type === "TRANSFER") {
      transferAccount = await this.prisma.account.findFirst({
        where: { id: dto.transferAccountId!, userId },
      });
      if (!transferAccount) throw new NotFoundException("Destination account not found");
      if (transferAccount.isArchived) {
        throw new BadRequestException("Cannot transfer into an archived account");
      }
      if (transferAccount.currency !== account.currency) {
        throw new BadRequestException(
          "Transfers between accounts of different currencies aren't supported yet",
        );
      }
    }

    let category: Category | null = null;
    if (dto.categoryId) {
      category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, OR: [{ userId: null }, { userId }] },
      });
      if (!category) throw new NotFoundException("Category not found");
      if (category.type !== dto.type) {
        throw new BadRequestException(
          `Category type (${category.type}) must match transaction type (${dto.type})`,
        );
      }
    }

    return { account, transferAccount, category };
  }
}
