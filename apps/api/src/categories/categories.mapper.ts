import type { Category } from "@expense-saas/database";
import type { CategoryDto } from "@expense-saas/types";

export function toCategoryDto(category: Category): CategoryDto {
  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    color: category.color,
    type: category.type,
    isSystem: category.userId === null,
  };
}
