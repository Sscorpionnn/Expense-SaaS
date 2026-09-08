import type { PaginatedResult, PaginationQuery } from "@expense-saas/types";

export function toSkipTake(query: Required<PaginationQuery>): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

export function toPaginatedResult<T>(
  items: T[],
  totalItems: number,
  query: Required<PaginationQuery>,
): PaginatedResult<T> {
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / query.pageSize)),
  };
}
