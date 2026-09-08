import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { AccountDto, PaginatedResult, PaginationQuery } from "@expense-saas/types";
import type { CreateAccountInput, UpdateAccountInput } from "@expense-saas/validation";
import { PrismaService } from "../core/prisma.service";
import { AuditService } from "../core/audit.service";
import { toPaginatedResult, toSkipTake } from "../core/pagination";
import { toAccountDto } from "./accounts.mapper";

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, dto: CreateAccountInput): Promise<AccountDto> {
    const account = await this.prisma.account.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        currency: dto.currency,
        balanceMinor: BigInt(dto.initialBalanceMinor),
      },
    });

    await this.audit.record({
      userId,
      action: "FINANCIAL_ACCOUNT_CREATED",
      targetType: "Account",
      targetId: account.id,
    });

    return toAccountDto(account);
  }

  async findMany(
    userId: string,
    query: Required<PaginationQuery>,
  ): Promise<PaginatedResult<AccountDto>> {
    const where = { userId };
    const [accounts, totalItems] = await Promise.all([
      this.prisma.account.findMany({
        where,
        orderBy: { createdAt: "asc" },
        ...toSkipTake(query),
      }),
      this.prisma.account.count({ where }),
    ]);

    return toPaginatedResult(accounts.map(toAccountDto), totalItems, query);
  }

  async findOneOrThrow(userId: string, id: string) {
    const account = await this.prisma.account.findFirst({ where: { id, userId } });
    if (!account) throw new NotFoundException("Account not found");
    return account;
  }

  async findOne(userId: string, id: string): Promise<AccountDto> {
    return toAccountDto(await this.findOneOrThrow(userId, id));
  }

  async update(userId: string, id: string, dto: UpdateAccountInput): Promise<AccountDto> {
    const existing = await this.findOneOrThrow(userId, id);

    const account = await this.prisma.account.update({
      where: { id: existing.id },
      data: { name: dto.name, isArchived: dto.isArchived },
    });

    if (dto.isArchived === true && !existing.isArchived) {
      await this.audit.record({
        userId,
        action: "FINANCIAL_ACCOUNT_ARCHIVED",
        targetType: "Account",
        targetId: account.id,
      });
    }

    return toAccountDto(account);
  }

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.findOneOrThrow(userId, id);

    const transactionCount = await this.prisma.transaction.count({
      where: { OR: [{ accountId: existing.id }, { transferAccountId: existing.id }] },
    });
    if (transactionCount > 0) {
      throw new ConflictException(
        "This account has transactions and can't be deleted — archive it instead",
      );
    }

    await this.prisma.account.delete({ where: { id: existing.id } });
    await this.audit.record({
      userId,
      action: "FINANCIAL_ACCOUNT_DELETED",
      targetType: "Account",
      targetId: existing.id,
    });
  }
}
