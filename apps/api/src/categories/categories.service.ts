import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { CategoryDto, PaginatedResult, PaginationQuery } from "@expense-saas/types";
import type { CreateCategoryInput, UpdateCategoryInput } from "@expense-saas/validation";
import { PrismaService } from "../core/prisma.service";
import { toPaginatedResult, toSkipTake } from "../core/pagination";
import { toCategoryDto } from "./categories.mapper";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCategoryInput): Promise<CategoryDto> {
    const category = await this.prisma.category.create({
      data: { userId, name: dto.name, icon: dto.icon, color: dto.color, type: dto.type },
    });
    return toCategoryDto(category);
  }

  async findMany(
    userId: string,
    query: Required<PaginationQuery>,
  ): Promise<PaginatedResult<CategoryDto>> {
    // System defaults (userId null) plus this user's own custom categories.
    const where = { OR: [{ userId: null }, { userId }] };
    const [categories, totalItems] = await Promise.all([
      this.prisma.category.findMany({
        where,
        orderBy: [{ type: "asc" }, { name: "asc" }],
        ...toSkipTake(query),
      }),
      this.prisma.category.count({ where }),
    ]);

    return toPaginatedResult(categories.map(toCategoryDto), totalItems, query);
  }

  private async findOwnedOrThrow(userId: string, id: string) {
    // Deliberately scoped to userId (not the OR-with-null visibility used for
    // reads) — system categories are visible to everyone but owned by no
    // one, so they can never be edited or deleted.
    const category = await this.prisma.category.findFirst({ where: { id, userId } });
    if (!category) throw new NotFoundException("Category not found");
    return category;
  }

  async update(userId: string, id: string, dto: UpdateCategoryInput): Promise<CategoryDto> {
    const existing = await this.findOwnedOrThrow(userId, id);
    const category = await this.prisma.category.update({
      where: { id: existing.id },
      data: { name: dto.name, icon: dto.icon, color: dto.color },
    });
    return toCategoryDto(category);
  }

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.findOwnedOrThrow(userId, id);

    const transactionCount = await this.prisma.transaction.count({
      where: { categoryId: existing.id },
    });
    if (transactionCount > 0) {
      throw new ConflictException(
        "This category is used by existing transactions and can't be deleted",
      );
    }

    await this.prisma.category.delete({ where: { id: existing.id } });
  }
}
