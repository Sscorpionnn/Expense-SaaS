import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { FinancialGoalDto, PaginatedResult, PaginationQuery } from "@expense-saas/types";
import type {
  ContributeGoalInput,
  CreateGoalInput,
  UpdateGoalInput,
} from "@expense-saas/validation";
import { PrismaService } from "../core/prisma.service";
import { AuditService } from "../core/audit.service";
import { toPaginatedResult, toSkipTake } from "../core/pagination";
import { toGoalDto } from "./goals.mapper";

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, dto: CreateGoalInput): Promise<FinancialGoalDto> {
    if (dto.linkedAccountId) {
      const account = await this.prisma.account.findFirst({
        where: { id: dto.linkedAccountId, userId },
      });
      if (!account) throw new NotFoundException("Linked account not found");
    }

    const goal = await this.prisma.financialGoal.create({
      data: {
        userId,
        name: dto.name,
        targetAmountMinor: BigInt(dto.targetAmountMinor),
        currency: dto.currency,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        linkedAccountId: dto.linkedAccountId ?? null,
      },
    });

    await this.audit.record({
      userId,
      action: "GOAL_CREATED",
      targetType: "FinancialGoal",
      targetId: goal.id,
    });

    return toGoalDto(goal);
  }

  async findMany(
    userId: string,
    query: Required<PaginationQuery>,
  ): Promise<PaginatedResult<FinancialGoalDto>> {
    const where = { userId };
    const [goals, totalItems] = await Promise.all([
      this.prisma.financialGoal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...toSkipTake(query),
      }),
      this.prisma.financialGoal.count({ where }),
    ]);
    return toPaginatedResult(goals.map(toGoalDto), totalItems, query);
  }

  private async findOwnedOrThrow(userId: string, id: string) {
    const goal = await this.prisma.financialGoal.findFirst({ where: { id, userId } });
    if (!goal) throw new NotFoundException("Goal not found");
    return goal;
  }

  async findOne(userId: string, id: string): Promise<FinancialGoalDto> {
    return toGoalDto(await this.findOwnedOrThrow(userId, id));
  }

  async update(userId: string, id: string, dto: UpdateGoalInput): Promise<FinancialGoalDto> {
    const existing = await this.findOwnedOrThrow(userId, id);
    const goal = await this.prisma.financialGoal.update({
      where: { id: existing.id },
      data: {
        name: dto.name,
        targetAmountMinor: dto.targetAmountMinor !== undefined ? BigInt(dto.targetAmountMinor) : undefined,
        deadline: dto.deadline === undefined ? undefined : dto.deadline ? new Date(dto.deadline) : null,
        status: dto.status,
      },
    });
    return toGoalDto(goal);
  }

  async contribute(
    userId: string,
    id: string,
    dto: ContributeGoalInput,
  ): Promise<FinancialGoalDto> {
    const existing = await this.findOwnedOrThrow(userId, id);
    if (existing.status !== "ACTIVE") {
      throw new BadRequestException("Can only contribute to an active goal");
    }

    const newAmount = existing.currentAmountMinor + BigInt(dto.amountMinor);
    const goal = await this.prisma.financialGoal.update({
      where: { id: existing.id },
      data: {
        currentAmountMinor: newAmount,
        status: newAmount >= existing.targetAmountMinor ? "COMPLETED" : undefined,
      },
    });
    return toGoalDto(goal);
  }

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.findOwnedOrThrow(userId, id);
    await this.prisma.financialGoal.delete({ where: { id: existing.id } });
    await this.audit.record({
      userId,
      action: "GOAL_DELETED",
      targetType: "FinancialGoal",
      targetId: existing.id,
    });
  }
}
