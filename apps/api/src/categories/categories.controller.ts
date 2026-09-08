import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import {
  createCategorySchema,
  paginationQuerySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@expense-saas/validation";
import type { CategoryDto, PaginatedResult, PaginationQuery } from "@expense-saas/types";
import { CurrentUser, type AuthenticatedRequestUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../core/zod-validation.pipe";
import { CategoriesService } from "./categories.service";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body(new ZodValidationPipe(createCategorySchema)) dto: CreateCategoryInput,
  ): Promise<CategoryDto> {
    return this.categoriesService.create(user.id, dto);
  }

  @Get()
  findMany(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: Required<PaginationQuery>,
  ): Promise<PaginatedResult<CategoryDto>> {
    return this.categoriesService.findMany(user.id, query);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) dto: UpdateCategoryInput,
  ): Promise<CategoryDto> {
    return this.categoriesService.update(user.id, id, dto);
  }

  @HttpCode(204)
  @Delete(":id")
  remove(@CurrentUser() user: AuthenticatedRequestUser, @Param("id") id: string): Promise<void> {
    return this.categoriesService.remove(user.id, id);
  }
}
